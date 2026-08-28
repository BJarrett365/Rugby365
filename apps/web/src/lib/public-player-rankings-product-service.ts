/**
 * Public PLAYER RANKINGS product — CURRENT + ALL-TIME boards from persisted snapshots.
 */
import "server-only";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  competitions,
  fixtures,
  playerCareerStints,
  playerLegendScores,
  playerLegends,
  playerMatchPerformanceStats,
  playerRankingBoardSnapshots,
  playerRankingHistory,
  playerRatingHistory,
  playerRatings,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { cachedPublic, PUBLIC_CACHE_TTL } from "./public-data-cache";
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
  cleanRankingClubName,
  cleanRankingPlayerName,
  computePositionRankingScore,
  computeRatingMovementDelta,
  denseRankWithTies,
  estimateRankingMovement,
  formatRankingDisplay,
  isDirtyRankingPlayerName,
  isEligibleForCurrentRanking,
  normalizeRankingTop,
  parseLastFiveFormBlocks,
  pickCareerClubName,
  rankingCountryFlagUrl,
  rankingMovement,
  resolveRankingPositionGroup,
  shortCompetitionLabel,
  usableRankingCountryName,
  type PlayerRankingBoardFilters,
  type PlayerRankingMode,
  type ScoredMember,
} from "./player-ranking-engine";
import { parseNationalityFromBirthPlace } from "@rugby365/import-sdk";
import { isRankingRetired } from "./competition-ranking-math";
import { isKnownInternationalCountryName } from "./international-team-classify";

type NationBadge = { name: string; slug: string; imageUrl: string | null };

export type PublicRankingBoardRow = {
  rank: number;
  rankDisplay: string;
  provisional: boolean;
  movement: "up" | "down" | "flat" | null;
  previousRank: number | null;
  /** Rating-points movement (e.g. +1.4 / -2.1) from recent vs prior form. */
  movementDelta: number | null;
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
  /** All-time peak rating (0–100). */
  peakRating: number | null;
  /** All-time impact / legend overall score. */
  impactScore: number | null;
  eligibleMinutes: number | null;
  eligibleAppearances: number | null;
  modelVersion: string;
  breakdownTitle: string;
  retired: boolean;
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
  const modelVersion =
    input.filters.mode === "alltime" ? PLAYER_RANK_ALLTIME_MODEL : PLAYER_RANK_CURRENT_MODEL;
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
      modelVersion,
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
            eq(playerRankingHistory.modelVersion, modelVersion),
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
          modelVersion,
          isCurrent: true,
          calculatedAt: new Date(),
        })),
      );
    }
  } catch {
    // Table may not exist yet — page still returns live-computed board.
  }
}

async function previousRanksForFilter(
  filters: PlayerRankingBoardFilters,
  source: "current" | "previous",
): Promise<Map<string, number>> {
  const db = getDb();
  const filterKey = buildRankingFilterKey(filters);
  try {
    const snaps = await db
      .select({
        payload: playerRankingBoardSnapshots.payload,
      })
      .from(playerRankingBoardSnapshots)
      .where(eq(playerRankingBoardSnapshots.filterKey, filterKey))
      .orderBy(desc(playerRankingBoardSnapshots.calculatedAt))
      .limit(source === "current" ? 1 : 2);

    const prev = source === "current" ? snaps[0] : snaps[1];
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

function hydrateBoardMovement(
  board: PublicRankingBoard,
  prevRanks: Map<string, number>,
): PublicRankingBoard {
  return {
    ...board,
    rows: board.rows.map((row) => {
      const nationName = usableRankingCountryName(row.nationName);
      const flag = rankingCountryFlagUrl(nationName);
      const previousRank = row.previousRank ?? prevRanks.get(row.playerId) ?? null;
      const rankMove = rankingMovement(row.rank, previousRank);
      return {
        ...row,
        teamName: row.teamName === "Unassigned" ? null : row.teamName,
        nationName,
        nationImageUrl: flag ?? row.nationImageUrl,
        previousRank,
        movement: rankMove ?? row.movement,
        retired: Boolean(row.retired),
      };
    }),
  };
}

function ratingOnHundred(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const scaled = value > 10 ? value : value * 10;
  return Math.round(Math.min(99, Math.max(0, scaled)));
}

/** Newest-first overall ratings from history (0–100 scale preferred). */
async function loadRatingSeriesByPlayer(
  playerIds: string[],
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (!playerIds.length) return map;
  const db = getDb();
  try {
    const rows = await db
      .select({
        playerId: playerRatingHistory.playerId,
        overall: playerRatingHistory.overallRating,
        matchDate: playerRatingHistory.matchDate,
        calculatedAt: playerRatingHistory.calculatedAt,
      })
      .from(playerRatingHistory)
      .where(inArray(playerRatingHistory.playerId, playerIds))
      .orderBy(
        desc(playerRatingHistory.matchDate),
        desc(playerRatingHistory.calculatedAt),
      );

    for (const r of rows) {
      if (r.overall == null || !Number.isFinite(r.overall)) continue;
      const list = map.get(r.playerId) ?? [];
      if (list.length < 12) list.push(Number(r.overall));
      map.set(r.playerId, list);
    }
  } catch {
    // best-effort
  }
  return map;
}

async function loadCareerClubByPlayer(
  playerIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!playerIds.length) return map;
  const db = getDb();
  try {
    const rows = await db
      .select({
        playerId: playerCareerStints.playerId,
        teamName: playerCareerStints.teamName,
        careerType: playerCareerStints.careerType,
        endYear: playerCareerStints.endYear,
        sortOrder: playerCareerStints.sortOrder,
      })
      .from(playerCareerStints)
      .where(inArray(playerCareerStints.playerId, playerIds));

    const byPlayer = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byPlayer.get(r.playerId) ?? [];
      list.push(r);
      byPlayer.set(r.playerId, list);
    }
    for (const [playerId, stints] of byPlayer) {
      const club = pickCareerClubName(stints);
      if (club) map.set(playerId, club);
    }
  } catch {
    // best-effort
  }
  return map;
}

function resolveBoardClub(input: {
  teamName: string | null;
  clubName: string | null;
  teamSlug: string | null;
  teamImageUrl: string | null;
  teamId: string | null;
  teamCountryName: string | null;
  careerClub: string | null;
  crestByName: Map<string, { id: string; slug: string; imageUrl: string | null; countryName: string | null }>;
}): {
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamImageUrl: string | null;
  teamCountryName: string | null;
} {
  const fromTeam = cleanRankingClubName(input.teamName);
  const fromClub = cleanRankingClubName(input.clubName);
  const fromCareer = cleanRankingClubName(input.careerClub);
  const name = fromTeam ?? fromClub ?? fromCareer;
  if (!name) {
    return {
      teamId: null,
      teamName: null,
      teamSlug: null,
      teamImageUrl: null,
      teamCountryName: null,
    };
  }
  const crest = input.crestByName.get(name.toLowerCase());
  const countryName = input.teamCountryName ?? crest?.countryName ?? null;
  if (fromTeam && input.teamImageUrl) {
    return {
      teamId: input.teamId,
      teamName: name,
      teamSlug: input.teamSlug,
      teamImageUrl: input.teamImageUrl,
      teamCountryName: countryName,
    };
  }
  if (crest) {
    return {
      teamId: crest.id,
      teamName: name,
      teamSlug: crest.slug,
      teamImageUrl: crest.imageUrl ?? input.teamImageUrl,
      teamCountryName: crest.countryName ?? countryName,
    };
  }
  return {
    teamId: fromTeam ? input.teamId : null,
    teamName: name,
    teamSlug: fromTeam ? input.teamSlug : null,
    teamImageUrl: fromTeam ? input.teamImageUrl : null,
    teamCountryName: countryName,
  };
}

async function loadNationBadgeByCountryName(
  countryNames: string[],
): Promise<Map<string, NationBadge>> {
  const map = new Map<string, NationBadge>();
  const names = [
    ...new Set(
      countryNames
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => n.toLowerCase()),
    ),
  ];
  if (!names.length) return map;
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        imageUrl: teams.imageUrl,
      })
      .from(teams)
      .where(
        and(
          sql`lower(${teams.name}) in (${sql.join(
            names.map((n) => sql`${n}`),
            sql`, `,
          )})`,
          sql`${teams.slug} not like '%__legacy__%'`,
          sql`${teams.name} not ilike '%u20%'`,
          sql`${teams.name} not ilike '%u18%'`,
          sql`${teams.name} not ilike '%schools%'`,
          sql`${teams.name} not ilike '%sevens%'`,
          sql`${teams.name} not ilike '%7''s%'`,
          sql`${teams.name} not ilike '% A'`,
        ),
      )
      .orderBy(
        sql`case when ${teams.imageUrl} is not null then 0 else 1 end`,
        sql`length(${teams.name})`,
      );
    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: r.name, slug: r.slug, imageUrl: r.imageUrl });
      } else if (!map.get(key)?.imageUrl && r.imageUrl) {
        map.set(key, { name: r.name, slug: r.slug, imageUrl: r.imageUrl });
      }
    }
  } catch {
    // best-effort
  }
  return map;
}

function resolveNationBadge(input: {
  countryName: string | null;
  nationCode?: string | null;
  birthPlace?: string | null;
  clubCountryName?: string | null;
  internationalTeamId: string | null;
  nationById: Map<string, NationBadge>;
  nationByName: Map<string, NationBadge>;
}): { nationName: string | null; nationSlug: string | null; nationImageUrl: string | null } {
  const intl =
    input.internationalTeamId != null
      ? input.nationById.get(input.internationalTeamId)
      : null;
  const intlCountry = isKnownInternationalCountryName(intl?.name) ? intl?.name ?? null : null;
  const fromBirth = parseNationalityFromBirthPlace(input.birthPlace ?? undefined);
  const clubCountry =
    rankingCountryFlagUrl(input.clubCountryName) != null
      ? usableRankingCountryName(input.clubCountryName)
      : null;
  const country =
    usableRankingCountryName(input.countryName) ||
    usableRankingCountryName(intlCountry) ||
    usableRankingCountryName(fromBirth) ||
    clubCountry;
  const byName = country ? input.nationByName.get(country.trim().toLowerCase()) : null;
  const flag = rankingCountryFlagUrl(country, input.nationCode);
  return {
    nationName: country,
    nationSlug: intl?.slug ?? byName?.slug ?? null,
    nationImageUrl: flag ?? intl?.imageUrl ?? byName?.imageUrl ?? null,
  };
}

async function loadCrestByClubName(
  clubNames: string[],
): Promise<Map<string, { id: string; slug: string; imageUrl: string | null; countryName: string | null }>> {
  const map = new Map<string, { id: string; slug: string; imageUrl: string | null; countryName: string | null }>();
  const names = [...new Set(clubNames.map((n) => n.trim()).filter(Boolean))];
  if (!names.length) return map;
  const aliases: Record<string, string[]> = {
    force: ["western force", "force"],
    "western force": ["western force", "force"],
    "rugby rovigo": ["rugby rovigo", "rovigo delta", "rovigo"],
    "queensland reds": ["queensland reds", "reds"],
    reds: ["reds", "queensland reds"],
    "nsw waratahs": ["nsw waratahs", "waratahs"],
    waratahs: ["waratahs", "nsw waratahs"],
    "aviron bayonnais": ["aviron bayonnais", "bayonne", "bayonnais"],
    bayonne: ["bayonne", "aviron bayonnais", "bayonnais"],
    bayonnais: ["bayonnais", "aviron bayonnais", "bayonne"],
    "kintetsu liners": ["kintetsu liners", "hanazono kintetsu liners"],
    "toshiba brave lupus": ["toshiba brave lupus", "toshiba brave lupus tokyo", "brave lupus tokyo"],
    "golden lions": ["golden lions", "lions", "emirates lions"],
    lions: ["lions", "golden lions", "emirates lions"],
    "panasonic wild knights": ["panasonic wild knights", "saitama wild knights", "wild knights"],
    "honda heat": ["honda heat", "mie honda heat"],
    "ulster rugby": ["ulster rugby", "ulster"],
    ulster: ["ulster", "ulster rugby"],
    leopards: ["leopards", "nw leopards"],
  };
  const lookupNames = [
    ...new Set(
      names.flatMap((n) => {
        const key = n.toLowerCase();
        return aliases[key] ?? [key];
      }),
    ),
  ];
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        imageUrl: teams.imageUrl,
        countryName: teams.countryName,
      })
      .from(teams)
      .where(
        and(
          sql`lower(${teams.name}) in (${sql.join(
            lookupNames.map((n) => sql`${n}`),
            sql`, `,
          )})`,
          sql`${teams.name} not ilike 'unknown team%'`,
          sql`${teams.slug} not like '%__legacy__%'`,
          sql`${teams.slug} not like '%flagicon%'`,
        ),
      )
      .orderBy(
        sql`case when ${teams.countryName} is not null then 0 else 1 end`,
        sql`case when ${teams.imageUrl} is not null then 0 else 1 end`,
        teams.name,
      );

    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      const next = { id: r.id, slug: r.slug, imageUrl: r.imageUrl, countryName: r.countryName };
      if (!map.has(key)) {
        map.set(key, next);
      } else {
        const cur = map.get(key)!;
        if ((!cur.imageUrl && r.imageUrl) || (!cur.countryName && r.countryName)) {
          map.set(key, {
            ...cur,
            imageUrl: cur.imageUrl ?? r.imageUrl,
            countryName: cur.countryName ?? r.countryName,
          });
        }
      }
    }
    // Mirror aliased names onto requested club labels
    for (const requested of names) {
      const key = requested.toLowerCase();
      if (map.get(key)?.imageUrl) continue;
      for (const alias of aliases[key] ?? []) {
        const hit = map.get(alias);
        if (hit?.imageUrl) {
          map.set(key, hit);
          break;
        }
      }
    }
  } catch {
    // best-effort
  }
  return map;
}

async function loadBestPlayerImages(
  playerIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!playerIds.length) return map;
  const db = getDb();
  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (player_id)
        player_id,
        image_url
      FROM player_images
      WHERE player_id IN (${sql.join(
        playerIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
        AND archived_at IS NULL
        AND image_url IS NOT NULL
        AND status IN ('approved', 'candidate')
      ORDER BY player_id,
        CASE role WHEN 'primary' THEN 0 WHEN 'legend' THEN 1 WHEN 'portrait' THEN 2 ELSE 3 END,
        confidence_score DESC NULLS LAST
    `);
    const list =
      (rows as unknown as { rows?: Array<{ player_id: string; image_url: string }> }).rows ??
      (rows as unknown as Array<{ player_id: string; image_url: string }>);
    for (const r of list) {
      if (r.image_url) map.set(r.player_id, r.image_url);
    }
  } catch {
    // best-effort
  }
  return map;
}

function movementFromSeries(
  seriesNewestFirst: number[] | undefined,
  lastFive: unknown,
  rankMovement: "up" | "down" | "flat" | null,
  estimateInput: Parameters<typeof estimateRankingMovement>[0],
): { movement: "up" | "down" | "flat"; movementDelta: number } {
  const fromHistory =
    seriesNewestFirst?.length ? computeRatingMovementDelta(seriesNewestFirst, 5) : null;
  if (fromHistory) {
    return { movement: fromHistory.movement, movementDelta: fromHistory.delta };
  }
  const chronological = parseLastFiveFormBlocks(lastFive).map((b) => b.rating);
  const fromLastFive =
    chronological.length >= 2
      ? computeRatingMovementDelta([...chronological].reverse(), 5)
      : null;
  if (fromLastFive) {
    return { movement: fromLastFive.movement, movementDelta: fromLastFive.delta };
  }
  const estimated = estimateRankingMovement(estimateInput);
  if (rankMovement && rankMovement !== "flat" && Math.abs(estimated.delta) < 0.15) {
    // Prefer rank direction when estimate is near-zero but rank moved.
    return {
      movement: rankMovement,
      movementDelta: rankMovement === "up" ? 0.4 : rankMovement === "down" ? -0.4 : estimated.delta,
    };
  }
  return { movement: estimated.movement, movementDelta: estimated.delta };
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
      nationCode: players.nationCode,
      birthPlace: players.birthPlace,
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
      teamCountryName: teams.countryName,
    })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .leftJoin(teams, eq(teams.id, players.clubTeamId))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(playerRatings.playerRating),
        sql`lower(coalesce(${players.careerStatus}, 'active')) not in ('retired', 'inactive', 'deceased', 'legend')`,
      ),
    );

  // Nation crest lookup (international team)
  const nationIds = [
    ...new Set(rows.map((r) => r.internationalTeamId).filter((id): id is string => Boolean(id))),
  ];
  const nationById = new Map<string, NationBadge>();
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
  const nationByName = await loadNationBadgeByCountryName(
    rows.map((r) => r.countryName).filter((n): n is string => Boolean(n)),
  );

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
    if (!r?.id) continue;
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
  const prevRanks = await previousRanksForFilter(filters, "current");
  const candidateIds = candidates.map((c) => c.row.id);
  const [ratingSeries, careerClubs, galleryImages] = await Promise.all([
    loadRatingSeriesByPlayer(candidateIds),
    loadCareerClubByPlayer(candidateIds),
    loadBestPlayerImages(candidateIds),
  ]);
  const provisionalClubs = candidates.map((c) =>
    cleanRankingClubName(c.row.teamName) ??
    cleanRankingClubName(c.row.clubName) ??
    careerClubs.get(c.row.id) ??
    "",
  );
  const crestByName = await loadCrestByClubName(provisionalClubs.filter(Boolean));

  const boardRows: PublicRankingBoardRow[] = candidates
    .map((c) => {
      const rank = rankMap.get(c.row.id) ?? null;
      const fmt = formatRankingDisplay({ rank, pool });
      const previousRank = prevRanks.get(c.row.id) ?? null;
      const rankMove = rankingMovement(fmt.showRank ? rank : null, previousRank);
      const r365 = c.row.overall != null ? Math.round(c.row.overall * 10) / 10 : null;
      const { movement, movementDelta } = movementFromSeries(
        ratingSeries.get(c.row.id),
        c.row.lastFive,
        rankMove,
        {
          formScore: c.row.form,
          seasonRating: c.row.seasonRating,
          r365Rating: r365,
          careerRating: r365,
          peakRating: null,
        },
      );
      const club = resolveBoardClub({
        teamName: c.row.teamName,
        clubName: c.row.clubName,
        teamSlug: c.row.teamSlug,
        teamImageUrl: c.row.teamImageUrl,
        teamId: c.row.clubTeamId,
        teamCountryName: c.row.teamCountryName ?? null,
        careerClub: careerClubs.get(c.row.id) ?? null,
        crestByName,
      });
      const nation = resolveNationBadge({
        countryName: c.row.countryName,
        nationCode: c.row.nationCode,
        birthPlace: c.row.birthPlace,
        clubCountryName: club.teamCountryName,
        internationalTeamId: c.row.internationalTeamId,
        nationById,
        nationByName,
      });
      const formBlocks = parseLastFiveFormBlocks(c.row.lastFive, {
        padTo: 5,
        formScore: c.row.form ?? r365,
      });
      const intlPerf = ratingOnHundred(
        c.row.reputation != null && Number.isFinite(c.row.reputation)
          ? c.row.reputation
          : c.row.internationalTeamId != null && r365 != null
            ? Math.min(99, r365 * 0.92 + 4)
            : r365 != null
              ? Math.min(99, r365 * 0.9)
              : null,
      );
      const clubPerf = ratingOnHundred(
        c.row.seasonRating != null && Number.isFinite(c.row.seasonRating)
          ? c.row.seasonRating
          : r365,
      );
      const posPerf = ratingOnHundred(c.positionScore);

      return {
        rank: rank ?? 0,
        rankDisplay: fmt.rankDisplay,
        provisional: fmt.provisional || c.provisional,
        movement,
        previousRank,
        movementDelta,
        playerId: c.row.id,
        slug: c.row.slug,
        name: cleanRankingPlayerName(c.row.name) || c.row.name,
        imageUrl: (() => {
          const raw = c.row.imageUrl || galleryImages.get(c.row.id) || null;
          if (!raw) return null;
          if (/noimage|placeholder|default.?player/i.test(raw)) return null;
          return raw;
        })(),
        teamId: club.teamId,
        teamName: club.teamName,
        teamImageUrl: club.teamImageUrl,
        teamSlug: club.teamSlug,
        nationName: nation.nationName,
        nationImageUrl: nation.nationImageUrl,
        nationSlug: nation.nationSlug,
        positionName: c.row.positionName,
        positionKey: c.positionKey,
        rankingScore: Math.round(c.score * 10) / 10,
        r365Rating: r365,
        formScore: c.row.form != null ? Math.round(c.row.form * 10) / 10 : null,
        formBlocks,
        internationalPerformance: intlPerf,
        clubPerformance: clubPerf,
        positionPerformance: posPerf,
        peakRating: null,
        impactScore: null,
        eligibleMinutes: c.minutes,
        eligibleAppearances: c.appearances,
        modelVersion: PLAYER_RANK_CURRENT_MODEL,
        retired: isRankingRetired({ careerStatus: c.row.careerStatus, name: c.row.name }),
        breakdownTitle: [
          `R365 Ranking Score ${Math.round(c.score * 10) / 10}`,
          posPerf != null ? `Position ${posPerf}` : null,
          intlPerf != null ? `International ${intlPerf}` : null,
          clubPerf != null ? `Club ${clubPerf}` : null,
          c.row.form != null ? `Form ${Math.round(c.row.form * 10) / 10}` : null,
          `Movement ${movementDelta > 0 ? "+" : ""}${movementDelta.toFixed(1)}`,
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

function eraMatchesFilter(eraRaw: string | null | undefined, filterEra: string | null): boolean {
  const era = (filterEra ?? "all").trim().toLowerCase();
  if (!era || era === "all") return true;
  const hay = (eraRaw ?? "").toLowerCase();
  if (!hay) return false;
  // Catalog eras are like "2010s"; board filter uses same keys.
  return hay.includes(era) || hay.startsWith(era.replace(/s$/, ""));
}

async function buildAllTimeBoard(filters: PlayerRankingBoardFilters): Promise<PublicRankingBoard> {
  const db = getDb();
  const filterKey = buildRankingFilterKey(filters);
  const top = normalizeRankingTop(filters.top);
  const positionLabel = positionLabelForKey(filters.position);
  let clubLabel: string | null = null;
  const clubNeedle = filters.club?.trim().toLowerCase() || null;

  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      imageUrl: players.imageUrl,
      countryName: players.countryName,
      nationCode: players.nationCode,
      birthPlace: players.birthPlace,
      positionName: players.positionName,
      clubName: players.clubName,
      clubTeamId: players.clubTeamId,
      internationalTeamId: players.internationalTeamId,
      overallScore: playerLegendScores.overallScore,
      careerRating: playerLegendScores.careerRating,
      peakRating: playerLegendScores.peakRating,
      clubScore: playerLegendScores.clubScore,
      internationalScore: playerLegendScores.internationalScore,
      legendEra: playerLegends.era,
      legendCountry: playerLegends.countryName,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamImageUrl: teams.imageUrl,
      teamCountryName: teams.countryName,
      form: playerRatings.formScore,
      lastFive: playerRatings.lastFiveMatchRatings,
      seasonRating: playerRatings.seasonRating,
      reputation: playerRatings.reputation,
    })
    .from(playerLegendScores)
    .innerJoin(players, eq(players.id, playerLegendScores.playerId))
    .innerJoin(
      playerLegends,
      and(eq(playerLegends.playerId, players.id), eq(playerLegends.legendStatus, "active")),
    )
    .leftJoin(teams, eq(teams.id, players.clubTeamId))
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        sql`${playerLegendScores.overallScore} > 0`,
      ),
    );

  const nationIds = [
    ...new Set(rows.map((r) => r.internationalTeamId).filter((id): id is string => Boolean(id))),
  ];
  const nationById = new Map<string, NationBadge>();
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
  const nationByName = await loadNationBadgeByCountryName(
    rows
      .flatMap((r) => [r.countryName, r.legendCountry])
      .filter((n): n is string => Boolean(n)),
  );

  type Candidate = {
    row: (typeof rows)[number];
    score: number;
    positionKey: string | null;
  };

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    if (!r?.id) continue;
    if (seen.has(r.id)) continue;
    // Prefer clean legend profiles; skip transfer-note duplicates ("… retired").
    if (isDirtyRankingPlayerName(r.name)) continue;
    seen.add(r.id);

    const posGroup = resolveRankingPositionGroup(r.positionName);
    if (!matchesPositionFilter(posGroup?.key, filters.position)) continue;
    if (!eraMatchesFilter(r.legendEra, filters.era)) continue;

    const nationName = r.countryName?.trim() || r.legendCountry?.trim() || null;
    if (filters.nation) {
      const want = filters.nation.trim().toLowerCase();
      const intl = r.internationalTeamId ? nationById.get(r.internationalTeamId) : null;
      const hay = `${nationName ?? ""} ${intl?.name ?? ""} ${r.legendCountry ?? ""}`.toLowerCase();
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

    const score = Number(r.overallScore);
    if (!Number.isFinite(score) || score <= 0) continue;

    candidates.push({
      row: r,
      score,
      positionKey: posGroup?.key ?? null,
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
    mode: "alltime",
    top,
    positionLabel,
    nationLabel,
    clubLabel,
    competitionLabel: filters.competition,
  });

  const scored: ScoredMember[] = candidates.map((c) => ({
    playerId: c.row.id,
    score: c.score,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const rankMap = denseRankWithTies(sorted);
  const pool = candidates.length;
  const prevRanks = await previousRanksForFilter(filters, "current");
  const candidateIds = candidates.map((c) => c.row.id);
  const [ratingSeries, careerClubs, galleryImages] = await Promise.all([
    loadRatingSeriesByPlayer(candidateIds),
    loadCareerClubByPlayer(candidateIds),
    loadBestPlayerImages(candidateIds),
  ]);
  const provisionalClubs = candidates.map(
    (c) =>
      cleanRankingClubName(c.row.teamName) ??
      cleanRankingClubName(c.row.clubName) ??
      careerClubs.get(c.row.id) ??
      "",
  );
  const crestByName = await loadCrestByClubName(provisionalClubs.filter(Boolean));

  const boardRows: PublicRankingBoardRow[] = candidates
    .map((c) => {
      const rank = rankMap.get(c.row.id) ?? null;
      const fmt = formatRankingDisplay({ rank, pool });
      const previousRank = prevRanks.get(c.row.id) ?? null;
      const rankMove = rankingMovement(fmt.showRank ? rank : null, previousRank);
      const peak =
        c.row.peakRating != null && Number.isFinite(c.row.peakRating)
          ? Math.round(c.row.peakRating * 10) / 10
          : null;
      const impact = Math.round(c.score * 10) / 10;
      const r365 =
        c.row.careerRating != null
          ? Math.round(c.row.careerRating * 10) / 10
          : impact;
      const formBlocks = parseLastFiveFormBlocks(c.row.lastFive, {
        padTo: 5,
        formScore: c.row.form ?? r365,
      });
      const { movement, movementDelta } = movementFromSeries(
        ratingSeries.get(c.row.id),
        c.row.lastFive,
        rankMove,
        {
          peakRating: peak,
          careerRating: r365,
          formScore: c.row.form,
          seasonRating: c.row.seasonRating,
          overallScore: impact,
          clubScore: c.row.clubScore,
          internationalScore: c.row.internationalScore,
          r365Rating: r365,
        },
      );
      const club = resolveBoardClub({
        teamName: c.row.teamName,
        clubName: c.row.clubName,
        teamSlug: c.row.teamSlug,
        teamImageUrl: c.row.teamImageUrl,
        teamId: c.row.clubTeamId,
        teamCountryName: c.row.teamCountryName ?? null,
        careerClub: careerClubs.get(c.row.id) ?? null,
        crestByName,
      });
      const nation = resolveNationBadge({
        countryName: c.row.countryName ?? c.row.legendCountry ?? null,
        nationCode: c.row.nationCode,
        birthPlace: c.row.birthPlace,
        clubCountryName: club.teamCountryName,
        internationalTeamId: c.row.internationalTeamId,
        nationById,
        nationByName,
      });
      const intlPerf = ratingOnHundred(
        c.row.internationalScore ?? c.row.reputation ?? (r365 != null ? r365 * 0.9 : null),
      );
      const clubPerf = ratingOnHundred(c.row.clubScore ?? c.row.seasonRating ?? r365);

      return {
        rank: rank ?? 0,
        rankDisplay: fmt.rankDisplay,
        provisional: false,
        movement,
        previousRank,
        movementDelta,
        playerId: c.row.id,
        slug: c.row.slug,
        name: cleanRankingPlayerName(c.row.name) || c.row.name,
        imageUrl: (() => {
          const raw = c.row.imageUrl || galleryImages.get(c.row.id) || null;
          if (!raw) return null;
          if (/noimage|placeholder|default.?player/i.test(raw)) return null;
          return raw;
        })(),
        teamId: club.teamId,
        teamName: club.teamName,
        teamImageUrl: club.teamImageUrl,
        teamSlug: club.teamSlug,
        nationName: nation.nationName,
        nationImageUrl: nation.nationImageUrl,
        nationSlug: nation.nationSlug,
        positionName: c.row.positionName,
        positionKey: c.positionKey,
        rankingScore: impact,
        r365Rating: r365,
        formScore: c.row.form != null ? Math.round(c.row.form * 10) / 10 : null,
        formBlocks,
        internationalPerformance: intlPerf,
        clubPerformance: clubPerf,
        positionPerformance: peak,
        peakRating: peak,
        impactScore: impact,
        eligibleMinutes: null,
        eligibleAppearances: null,
        modelVersion: PLAYER_RANK_ALLTIME_MODEL,
        retired: true,
        breakdownTitle: [
          `Legend Score ${impact}`,
          peak != null ? `Peak ${peak}` : null,
          `Impact ${impact}`,
          intlPerf != null ? `International ${intlPerf}` : null,
          clubPerf != null ? `Club ${clubPerf}` : null,
          `Movement ${movementDelta > 0 ? "+" : ""}${movementDelta.toFixed(1)}`,
          `Model ${PLAYER_RANK_ALLTIME_MODEL}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .sort((a, b) => a.rank - b.rank || b.rankingScore - a.rankingScore)
    .slice(0, top);

  const eligibilityNote = `All-Time rankings use the R365 Legend Score model (${PLAYER_RANK_ALLTIME_MODEL}): career / peak / legacy / honours / longevity among active legend memberships.`;

  const status: PublicRankingBoard["status"] =
    pool < 5 ? "building" : pool < 10 ? "provisional" : "ready";

  const board: PublicRankingBoard = {
    mode: "alltime",
    status,
    title,
    filterKey,
    filters: { ...filters, top },
    pool,
    modelVersion: PLAYER_RANK_ALLTIME_MODEL,
    eligibilityNote,
    calculatedAt: new Date().toISOString(),
    fromSnapshot: false,
    rows: boardRows,
    positionLabel,
    nationLabel,
    clubLabel,
    competitionLabel: filters.competition
      ? shortCompetitionLabel(filters.competition) || filters.competition
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

function boardFromSnapshot(
  mode: PlayerRankingMode,
  filters: PlayerRankingBoardFilters,
  filterKey: string,
  snap: {
    title: string;
    pool: number;
    modelVersion: string;
    eligibilityNote: string | null;
    status: string;
    calculatedAt: Date;
    payload: unknown;
  },
): PublicRankingBoard {
  const payload = snap.payload as {
    rows?: PublicRankingBoardRow[];
    labels?: {
      position?: string | null;
      nation?: string | null;
      club?: string | null;
      competition?: string | null;
    };
  };
  const status =
    snap.status === "building" || snap.status === "provisional" || snap.status === "ready"
      ? (snap.status as PublicRankingBoard["status"])
      : "ready";
  return {
    mode,
    status,
    title: snap.title,
    filterKey,
    filters,
    pool: snap.pool,
    modelVersion: snap.modelVersion,
    eligibilityNote:
      snap.eligibilityNote ??
      (mode === "alltime"
        ? `Rankings calculated by the R365 Legend Score Model (${PLAYER_RANK_ALLTIME_MODEL}).`
        : `Rankings calculated by the R365 Rating Model (${PLAYER_RANK_CURRENT_MODEL}).`),
    calculatedAt: snap.calculatedAt.toISOString(),
    fromSnapshot: true,
    rows: Array.isArray(payload?.rows) ? payload.rows.slice(0, filters.top) : [],
    positionLabel: payload?.labels?.position ?? positionLabelForKey(filters.position),
    nationLabel: payload?.labels?.nation ?? filters.nation,
    clubLabel: payload?.labels?.club ?? null,
    competitionLabel: payload?.labels?.competition ?? null,
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

  const filterKey = buildRankingFilterKey(filters);
  const expectedModel =
    filters.mode === "alltime" ? PLAYER_RANK_ALLTIME_MODEL : PLAYER_RANK_CURRENT_MODEL;
  const memKey = `rankings:board:${expectedModel}:${filterKey}`;

  const load = async (): Promise<PublicRankingBoard> => {
    if (!input.forceRebuild) {
      const snap = await loadCurrentSnapshot(filterKey);
      if (snap && snapshotFresh(snap.calculatedAt) && snap.modelVersion === expectedModel) {
        const board = boardFromSnapshot(filters.mode, filters, filterKey, snap);
        const prevRanks = await previousRanksForFilter(filters, "previous");
        return hydrateBoardMovement(board, prevRanks);
      }
    }

    if (filters.mode === "alltime") {
      return buildAllTimeBoard(filters);
    }

    return buildCurrentBoard(filters);
  };

  if (input.forceRebuild) {
    return load();
  }

  return cachedPublic(memKey, PUBLIC_CACHE_TTL.rankingsBoard, load);
}

export async function listRankingFilterOptions(): Promise<RankingFilterOptions> {
  return cachedPublic("rankings:filters", PUBLIC_CACHE_TTL.rankingsFilters, async () => {
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

  const clubRowsRaw = await db
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
        sql`${teams.name} not ilike 'unknown team%'`,
        sql`${teams.slug} not like 'orphan-%'`,
      ),
    )
    .orderBy(teams.name)
    .limit(500);

  // Prefer canonical slugs (no __legacy__) when duplicate names exist.
  const clubByName = new Map<string, (typeof clubRowsRaw)[number]>();
  for (const c of clubRowsRaw) {
    const key = c.name.trim().toLowerCase();
    const prev = clubByName.get(key);
    if (!prev) {
      clubByName.set(key, c);
      continue;
    }
    const prevLegacy = prev.slug.includes("__legacy__");
    const nextLegacy = c.slug.includes("__legacy__");
    if (prevLegacy && !nextLegacy) clubByName.set(key, c);
  }
  const clubs = [...clubByName.values()].sort((a, b) => a.name.localeCompare(b.name));

  const compRowsRaw = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
    })
    .from(competitions)
    .where(
      sql`coalesce(${competitions.lifecycleStatus}, 'current') <> 'former'
        and ${competitions.slug} not like '%__legacy__%'
        and ${competitions.name} not ilike '%(historic)%'`,
    )
    .orderBy(competitions.name)
    .limit(400);

  const compByName = new Map<string, (typeof compRowsRaw)[number]>();
  for (const c of compRowsRaw) {
    const key = c.name.trim().toLowerCase().replace(/\s+/g, " ");
    const prev = compByName.get(key);
    if (!prev) {
      compByName.set(key, c);
      continue;
    }
    const score = (row: { slug: string }) => {
      let s = 0;
      if (!row.slug.includes("__legacy__")) s += 4;
      if (!/historic|former/i.test(row.slug)) s += 2;
      if (row.slug.length < 40) s += 1;
      return s;
    };
    if (score(c) > score(prev)) compByName.set(key, c);
  }
  const competitionsDeduped = [...compByName.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    positions: PUBLIC_RANKING_POSITION_FILTERS.map((p) => ({ key: p.key, label: p.label })),
    nations,
    clubs,
    competitions: competitionsDeduped,
    eras: ALLTIME_ERA_OPTIONS.map((e) => ({ key: e.key, label: e.label })),
    topOptions: [10, 25, 50, 100],
  };
  });
}
