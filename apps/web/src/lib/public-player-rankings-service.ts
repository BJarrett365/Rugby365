/**
 * Public player rankings for profile Component 05 + /rankings/players.
 * One shared engine path — ranks computed from ratings / intelligence / value, never manual.
 */
import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  competitions,
  fixtures,
  playerMarketValues,
  playerRankingHistory,
  playerRatings,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { calculatePlayerAge } from "./player-profile-utils";
import {
  PLAYER_RANKING_MODEL,
  RANKING_ACTIVE_MONTHS,
  buildCompetitionBuildingState,
  buildRankingHoverTitle,
  denseRankWithTies,
  formatRankingDisplay,
  intelligenceMetricsForPosition,
  positionTabMetricsForPosition,
  rankingHref,
  rankingMovement,
  rankPlayerInCohort,
  resolveAgeGroup,
  resolveRankingPositionGroup,
  shortCompetitionLabel,
  pluralizePositionLabel,
  type RankingBuildingState,
  type RankingIconKey,
  type RankingMetricKey,
  type RankingRowPresentation,
  type RankingTabId,
  type ScoredMember,
} from "./player-ranking-engine";
import { RANKING_MIN_ELIGIBLE } from "./player-rating-presentation";

export type PublicPlayerRankings = {
  overallRank: number | null;
  overallLabel: string | null;
  overallPool: number;
  positionRank: number | null;
  positionLabel: string | null;
  positionPool: number;
  countryRank: number | null;
  countryLabel: string | null;
  countryPool: number;
  competitionRank: number | null;
  competitionLabel: string | null;
  competitionPool: number;
  provisional: boolean;
  unavailable: boolean;
  cohortSize: number;
  peers: Array<{
    rank: number;
    slug: string;
    name: string;
    rating: number;
    imageUrl: string | null;
    isCurrent: boolean;
  }>;
  /** Tabbed rows for Player Rankings card (Component 05). */
  tabs: Record<RankingTabId, RankingRowPresentation[]>;
  /** Competition-tab building / empty messaging (never hide the card). */
  competitionBuilding: RankingBuildingState;
  modelVersion: string;
};

export type PublicPlayerLeaderboardRow = {
  rank: number;
  rankDisplay: string;
  provisional: boolean;
  movement: "up" | "down" | "flat" | null;
  previousRank: number | null;
  playerId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  teamName: string | null;
  nationName: string | null;
  positionName: string | null;
  age: number | null;
  score: number;
  form: number | null;
  confidence: number | null;
};

type CohortPlayer = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  countryName: string | null;
  positionName: string | null;
  clubName: string | null;
  clubTeamId: string | null;
  competitionName: string | null;
  careerStatus: string | null;
  birthDate: string | null;
  age: number | null;
  overall: number | null;
  form: number | null;
  attack: number | null;
  defence: number | null;
  playmaking: number | null;
  kicking: number | null;
  gameManagement: number | null;
  potential: number | null;
  dataPoints: number;
  marketValueGbp: number | null;
  positionGroup: ReturnType<typeof resolveRankingPositionGroup>;
  ageGroup: ReturnType<typeof resolveAgeGroup>;
};

function metricScore(p: CohortPlayer, key: RankingMetricKey): number | null {
  switch (key) {
    case "overall":
    case "position":
    case "country":
    case "age_group":
    case "competition_position":
      return p.overall;
    case "attack":
      return p.attack;
    case "defence":
      return p.defence;
    case "playmaking":
      return p.playmaking;
    case "kicking":
    case "goal_kicking":
      return p.kicking;
    case "game_management":
      return p.gameManagement;
    case "form":
      return p.form;
    case "potential":
      return p.potential;
    case "market_value":
      return p.marketValueGbp;
    default:
      return null;
  }
}

function presentRow(input: {
  metricKey: RankingMetricKey;
  label: string;
  icon: RankingIconKey;
  playerId: string;
  cohort: CohortPlayer[];
  scoreKey: RankingMetricKey;
  minMatches?: number;
  hrefFilters: Parameters<typeof rankingHref>[0];
  previousByMetric?: Map<string, number>;
}): RankingRowPresentation | null {
  const minMatches = input.minMatches ?? RANKING_MIN_ELIGIBLE;
  const members: ScoredMember[] = [];
  let matchesUsed: number | null = null;
  let confidence: number | null = null;

  for (const p of input.cohort) {
    if ((p.dataPoints ?? 0) < minMatches && input.scoreKey !== "market_value") continue;
    if (input.scoreKey === "market_value" && (p.marketValueGbp == null || p.marketValueGbp <= 0)) {
      continue;
    }
    const score = metricScore(p, input.scoreKey);
    if (score == null || !Number.isFinite(score)) continue;
    members.push({ playerId: p.id, score });
    if (p.id === input.playerId) {
      matchesUsed = p.dataPoints;
      confidence = p.dataPoints >= 40 ? 80 : p.dataPoints >= 10 ? 55 : 35;
    }
  }

  const { rank, pool, score } = rankPlayerInCohort(input.playerId, members);
  const display = formatRankingDisplay({ rank, pool });

  // Hide rows with no eligible pool at all
  if (pool <= 0) return null;

  const prevKey = `${input.metricKey}`;
  const previousRank = input.previousByMetric?.get(prevKey) ?? null;
  const movement = rankingMovement(display.showRank ? rank : null, previousRank);

  const row: RankingRowPresentation = {
    metricKey: input.metricKey,
    label: input.label,
    icon: input.icon,
    rank: display.showRank ? rank : null,
    rankDisplay: display.rankDisplay,
    pool,
    score: score != null ? Math.round(score * 10) / 10 : null,
    previousRank,
    movement,
    status: display.status,
    provisional: display.provisional,
    confidence,
    coverage: null,
    matchesUsed,
    minMatches,
    href: rankingHref(input.hrefFilters),
    title: "",
  };
  row.title = buildRankingHoverTitle(row);
  return row;
}

function buildTabs(input: {
  playerId: string;
  cohort: CohortPlayer[];
  subject: CohortPlayer;
  nationName: string | null;
  competitionName: string | null;
  competitionLinked: boolean;
  previousByMetric?: Map<string, number>;
}): Record<RankingTabId, RankingRowPresentation[]> {
  const { playerId, cohort, subject } = input;
  const posGroup = subject.positionGroup;
  const ageGroup = subject.ageGroup;
  const nation = input.nationName?.trim() || subject.countryName?.trim() || null;
  const competition = input.competitionLinked
    ? input.competitionName?.trim() || subject.competitionName?.trim() || null
    : null;
  const compShort = shortCompetitionLabel(competition);

  const sameNation = nation
    ? cohort.filter((p) => (p.countryName ?? "").toLowerCase() === nation.toLowerCase())
    : [];
  const samePosition = posGroup
    ? cohort.filter((p) => p.positionGroup?.key === posGroup.key)
    : [];
  const sameCompetition = competition
    ? cohort.filter((p) => {
        const name = (p.competitionName ?? "").trim().toLowerCase();
        if (!name) return false;
        const target = competition.toLowerCase();
        return name.includes(target) || target.includes(name);
      })
    : [];
  const sameAge = ageGroup ? cohort.filter((p) => p.ageGroup?.key === ageGroup.key) : [];
  const sameCompPosition =
    competition && posGroup
      ? sameCompetition.filter((p) => p.positionGroup?.key === posGroup.key)
      : [];

  const push = (rows: RankingRowPresentation[], row: RankingRowPresentation | null) => {
    if (row) rows.push(row);
  };

  const prev = input.previousByMetric;

  const global: RankingRowPresentation[] = [];
  push(
    global,
    presentRow({
      metricKey: "overall",
      label: "Overall (All Players)",
      icon: "player",
      playerId,
      cohort,
      scoreKey: "overall",
      hrefFilters: { metric: "overall", scope: "global" },
      previousByMetric: prev,
    }),
  );
  if (posGroup) {
    push(
      global,
      presentRow({
        metricKey: "position",
        label: posGroup.label,
        icon: "position",
        playerId,
        cohort: samePosition,
        scoreKey: "overall",
        hrefFilters: { metric: "overall", scope: "global", position: posGroup.key },
        previousByMetric: prev,
      }),
    );
  }
  if (nation) {
    push(
      global,
      presentRow({
        metricKey: "country",
        label: nation,
        icon: "nation",
        playerId,
        cohort: sameNation,
        scoreKey: "overall",
        hrefFilters: { metric: "overall", scope: "global", nation },
        previousByMetric: prev,
      }),
    );
  }
  if (ageGroup) {
    push(
      global,
      presentRow({
        metricKey: "age_group",
        label: `${ageGroup.label} (World)`,
        icon: "age",
        playerId,
        cohort: sameAge,
        scoreKey: "overall",
        hrefFilters: { metric: "overall", scope: "global", nation: ageGroup.key },
        previousByMetric: prev,
      }),
    );
  }
  if (competition && posGroup && sameCompPosition.length) {
    push(
      global,
      presentRow({
        metricKey: "competition_position",
        label: `${compShort || competition} ${pluralizePositionLabel(posGroup.label)}`,
        icon: "competition",
        playerId,
        cohort: sameCompPosition,
        scoreKey: "overall",
        hrefFilters: {
          metric: "overall",
          scope: "competition",
          competition,
          position: posGroup.key,
        },
        previousByMetric: prev,
      }),
    );
  }

  for (const spec of intelligenceMetricsForPosition(posGroup?.key)) {
    push(
      global,
      presentRow({
        metricKey: spec.key,
        label: spec.label,
        icon: spec.icon,
        playerId,
        cohort,
        scoreKey: spec.scoreKey,
        minMatches: spec.minMatches,
        hrefFilters: { metric: spec.scoreKey, scope: "global" },
        previousByMetric: prev,
      }),
    );
  }

  const national: RankingRowPresentation[] = [];
  if (nation && sameNation.length) {
    push(
      national,
      presentRow({
        metricKey: "overall",
        label: "Overall",
        icon: "player",
        playerId,
        cohort: sameNation,
        scoreKey: "overall",
        hrefFilters: { metric: "overall", scope: "national", nation },
        previousByMetric: prev,
      }),
    );
    if (posGroup) {
      push(
        national,
        presentRow({
          metricKey: "position",
          label: posGroup.label,
          icon: "position",
          playerId,
          cohort: sameNation.filter((p) => p.positionGroup?.key === posGroup.key),
          scoreKey: "overall",
          hrefFilters: { metric: "overall", scope: "national", nation, position: posGroup.key },
          previousByMetric: prev,
        }),
      );
    }
    if (ageGroup) {
      push(
        national,
        presentRow({
          metricKey: "age_group",
          label: ageGroup.label,
          icon: "age",
          playerId,
          cohort: sameNation.filter((p) => p.ageGroup?.key === ageGroup.key),
          scoreKey: "overall",
          hrefFilters: { metric: "overall", scope: "national", nation },
          previousByMetric: prev,
        }),
      );
    }
    for (const spec of intelligenceMetricsForPosition(posGroup?.key)) {
      push(
        national,
        presentRow({
          metricKey: spec.key,
          label: spec.label.replace(/ Rating$/, ""),
          icon: spec.icon,
          playerId,
          cohort: sameNation,
          scoreKey: spec.scoreKey,
          minMatches: spec.minMatches,
          hrefFilters: { metric: spec.scoreKey, scope: "national", nation },
          previousByMetric: prev,
        }),
      );
    }
  }

  const position: RankingRowPresentation[] = [];
  if (posGroup && samePosition.length) {
    for (const spec of positionTabMetricsForPosition(posGroup.key)) {
      push(
        position,
        presentRow({
          metricKey: spec.key,
          label: spec.label,
          icon: spec.icon,
          playerId,
          cohort: samePosition,
          scoreKey: spec.scoreKey,
          minMatches: spec.minMatches,
          hrefFilters: { metric: spec.scoreKey, scope: "position", position: posGroup.key },
          previousByMetric: prev,
        }),
      );
    }
  }

  const competitionTab: RankingRowPresentation[] = [];
  if (competition && sameCompetition.length) {
    push(
      competitionTab,
      presentRow({
        metricKey: "overall",
        label: "Overall",
        icon: "player",
        playerId,
        cohort: sameCompetition,
        scoreKey: "overall",
        hrefFilters: { metric: "overall", scope: "competition", competition },
        previousByMetric: prev,
      }),
    );
    if (posGroup) {
      push(
        competitionTab,
        presentRow({
          metricKey: "competition_position",
          label: posGroup.label,
          icon: "position",
          playerId,
          cohort: sameCompPosition,
          scoreKey: "overall",
          hrefFilters: {
            metric: "overall",
            scope: "competition",
            competition,
            position: posGroup.key,
          },
          previousByMetric: prev,
        }),
      );
    }
    for (const spec of intelligenceMetricsForPosition(posGroup?.key)) {
      push(
        competitionTab,
        presentRow({
          metricKey: spec.key,
          label: spec.label.replace(/ Rating$/, ""),
          icon: spec.icon,
          playerId,
          cohort: sameCompetition,
          scoreKey: spec.scoreKey,
          minMatches: spec.minMatches,
          hrefFilters: { metric: spec.scoreKey, scope: "competition", competition },
          previousByMetric: prev,
        }),
      );
    }
  }

  return { global, national, position, competition: competitionTab };
}

function emptyRankings(): PublicPlayerRankings {
  return {
    overallRank: null,
    overallLabel: null,
    overallPool: 0,
    positionRank: null,
    positionLabel: null,
    positionPool: 0,
    countryRank: null,
    countryLabel: null,
    countryPool: 0,
    competitionRank: null,
    competitionLabel: null,
    competitionPool: 0,
    provisional: true,
    unavailable: true,
    cohortSize: 0,
    peers: [],
    tabs: { global: [], national: [], position: [], competition: [] },
    competitionBuilding: buildCompetitionBuildingState({
      competitionName: null,
      competitionLinked: false,
      poolPlayers: 0,
      eligibleWithMinMatches: 0,
    }),
    modelVersion: PLAYER_RANKING_MODEL,
  };
}

async function resolveCompetitionTeamIds(
  competitionName: string,
): Promise<{ competitionId: string | null; teamIds: string[] }> {
  const db = getDb();
  const sinceIso = new Date(
    Date.now() - RANKING_ACTIVE_MONTHS * 30.44 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [comp] = await db
    .select({ id: competitions.id, name: competitions.name })
    .from(competitions)
    .where(sql`lower(${competitions.name}) like ${`%${competitionName.toLowerCase()}%`}`)
    .limit(1);

  if (!comp) return { competitionId: null, teamIds: [] };

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
  return { competitionId: comp.id, teamIds };
}

async function loadPreviousRanks(playerId: string): Promise<Map<string, number>> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        metricKey: playerRankingHistory.metricKey,
        rank: playerRankingHistory.rank,
      })
      .from(playerRankingHistory)
      .where(
        and(
          eq(playerRankingHistory.playerId, playerId),
          eq(playerRankingHistory.isCurrent, true),
          eq(playerRankingHistory.scope, "global"),
        ),
      )
      .limit(40);
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.rank != null) map.set(r.metricKey, r.rank);
    }
    return map;
  } catch {
    // Table may not exist yet pre-migration
    return new Map();
  }
}

export async function getPublicPlayerRankings(input: {
  playerId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  rating: number | null;
  positionName: string | null;
  nationName: string | null;
  competitionName: string | null;
  /** When true (or when competitionName is resolvable), COMPETITION tab is populated. */
  competitionVerified?: boolean;
  modelVersion?: string | null;
}): Promise<PublicPlayerRankings> {
  if (input.rating == null || !Number.isFinite(input.rating)) return emptyRankings();

  const db = getDb();
  const competitionName = input.competitionName?.trim() || null;
  const competitionLinked = Boolean(
    (input.competitionVerified ?? true) && competitionName,
  );

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
      birthDate: players.birthDate,
      overall: playerRatings.playerRating,
      form: playerRatings.formScore,
      attack: playerRatings.attackRating,
      defence: playerRatings.defenceRating,
      playmaking: playerRatings.playmakingRating,
      kicking: playerRatings.kickingRating,
      gameManagement: playerRatings.gameManagementRating,
      potential: playerRatings.potential,
      dataPoints: playerRatings.dataPoints,
      marketValueGbp: playerMarketValues.marketValueGbp,
      calculatedAt: playerRatings.calculatedAt,
    })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .leftJoin(
      playerMarketValues,
      and(
        eq(playerMarketValues.playerId, players.id),
        eq(playerMarketValues.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(playerRatings.playerRating),
        sql`lower(coalesce(${players.careerStatus}, 'active')) not in ('retired', 'inactive', 'deceased')`,
      ),
    );

  const cohort: CohortPlayer[] = rows.map((r) => {
    const age = r.birthDate ? calculatePlayerAge(String(r.birthDate).slice(0, 10)) : null;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      imageUrl: r.imageUrl,
      countryName: r.countryName,
      positionName: r.positionName,
      clubName: r.clubName,
      clubTeamId: r.clubTeamId,
      competitionName: null as string | null,
      careerStatus: r.careerStatus,
      birthDate: r.birthDate ? String(r.birthDate).slice(0, 10) : null,
      age,
      overall: r.overall,
      form: r.form,
      attack: r.attack,
      defence: r.defence,
      playmaking: r.playmaking,
      kicking: r.kicking,
      gameManagement: r.gameManagement,
      potential: r.potential,
      dataPoints: r.dataPoints ?? 0,
      marketValueGbp: r.marketValueGbp,
      positionGroup: resolveRankingPositionGroup(r.positionName),
      ageGroup: resolveAgeGroup(age),
    };
  });

  const subject = cohort.find((p) => p.id === input.playerId);
  if (!subject) return emptyRankings();
  subject.positionName = input.positionName ?? subject.positionName;
  subject.positionGroup = resolveRankingPositionGroup(subject.positionName);
  if (input.nationName) subject.countryName = input.nationName;

  let competitionPoolPlayers = 0;
  let competitionEligible = 0;

  if (competitionLinked && competitionName) {
    const { teamIds } = await resolveCompetitionTeamIds(competitionName);
    const teamSet = new Set(teamIds);
    for (const p of cohort) {
      if (p.clubTeamId && teamSet.has(p.clubTeamId)) {
        p.competitionName = competitionName;
      }
    }
    subject.competitionName = competitionName;
    const sameComp = cohort.filter((p) => p.competitionName === competitionName);
    competitionPoolPlayers = sameComp.length;
    competitionEligible = sameComp.filter((p) => (p.dataPoints ?? 0) >= RANKING_MIN_ELIGIBLE).length;
  }

  const previousByMetric = await loadPreviousRanks(input.playerId);

  const tabs = buildTabs({
    playerId: input.playerId,
    cohort,
    subject,
    nationName: input.nationName,
    competitionName,
    competitionLinked,
    previousByMetric,
  });

  const competitionBuilding = buildCompetitionBuildingState({
    competitionName,
    competitionLinked: competitionLinked && Boolean(competitionName),
    poolPlayers: competitionPoolPlayers,
    eligibleWithMinMatches: competitionEligible,
  });

  // If competition tab has rows, mark ready even if building heuristic was thin on overall
  if (tabs.competition.length > 0 && competitionBuilding.status === "building") {
    const overallComp = tabs.competition.find((r) => r.metricKey === "overall");
    if (overallComp && overallComp.pool >= RANKING_MIN_ELIGIBLE) {
      competitionBuilding.status = "ready";
      competitionBuilding.headline = "READY";
      competitionBuilding.reason = `${competitionName} competition rankings are live.`;
      competitionBuilding.eligibleWithMinMatches = overallComp.pool;
    }
  }

  const overallRow = tabs.global.find((r) => r.metricKey === "overall") ?? null;
  const positionRow = tabs.global.find((r) => r.metricKey === "position") ?? null;
  const countryRow = tabs.global.find((r) => r.metricKey === "country") ?? null;
  const competitionRow =
    tabs.competition.find((r) => r.metricKey === "overall") ??
    tabs.global.find((r) => r.metricKey === "competition_position") ??
    null;

  const posKey = subject.positionGroup?.key;
  const peersSource = posKey
    ? cohort.filter((p) => p.positionGroup?.key === posKey && p.overall != null)
    : cohort.filter((p) => p.overall != null);
  const peersSorted = [...peersSource].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const peerRanks = rankPlayerInCohort(
    input.playerId,
    peersSorted.map((p) => ({ playerId: p.id, score: p.overall! })),
  );
  const peers = peersSorted.slice(0, 8).map((p) => {
    const r = rankPlayerInCohort(
      p.id,
      peersSorted.map((x) => ({ playerId: x.id, score: x.overall! })),
    );
    return {
      rank: r.rank ?? 0,
      slug: p.slug,
      name: p.name,
      rating: Math.round((p.overall ?? 0) * 10) / 10,
      imageUrl: p.imageUrl,
      isCurrent: p.id === input.playerId,
    };
  });
  if (!peers.some((p) => p.isCurrent)) {
    peers.push({
      rank: peerRanks.rank ?? 0,
      slug: input.slug,
      name: input.name,
      rating: Math.round(input.rating * 10) / 10,
      imageUrl: input.imageUrl,
      isCurrent: true,
    });
  }

  const cohortSize = overallRow?.pool ?? cohort.length;
  const unavailable = cohortSize < RANKING_MIN_ELIGIBLE;
  const provisional = unavailable || (overallRow?.provisional ?? true);

  return {
    overallRank: overallRow?.rank ?? null,
    overallLabel: overallRow
      ? overallRow.status === "pending"
        ? `PROVISIONAL · ${overallRow.pool} eligible players`
        : `${overallRow.rankDisplay} of ${overallRow.pool} players`
      : null,
    overallPool: overallRow?.pool ?? 0,
    positionRank: positionRow?.rank ?? null,
    positionLabel: positionRow
      ? positionRow.status === "pending"
        ? `PROVISIONAL · ${positionRow.pool} eligible`
        : `${positionRow.rankDisplay} of ${positionRow.pool}`
      : null,
    positionPool: positionRow?.pool ?? 0,
    countryRank: countryRow?.rank ?? null,
    countryLabel: countryRow
      ? countryRow.status === "pending"
        ? `PROVISIONAL · ${countryRow.pool} eligible`
        : `${countryRow.rankDisplay} of ${countryRow.pool}`
      : null,
    countryPool: countryRow?.pool ?? 0,
    competitionRank: competitionRow?.rank ?? null,
    competitionLabel: competitionRow
      ? competitionRow.status === "pending"
        ? `PROVISIONAL · ${competitionRow.pool} eligible`
        : `${competitionRow.rankDisplay} of ${competitionRow.pool}`
      : null,
    competitionPool: competitionRow?.pool ?? 0,
    provisional,
    unavailable,
    cohortSize,
    peers,
    tabs,
    competitionBuilding,
    modelVersion: PLAYER_RANKING_MODEL,
  };
}

export async function listPublicPlayerRankings(input: {
  metric?: string;
  scope?: string;
  nation?: string | null;
  position?: string | null;
  competition?: string | null;
  limit?: number;
}): Promise<{
  rows: PublicPlayerLeaderboardRow[];
  metric: RankingMetricKey;
  scope: RankingTabId | "global";
  pool: number;
  modelVersion: string;
}> {
  const db = getDb();
  const metric = (input.metric ?? "overall") as RankingMetricKey;
  const scope = (input.scope ?? "global") as RankingTabId;
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);

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
      birthDate: players.birthDate,
      overall: playerRatings.playerRating,
      form: playerRatings.formScore,
      attack: playerRatings.attackRating,
      defence: playerRatings.defenceRating,
      playmaking: playerRatings.playmakingRating,
      kicking: playerRatings.kickingRating,
      gameManagement: playerRatings.gameManagementRating,
      potential: playerRatings.potential,
      dataPoints: playerRatings.dataPoints,
      marketValueGbp: playerMarketValues.marketValueGbp,
      teamName: teams.name,
    })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .leftJoin(teams, eq(teams.id, players.clubTeamId))
    .leftJoin(
      playerMarketValues,
      and(
        eq(playerMarketValues.playerId, players.id),
        eq(playerMarketValues.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(playerRatings.playerRating),
        sql`lower(coalesce(${players.careerStatus}, 'active')) not in ('retired', 'inactive', 'deceased')`,
      ),
    );

  let competitionTeamIds: Set<string> | null = null;
  if (scope === "competition" && input.competition) {
    const resolved = await resolveCompetitionTeamIds(input.competition);
    competitionTeamIds = new Set(resolved.teamIds);
  }

  const positionKey = input.position?.trim() || null;
  const nation = input.nation?.trim() || null;

  type Member = {
    player: (typeof rows)[number];
    score: number;
    age: number | null;
    confidence: number;
  };

  const members: Member[] = [];
  const minMatches = metric === "market_value" ? 0 : RANKING_MIN_ELIGIBLE;

  for (const r of rows) {
    if ((r.dataPoints ?? 0) < minMatches && metric !== "market_value") continue;
    const posGroup = resolveRankingPositionGroup(r.positionName);
    if (positionKey && posGroup?.key !== positionKey) continue;
    if (nation && (r.countryName ?? "").toLowerCase() !== nation.toLowerCase()) continue;
    if (scope === "national" && nation) {
      if ((r.countryName ?? "").toLowerCase() !== nation.toLowerCase()) continue;
    }
    if (scope === "position" && positionKey && posGroup?.key !== positionKey) continue;
    if (scope === "competition" && competitionTeamIds) {
      if (!r.clubTeamId || !competitionTeamIds.has(r.clubTeamId)) continue;
    }

    const proxy: CohortPlayer = {
      id: r.id,
      slug: r.slug,
      name: r.name,
      imageUrl: r.imageUrl,
      countryName: r.countryName,
      positionName: r.positionName,
      clubName: r.clubName,
      clubTeamId: r.clubTeamId,
      competitionName: null,
      careerStatus: null,
      birthDate: r.birthDate ? String(r.birthDate).slice(0, 10) : null,
      age: r.birthDate ? calculatePlayerAge(String(r.birthDate).slice(0, 10)) : null,
      overall: r.overall,
      form: r.form,
      attack: r.attack,
      defence: r.defence,
      playmaking: r.playmaking,
      kicking: r.kicking,
      gameManagement: r.gameManagement,
      potential: r.potential,
      dataPoints: r.dataPoints ?? 0,
      marketValueGbp: r.marketValueGbp,
      positionGroup: posGroup,
      ageGroup: null,
    };
    const score = metricScore(proxy, metric);
    if (score == null || !Number.isFinite(score)) continue;
    if (metric === "market_value" && score <= 0) continue;

    members.push({
      player: r,
      score,
      age: proxy.age,
      confidence: (r.dataPoints ?? 0) >= 40 ? 80 : (r.dataPoints ?? 0) >= 10 ? 55 : 35,
    });
  }

  const scored: ScoredMember[] = members.map((m) => ({
    playerId: m.player.id,
    score: m.score,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const rankMap = denseRankWithTies(sorted);
  const displayPool = members.length;

  const leaderboard: PublicPlayerLeaderboardRow[] = members
    .map((m) => {
      const rank = rankMap.get(m.player.id) ?? null;
      const fmt = formatRankingDisplay({ rank, pool: displayPool });
      return {
        rank: rank ?? 0,
        rankDisplay: fmt.rankDisplay,
        provisional: fmt.provisional,
        movement: null as "up" | "down" | "flat" | null,
        previousRank: null as number | null,
        playerId: m.player.id,
        slug: m.player.slug,
        name: m.player.name,
        imageUrl: m.player.imageUrl,
        teamName: m.player.teamName ?? m.player.clubName,
        nationName: m.player.countryName,
        positionName: m.player.positionName,
        age: m.age,
        score: Math.round(m.score * 10) / 10,
        form: m.player.form != null ? Math.round(m.player.form * 10) / 10 : null,
        confidence: m.confidence,
      };
    })
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .slice(0, limit);

  return {
    rows: leaderboard,
    metric,
    scope,
    pool: displayPool,
    modelVersion: PLAYER_RANKING_MODEL,
  };
}
