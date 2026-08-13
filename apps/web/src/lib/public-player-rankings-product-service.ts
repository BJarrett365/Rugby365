/**
 * Public PLAYER RANKINGS product — CURRENT boards from persisted snapshots.
 * All-Time is scaffolded separately (under development until historical quality allows).
 */
import "server-only";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  competitions,
  fixtures,
  playerMatchPerformanceStats,
  playerRankingBoardSnapshots,
  playerRankingHistory,
  playerRatings,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  ALLTIME_ERA_OPTIONS,
  PLAYER_RANK_ALLTIME_MODEL,
  PLAYER_RANK_CURRENT_MODEL,
  PLAYER_RANKING_ELIGIBILITY,
  PUBLIC_RANKING_POSITION_FILTERS,
  RANKING_ACTIVE_MONTHS,
  RANKING_POSITION_GROUPS,
  buildPlayerRankingsTitle,
  buildRankingFilterKey,
  computePositionRankingScore,
  denseRankWithTies,
  formatRankingDisplay,
  isEligibleForCurrentRanking,
  normalizeRankingTop,
  parseLastFiveFormBlocks,
  rankingMovement,
  resolveRankingPositionGroup,
  shortCompetitionLabel,
  type PlayerRankingBoardFilters,
  type PlayerRankingMode,
  type ScoredMember,
} from "./player-ranking-engine";

export type PublicRankingBoardRow = {
  rank: number;
  rankDisplay: string;
  provisional: boolean;
  movement: "up" | "down" | "flat" | null;
  previousRank: number | null;
  playerId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamImageUrl: string | null;
  teamSlug: string | null;
  nationName: string | null;
  nationImageUrl: string | null;
  nationSlug: string | null;
  positionName: string | null;
  positionKey: string | null;
  /** Ranking score used for this board (OVR or position score). */
  rankingScore: number;
  /** Display R365 rating (OVR). */
  r365Rating: number | null;
  formScore: number | null;
  formBlocks: Array<{ rating: number; band: string }>;
  internationalPerformance: number | null;
  clubPerformance: number | null;
  positionPerformance: number | null;
  eligibleMinutes: number | null;
  eligibleAppearances: number | null;
  modelVersion: string;
  breakdownTitle: string;
};

export type PublicRankingBoard = {
  mode: PlayerRankingMode;
  status: "ready" | "building" | "under_development" | "provisional";
  title: string;
  filterKey: string;
  filters: PlayerRankingBoardFilters;
  pool: number;
  modelVersion: string;
  eligibilityNote: string;
  calculatedAt: string | null;
  fromSnapshot: boolean;
  rows: PublicRankingBoardRow[];
  positionLabel: string | null;
  nationLabel: string | null;
  clubLabel: string | null;
  competitionLabel: string | null;
};

export type RankingFilterOptions = {
  positions: Array<{ key: string; label: string }>;
  nations: string[];
  clubs: Array<{ id: string; name: string; slug: string }>;
  competitions: Array<{ id: string; name: string; slug: string }>;
  eras: Array<{ key: string; label: string }>;
  topOptions: number[];
};

function positionLabelForKey(key: string | null): string | null {
  if (!key) return null;
  return RANKING_POSITION_GROUPS.find((g) => g.key === key)?.label ?? key;
}

function matchesPositionFilter(
  groupKey: string | null | undefined,
  filterKey: string | null,
): boolean {
  if (!filterKey) return true;
  if (!groupKey) return false;
  if (groupKey === filterKey) return true;
  // Coarse aliases
  if (filterKey === "back_row") {
    return groupKey === "flanker" || groupKey === "number_eight" || groupKey === "back_row";
  }
  if (filterKey === "centre") {
    return (
      groupKey === "inside_centre" || groupKey === "outside_centre" || groupKey === "centre"
    );
  }
  return false;
}

async function loadRecentSampleByPlayer(): Promise<
  Map<string, { minutes: number; appearances: number }>
> {
  const db = getDb();
  const since = new Date(
    Date.now() - PLAYER_RANKING_ELIGIBILITY.rollingMonths * 30.44 * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const rows = await db
      .select({
        playerId: playerMatchPerformanceStats.playerId,
        minutes: sql<number>`coalesce(sum(${playerMatchPerformanceStats.minutesPlayed}), 0)`,
        appearances: sql<number>`count(*) filter (where ${playerMatchPerformanceStats.minutesPlayed} > 0)`,
      })
      .from(playerMatchPerformanceStats)
      .innerJoin(fixtures, eq(fixtures.id, playerMatchPerformanceStats.fixtureId))
      .where(sql`${fixtures.kickoffAt} > ${since}::timestamptz`)
      .groupBy(playerMatchPerformanceStats.playerId);

    const map = new Map<string, { minutes: number; appearances: number }>();
    for (const r of rows) {
      map.set(r.playerId, {
        minutes: Number(r.minutes) || 0,
        appearances: Number(r.appearances) || 0,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function resolveCompetitionTeamIds(
  competitionKey: string,
): Promise<{ competitionId: string | null; name: string | null; teamIds: string[] }> {
  const db = getDb();
  const sinceIso = new Date(
    Date.now() - RANKING_ACTIVE_MONTHS * 30.44 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const needle = competitionKey.trim().toLowerCase();

  const [comp] = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
    .from(competitions)
    .where(
      sql`lower(${competitions.slug}) = ${needle} or lower(${competitions.name}) like ${`%${needle}%`}`,
    )
    .limit(1);

  if (!comp) return { competitionId: null, name: null, teamIds: [] };

  const home = await db
    .selectDistinct({ teamId: fixtures.homeTeamId })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, comp.id),
        sql`${fixtures.kickoffAt} > ${sinceIso}::timestamptz`,
        isNotNull(fixtures.homeTeamId),
      ),
    );
  const away = await db
    .selectDistinct({ teamId: fixtures.awayTeamId })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, comp.id),
        sql`${fixtures.kickoffAt} > ${sinceIso}::timestamptz`,
        isNotNull(fixtures.awayTeamId),
      ),
    );

  const teamIds = [
    ...new Set(
      [...home, ...away]
        .map((r) => r.teamId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  return { competitionId: comp.id, name: comp.name, teamIds };
}

async function loadCurrentSnapshot(filterKey: string): Promise<{
  id: string;
  title: string;
  pool: number;
  modelVersion: string;
  eligibilityNote: string | null;
  status: string;
  calculatedAt: Date;
  payload: unknown;
} | null> {
  const db = getDb();
  try {
    const [row] = await db
      .select({
        id: playerRankingBoardSnapshots.id,
        title: playerRankingBoardSnapshots.title,
        pool: playerRankingBoardSnapshots.pool,
        modelVersion: playerRankingBoardSnapshots.modelVersion,
        eligibilityNote: playerRankingBoardSnapshots.eligibilityNote,
        status: playerRankingBoardSnapshots.status,
        calculatedAt: playerRankingBoardSnapshots.calculatedAt,
        payload: playerRankingBoardSnapshots.payload,
      })
      .from(playerRankingBoardSnapshots)
      .where(
        and(
          eq(playerRankingBoardSnapshots.filterKey, filterKey),
          eq(playerRankingBoardSnapshots.isCurrent, true),
        ),
      )
      .orderBy(desc(playerRankingBoardSnapshots.calculatedAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

function snapshotFresh(calculatedAt: Date): boolean {
  const ageMs = Date.now() - calculatedAt.getTime();
  return ageMs < PLAYER_RANKING_ELIGIBILITY.snapshotMaxAgeHours * 60 * 60 * 1000;
}

async function persistBoardSnapshot(input: {
  filters: PlayerRankingBoardFilters;
  filterKey: string;
  title: string;
  pool: number;
  status: string;
  eligibilityNote: string;
  rows: PublicRankingBoardRow[];
  positionLabel: string | null;
  nationLabel: string | null;
  clubLabel: string | null;
  competitionLabel: string | null;
}): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(playerRankingBoardSnapshots)
      .set({ isCurrent: false })
      .where(
        and(
          eq(playerRankingBoardSnapshots.filterKey, input.filterKey),
          eq(playerRankingBoardSnapshots.isCurrent, true),
        ),
      );

    await db.insert(playerRankingBoardSnapshots).values({
      mode: input.filters.mode,
      filterKey: input.filterKey,
      positionKey: input.filters.position,
      nationKey: input.filters.nation,
      clubKey: input.filters.club,
      competitionKey: input.filters.competition,
      eraKey: input.filters.era,
      topN: input.filters.top,
      modelVersion: PLAYER_RANK_CURRENT_MODEL,
      pool: input.pool,
      title: input.title,
      payload: {
        rows: input.rows,
        labels: {
          position: input.positionLabel,
          nation: input.nationLabel,
          club: input.clubLabel,
          competition: input.competitionLabel,
        },
      },
      eligibilityNote: input.eligibilityNote,
      status: input.status,
      isCurrent: true,
      calculatedAt: new Date(),
    });

    // Per-player history for movement / profile cards (overall metric on this filter)
    const metricKey = input.filters.position ? "position" : "overall";
    const playerIds = input.rows.map((r) => r.playerId);
    if (playerIds.length) {
      await db
        .update(playerRankingHistory)
        .set({ isCurrent: false })
        .where(
          and(
            eq(playerRankingHistory.scope, "board"),
            eq(playerRankingHistory.metricKey, metricKey),
            eq(playerRankingHistory.modelVersion, PLAYER_RANK_CURRENT_MODEL),
            sql`${playerRankingHistory.positionKey} is not distinct from ${input.filters.position}`,
            sql`${playerRankingHistory.nationKey} is not distinct from ${input.filters.nation}`,
            sql`${playerRankingHistory.clubKey} is not distinct from ${input.filters.club}`,
            sql`${playerRankingHistory.competitionKey} is not distinct from ${input.filters.competition}`,
            eq(playerRankingHistory.isCurrent, true),
          ),
        );

      await db.insert(playerRankingHistory).values(
        input.rows.map((r) => ({
          playerId: r.playerId,
          scope: "board",
          metricKey,
          positionKey: input.filters.position,
          nationKey: input.filters.nation,
          clubKey: input.filters.club,
          competitionKey: input.filters.competition,
          rank: r.rank,
          pool: input.pool,
          score: r.rankingScore,
          status: r.provisional ? "provisional" : "current",
          modelVersion: PLAYER_RANK_CURRENT_MODEL,
          isCurrent: true,
          calculatedAt: new Date(),
        })),
      );
    }
  } catch {
    // Table may not exist yet — page still returns live-computed board.
  }
}

async function previousRanksForFilter(filters: PlayerRankingBoardFilters): Promise<Map<string, number>> {
  const db = getDb();
  const filterKey = buildRankingFilterKey(filters);
  try {
    const [prev] = await db
      .select({
        payload: playerRankingBoardSnapshots.payload,
      })
      .from(playerRankingBoardSnapshots)
      .where(
        and(
          eq(playerRankingBoardSnapshots.filterKey, filterKey),
          eq(playerRankingBoardSnapshots.isCurrent, false),
        ),
      )
      .orderBy(desc(playerRankingBoardSnapshots.calculatedAt))
      .limit(1);

    const map = new Map<string, number>();
    const rows = (prev?.payload as { rows?: PublicRankingBoardRow[] } | null)?.rows;
    if (!Array.isArray(rows)) return map;
    for (const r of rows) {
      if (r.playerId && r.rank != null) map.set(r.playerId, r.rank);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function buildCurrentBoard(filters: PlayerRankingBoardFilters): Promise<PublicRankingBoard> {
  const db = getDb();
  const filterKey = buildRankingFilterKey(filters);
  const top = normalizeRankingTop(filters.top);
  const positionLabel = positionLabelForKey(filters.position);
  let competitionLabel: string | null = null;
  let competitionTeamIds: Set<string> | null = null;

  if (filters.competition) {
    const resolved = await resolveCompetitionTeamIds(filters.competition);
    competitionLabel = resolved.name;
    competitionTeamIds = new Set(resolved.teamIds);
  }

  const sampleMap = await loadRecentSampleByPlayer();

  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      imageUrl: players.imageUrl,
      countryName: players.countryName,
      positionName: players.positionName,
      clubName: players.clubName,
      clubTeamId: players.clubTeamId,
      careerStatus: players.careerStatus,
      internationalTeamId: players.internationalTeamId,
      overall: playerRatings.playerRating,
      form: playerRatings.formScore,
      attack: playerRatings.attackRating,
      defence: playerRatings.defenceRating,
      playmaking: playerRatings.playmakingRating,
      kicking: playerRatings.kickingRating,
      gameManagement: playerRatings.gameManagementRating,
      physical: playerRatings.physicalRating,
      reputation: playerRatings.reputation,
      seasonRating: playerRatings.seasonRating,
      dataPoints: playerRatings.dataPoints,
      lastFive: playerRatings.lastFiveMatchRatings,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamImageUrl: teams.imageUrl,
    })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .leftJoin(teams, eq(teams.id, players.clubTeamId))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(playerRatings.playerRating),
        sql`lower(coalesce(${players.careerStatus}, 'active')) not in ('retired', 'inactive', 'deceased')`,
      ),
    );

  // Nation crest lookup (international team)
  const nationIds = [
    ...new Set(rows.map((r) => r.internationalTeamId).filter((id): id is string => Boolean(id))),
  ];
  const nationById = new Map<string, { name: string; slug: string; imageUrl: string | null }>();
  if (nationIds.length) {
    const nationRows = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        imageUrl: teams.imageUrl,
      })
      .from(teams)
      .where(inArray(teams.id, nationIds));
    for (const n of nationRows) {
      nationById.set(n.id, { name: n.name, slug: n.slug, imageUrl: n.imageUrl });
    }
  }

  let clubLabel: string | null = null;
  const clubNeedle = filters.club?.trim().toLowerCase() || null;

  type Candidate = {
    row: (typeof rows)[number];
    score: number;
    positionKey: string | null;
    positionScore: number | null;
    minutes: number | null;
    appearances: number | null;
    provisional: boolean;
  };

  const candidates: Candidate[] = [];
  const usePositionScore = Boolean(filters.position);

  for (const r of rows) {
    const posGroup = resolveRankingPositionGroup(r.positionName);
    if (!matchesPositionFilter(posGroup?.key, filters.position)) continue;

    const nationName = r.countryName?.trim() || null;
    if (filters.nation) {
      const want = filters.nation.trim().toLowerCase();
      const intl = r.internationalTeamId ? nationById.get(r.internationalTeamId) : null;
      const hay = `${nationName ?? ""} ${intl?.name ?? ""}`.toLowerCase();
      if (!hay.includes(want) && (nationName ?? "").toLowerCase() !== want) continue;
    }

    if (clubNeedle) {
      const teamMatch =
        (r.clubTeamId && r.clubTeamId === filters.club) ||
        (r.teamSlug && r.teamSlug.toLowerCase() === clubNeedle) ||
        (r.teamName && r.teamName.toLowerCase().includes(clubNeedle)) ||
        (r.clubName && r.clubName.toLowerCase().includes(clubNeedle));
      if (!teamMatch) continue;
      clubLabel = r.teamName ?? r.clubName ?? clubLabel;
    }

    if (competitionTeamIds) {
      if (!r.clubTeamId || !competitionTeamIds.has(r.clubTeamId)) continue;
    }

    const sample = sampleMap.get(r.id) ?? null;
    const eligibility = isEligibleForCurrentRanking({
      minutes12m: sample?.minutes ?? null,
      appearances12m: sample?.appearances ?? null,
      dataPoints: r.dataPoints ?? 0,
      careerStatus: r.careerStatus,
    });
    if (!eligibility.eligible) continue;

    const positionScore = computePositionRankingScore({
      positionGroup: posGroup?.key,
      overall: r.overall,
      attack: r.attack,
      defence: r.defence,
      playmaking: r.playmaking,
      kicking: r.kicking,
      gameManagement: r.gameManagement,
      physical: r.physical,
      form: r.form,
    });

    const score = usePositionScore
      ? positionScore ?? r.overall
      : r.overall;
    if (score == null || !Number.isFinite(score)) continue;

    candidates.push({
      row: r,
      score,
      positionKey: posGroup?.key ?? null,
      positionScore,
      minutes: sample?.minutes ?? null,
      appearances: sample?.appearances ?? null,
      provisional: eligibility.provisional,
    });
  }

  if (clubNeedle && !clubLabel) {
    const [club] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(
        sql`lower(${teams.slug}) = ${clubNeedle} or lower(${teams.name}) like ${`%${clubNeedle}%`}`,
      )
      .limit(1);
    clubLabel = club?.name ?? filters.club;
  }

  const nationLabel = filters.nation?.trim() || null;
  const title = buildPlayerRankingsTitle({
    mode: "current",
    top,
    positionLabel,
    nationLabel,
    clubLabel,
    competitionLabel,
  });

  const scored: ScoredMember[] = candidates.map((c) => ({
    playerId: c.row.id,
    score: c.score,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const rankMap = denseRankWithTies(sorted);
  const pool = candidates.length;
  const prevRanks = await previousRanksForFilter(filters);

  const boardRows: PublicRankingBoardRow[] = candidates
    .map((c) => {
      const rank = rankMap.get(c.row.id) ?? null;
      const fmt = formatRankingDisplay({ rank, pool });
      const previousRank = prevRanks.get(c.row.id) ?? null;
      const movement = rankingMovement(fmt.showRank ? rank : null, previousRank);
      const intl =
        c.row.internationalTeamId != null
          ? nationById.get(c.row.internationalTeamId)
          : null;
      const formBlocks = parseLastFiveFormBlocks(c.row.lastFive);
      const r365 = c.row.overall != null ? Math.round(c.row.overall * 10) / 10 : null;
      const intlPerf =
        c.row.reputation != null && Number.isFinite(c.row.reputation)
          ? Math.round(c.row.reputation * 10) / 10
          : null;
      const clubPerf =
        c.row.seasonRating != null && Number.isFinite(c.row.seasonRating)
          ? Math.round(c.row.seasonRating * 10) / 10
          : null;
      const posPerf =
        c.positionScore != null ? Math.round(c.positionScore * 10) / 10 : null;

      return {
        rank: rank ?? 0,
        rankDisplay: fmt.rankDisplay,
        provisional: fmt.provisional || c.provisional,
        movement,
        previousRank,
        playerId: c.row.id,
        slug: c.row.slug,
        name: c.row.name,
        imageUrl: c.row.imageUrl,
        teamId: c.row.clubTeamId,
        teamName: c.row.teamName ?? c.row.clubName,
        teamImageUrl: c.row.teamImageUrl,
        teamSlug: c.row.teamSlug,
        nationName: c.row.countryName ?? intl?.name ?? null,
        nationImageUrl: intl?.imageUrl ?? null,
        nationSlug: intl?.slug ?? null,
        positionName: c.row.positionName,
        positionKey: c.positionKey,
        rankingScore: Math.round(c.score * 10) / 10,
        r365Rating: r365,
        formScore: c.row.form != null ? Math.round(c.row.form * 10) / 10 : null,
        formBlocks,
        internationalPerformance: intlPerf,
        clubPerformance: clubPerf,
        positionPerformance: posPerf,
        eligibleMinutes: c.minutes,
        eligibleAppearances: c.appearances,
        modelVersion: PLAYER_RANK_CURRENT_MODEL,
        breakdownTitle: [
          `R365 Ranking Score ${Math.round(c.score * 10) / 10}`,
          posPerf != null ? `Position ${posPerf}` : null,
          intlPerf != null ? `International ${intlPerf}` : null,
          clubPerf != null ? `Club ${clubPerf}` : null,
          c.row.form != null ? `Form ${Math.round(c.row.form * 10) / 10}` : null,
          `Model ${PLAYER_RANK_CURRENT_MODEL}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .sort((a, b) => a.rank - b.rank || b.rankingScore - a.rankingScore)
    .slice(0, top);

  // Gold #1 display preference — keep formatRankingDisplay output but promote #1 styling in UI
  const eligibilityNote = `Minimum eligibility: ${PLAYER_RANKING_ELIGIBILITY.minMinutes} minutes or ${PLAYER_RANKING_ELIGIBILITY.minAppearances} appearances in ${PLAYER_RANKING_ELIGIBILITY.rollingMonths} months (configurable). Rankings calculated by the R365 Rating Model (${PLAYER_RANK_CURRENT_MODEL}).`;

  const status: PublicRankingBoard["status"] =
    pool < 5 ? "building" : pool < 10 ? "provisional" : "ready";

  const board: PublicRankingBoard = {
    mode: "current",
    status,
    title,
    filterKey,
    filters: { ...filters, top },
    pool,
    modelVersion: PLAYER_RANK_CURRENT_MODEL,
    eligibilityNote,
    calculatedAt: new Date().toISOString(),
    fromSnapshot: false,
    rows: boardRows,
    positionLabel,
    nationLabel,
    clubLabel,
    competitionLabel: competitionLabel
      ? shortCompetitionLabel(competitionLabel) || competitionLabel
      : null,
  };

  await persistBoardSnapshot({
    filters: board.filters,
    filterKey,
    title,
    pool,
    status,
    eligibilityNote,
    rows: boardRows,
    positionLabel,
    nationLabel,
    clubLabel,
    competitionLabel: board.competitionLabel,
  });

  return board;
}

function allTimeScaffold(filters: PlayerRankingBoardFilters): PublicRankingBoard {
  const top = normalizeRankingTop(filters.top);
  const positionLabel = positionLabelForKey(filters.position);
  const title = buildPlayerRankingsTitle({
    mode: "alltime",
    top,
    positionLabel,
    nationLabel: filters.nation,
    clubLabel: filters.club,
    competitionLabel: filters.competition,
  });
  return {
    mode: "alltime",
    status: "under_development",
    title,
    filterKey: buildRankingFilterKey({ ...filters, top }),
    filters: { ...filters, top },
    pool: 0,
    modelVersion: PLAYER_RANK_ALLTIME_MODEL,
    eligibilityNote:
      "All-Time rankings use a separate methodology (career / peak / honours / longevity). Historical coverage is not yet sufficient to publish scores — this board is under development.",
    calculatedAt: null,
    fromSnapshot: false,
    rows: [],
    positionLabel,
    nationLabel: filters.nation,
    clubLabel: filters.club,
    competitionLabel: filters.competition,
  };
}

export async function getPublicPlayerRankingsBoard(
  input: Partial<PlayerRankingBoardFilters> & { forceRebuild?: boolean } = {},
): Promise<PublicRankingBoard> {
  const filters: PlayerRankingBoardFilters = {
    mode: input.mode === "alltime" ? "alltime" : "current",
    position: input.position?.trim() || null,
    nation: input.nation?.trim() || null,
    club: input.club?.trim() || null,
    competition: input.competition?.trim() || null,
    top: normalizeRankingTop(input.top),
    era: input.era?.trim() || "all",
  };

  if (filters.mode === "alltime") {
    return allTimeScaffold(filters);
  }

  const filterKey = buildRankingFilterKey(filters);
  if (!input.forceRebuild) {
    const snap = await loadCurrentSnapshot(filterKey);
    if (snap && snapshotFresh(snap.calculatedAt)) {
      const payload = snap.payload as {
        rows?: PublicRankingBoardRow[];
        labels?: {
          position?: string | null;
          nation?: string | null;
          club?: string | null;
          competition?: string | null;
        };
      };
      return {
        mode: "current",
        status:
          snap.status === "building" || snap.status === "provisional" || snap.status === "ready"
            ? (snap.status as PublicRankingBoard["status"])
            : "ready",
        title: snap.title,
        filterKey,
        filters,
        pool: snap.pool,
        modelVersion: snap.modelVersion,
        eligibilityNote:
          snap.eligibilityNote ??
          `Rankings calculated by the R365 Rating Model (${PLAYER_RANK_CURRENT_MODEL}).`,
        calculatedAt: snap.calculatedAt.toISOString(),
        fromSnapshot: true,
        rows: Array.isArray(payload?.rows) ? payload.rows.slice(0, filters.top) : [],
        positionLabel: payload?.labels?.position ?? positionLabelForKey(filters.position),
        nationLabel: payload?.labels?.nation ?? filters.nation,
        clubLabel: payload?.labels?.club ?? null,
        competitionLabel: payload?.labels?.competition ?? null,
      };
    }
  }

  return buildCurrentBoard(filters);
}

export async function listRankingFilterOptions(): Promise<RankingFilterOptions> {
  const db = getDb();

  const nationRows = await db
    .selectDistinct({ countryName: players.countryName })
    .from(players)
    .innerJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(players.countryName),
        isNotNull(playerRatings.playerRating),
      ),
    );

  const nations = nationRows
    .map((r) => r.countryName?.trim())
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b));

  const clubRows = await db
    .selectDistinct({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
    })
    .from(teams)
    .innerJoin(players, eq(players.clubTeamId, teams.id))
    .innerJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(playerRatings.playerRating),
        sql`lower(coalesce(${teams.teamType}, 'club')) not in ('international', 'national')`,
      ),
    )
    .orderBy(teams.name)
    .limit(400);

  const compRows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
    })
    .from(competitions)
    .where(sql`coalesce(${competitions.lifecycleStatus}, 'current') <> 'former'`)
    .orderBy(competitions.name)
    .limit(200);

  return {
    positions: PUBLIC_RANKING_POSITION_FILTERS.map((p) => ({ key: p.key, label: p.label })),
    nations,
    clubs: clubRows,
    competitions: compRows,
    eras: ALLTIME_ERA_OPTIONS.map((e) => ({ key: e.key, label: e.label })),
    topOptions: [10, 25, 50, 100],
  };
}
