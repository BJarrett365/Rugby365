/**
 * Rugby365 Match Ratings (0–10 scale) for lineup display.
 * Stored per fixture+player — do not invent a separate display rating.
 */
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerRatings,
  playerSelectionTrends,
  playerTeamMemberships,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import type { CmsEntityLink } from "./match-entity-context";
import { loadPlayersByExternalIds } from "./entity-lookup-service";
import { listFixtureSquadPlayerIds } from "./match-entity-sync-service";
import {
  CAREER_RATING_MODEL,
  MATCH_RATING_MODEL,
  computeFormRatingFromMatchRatings,
  computeMatchRating10,
  computeSelectionMovement,
  formatMatchRatingDisplay,
  formTrendLabel,
  isFixtureRatingsPublished,
  performanceBandFor,
  performanceTrendLabel,
  type MatchRatingStatus,
  type PerformanceBand,
  type PerformanceTrend,
  type SelectionTrend,
  type SquadRole,
} from "./match-rating-math";

export type {
  MatchRatingStatus,
  PerformanceBand,
  PerformanceTrend,
  SelectionTrend,
  SquadRole,
} from "./match-rating-math";

export {
  CAREER_RATING_MODEL,
  MATCH_RATING_MODEL,
  computeFormRatingFromMatchRatings,
  computeMatchRating10,
  formatMatchRatingDisplay,
  formTrendLabel,
  isFixtureRatingsPublished,
  performanceTrendLabel,
} from "./match-rating-math";

export type MatchRatingDisplay = {
  playerId: string;
  externalPlayerId: string | null;
  teamId: string;
  playerName: string;
  jerseyNumber: number | null;
  positionName: string | null;
  squadRole: SquadRole;
  minutesPlayed: number;
  /** career-v1 overall quality (35–99). Separate from match rating. */
  careerRating: number | null;
  careerModel: typeof CAREER_RATING_MODEL;
  /** match-v1 performance in this fixture (1.0–10.0). */
  rating: number | null;
  matchModel: typeof MATCH_RATING_MODEL;
  ratingStatus: MatchRatingStatus;
  performanceBand: PerformanceBand | null;
  ratingLabel: string;
  ratingExplanation: string | null;
  positiveImpacts: string[];
  deductions: string[];
  matchContext: string[];
  /** Form from recent match-v1 ratings only (not career). */
  formRating: number | null;
  formTrend: PerformanceTrend | null;
  formLabel: string;
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: PerformanceTrend | null;
  performanceTrendLabel: string;
  selectionPreviousRole: string | null;
  selectionCurrentRole: string | null;
  selectionTrend: SelectionTrend | null;
  selectionBadge: string | null;
  isRugby365Potm: boolean;
  isOfficialPotm: boolean;
};

export type FixtureMatchRatingsBundle = {
  fixtureId: string;
  ratings: MatchRatingDisplay[];
  rugby365PotmPlayerId: string | null;
  officialPotmPlayerId: string | null;
  officialPotmName: string | null;
};

type PerfRow = typeof playerMatchPerformanceStats.$inferSelect;

function buildImpacts(row: PerfRow): { positive: string[]; deductions: string[]; context: string[] } {
  const positive: string[] = [];
  const deductions: string[] = [];
  const context: string[] = [];

  if (row.tries > 0) positive.push(`${row.tries} ${row.tries === 1 ? "try" : "tries"}`);
  if (row.tryAssists > 0) {
    positive.push(`${row.tryAssists} try assist${row.tryAssists === 1 ? "" : "s"}`);
  }
  if (row.metresCarried > 0) positive.push(`${row.metresCarried} running metres`);
  if (row.lineBreaks > 0) {
    positive.push(`${row.lineBreaks} clean break${row.lineBreaks === 1 ? "" : "s"}`);
  }
  if (row.defendersBeaten > 0) {
    positive.push(`${row.defendersBeaten} defender${row.defendersBeaten === 1 ? "" : "s"} beaten`);
  }
  if (row.tacklesMade > 0 || row.tacklesCompleted > 0) {
    positive.push(`${Math.max(row.tacklesMade, row.tacklesCompleted)} tackles`);
  }
  if (row.turnoversWon > 0) {
    positive.push(`${row.turnoversWon} turnover${row.turnoversWon === 1 ? "" : "s"} won`);
  }
  if (row.dominantTackles > 0) {
    positive.push(`${row.dominantTackles} dominant tackle${row.dominantTackles === 1 ? "" : "s"}`);
  }

  const extras = (row.extras ?? {}) as Record<string, unknown>;
  const handlingErrors = Number(
    extras.handling_errors ?? extras.handlingErrors ?? extras.errors ?? 0,
  );
  const missedTackles = Number(extras.missed_tackles ?? extras.missedTackles ?? 0);
  if (handlingErrors > 0) {
    deductions.push(`${handlingErrors} handling error${handlingErrors === 1 ? "" : "s"}`);
  }
  if (missedTackles > 0) {
    deductions.push(`${missedTackles} missed tackle${missedTackles === 1 ? "" : "s"}`);
  }

  if (row.tries >= 2 || row.metresCarried >= 80 || row.lineBreaks >= 2) {
    context.push("Major attacking impact");
  }
  if (row.tacklesCompleted >= 15 || row.turnoversWon >= 2) {
    context.push("Major defensive impact");
  }
  if (row.minutesPlayed > 0 && row.minutesPlayed < 20) {
    context.push("Limited minutes");
  }

  return { positive, deductions, context };
}

function normalizeSquadRole(role: string | null | undefined, jersey: number | null): SquadRole {
  const r = (role ?? "").toLowerCase();
  if (r.includes("start") || r === "xv" || r === "15") return "starter";
  if (r.includes("bench") || r.includes("sub") || r.includes("replace")) return "replacement";
  if (jersey != null && jersey >= 1 && jersey <= 15) return "starter";
  if (jersey != null && jersey > 15) return "replacement";
  return "starter";
}

async function loadCareerRatingsByPlayerId(
  playerIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!playerIds.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerRatings.playerId,
      playerRating: playerRatings.playerRating,
      manualOverrideRating: playerRatings.manualOverrideRating,
    })
    .from(playerRatings)
    .where(inArray(playerRatings.playerId, playerIds));
  for (const row of rows) {
    const value = row.manualOverrideRating ?? row.playerRating;
    if (value != null) map.set(row.playerId, Math.round(value));
  }
  return map;
}

async function loadRecentMatchRatingsByPlayerId(
  playerIds: string[],
  excludeFixtureId: string | null,
  limitPerPlayer = 10,
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (!playerIds.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerMatchRatings.playerId,
      rating: playerMatchRatings.rating,
      kickoffAt: fixtures.kickoffAt,
      fixtureId: playerMatchRatings.fixtureId,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        inArray(playerMatchRatings.playerId, playerIds),
        sql`${playerMatchRatings.rating} is not null`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  for (const row of rows) {
    if (excludeFixtureId && row.fixtureId === excludeFixtureId) continue;
    if (row.rating == null) continue;
    const list = map.get(row.playerId) ?? [];
    if (list.length >= limitPerPlayer) continue;
    list.push(row.rating);
    map.set(row.playerId, list);
  }
  return map;
}

export async function listMatchRatingsForFixture(
  fixtureId: string,
): Promise<FixtureMatchRatingsBundle> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  const rows = await db
    .select({
      rating: playerMatchRatings,
      playerName: players.name,
    })
    .from(playerMatchRatings)
    .innerJoin(players, eq(playerMatchRatings.playerId, players.id))
    .where(eq(playerMatchRatings.fixtureId, fixtureId));

  const playerIds = rows.map((r) => r.rating.playerId);
  const [careerByPlayer, recentByPlayer] = await Promise.all([
    loadCareerRatingsByPlayerId(playerIds),
    loadRecentMatchRatingsByPlayerId(playerIds, fixtureId, 10),
  ]);

  const ratings: MatchRatingDisplay[] = rows.map(({ rating: row, playerName }) => {
    const status = row.ratingStatus as MatchRatingStatus;
    const trend = (row.performanceTrend as PerformanceTrend | null) ?? null;
    const matchValue = row.manualOverrideRating ?? row.rating;
    const recent = recentByPlayer.get(row.playerId) ?? [];
    // Include this match at the front for form when rated.
    const formSeries = matchValue != null ? [matchValue, ...recent] : recent;
    const form = computeFormRatingFromMatchRatings(formSeries, 5);
    return {
      playerId: row.playerId,
      externalPlayerId: row.externalPlayerId,
      teamId: row.teamId,
      playerName,
      jerseyNumber: row.jerseyNumber,
      positionName: row.positionName,
      squadRole: (row.squadRole as SquadRole) ?? "starter",
      minutesPlayed: row.minutesPlayed,
      careerRating: careerByPlayer.get(row.playerId) ?? null,
      careerModel: CAREER_RATING_MODEL,
      rating: matchValue,
      matchModel: MATCH_RATING_MODEL,
      ratingStatus: status,
      performanceBand: (row.performanceBand as PerformanceBand | null) ?? null,
      ratingLabel: formatMatchRatingDisplay(matchValue, status),
      ratingExplanation: row.ratingExplanation,
      positiveImpacts: Array.isArray(row.positiveImpacts) ? (row.positiveImpacts as string[]) : [],
      deductions: Array.isArray(row.deductions) ? (row.deductions as string[]) : [],
      matchContext: Array.isArray(row.matchContext) ? (row.matchContext as string[]) : [],
      formRating: form.formRating,
      formTrend: form.formTrend,
      formLabel: formTrendLabel(form.formTrend, form.formRating),
      previousRating: row.previousRating,
      ratingChange: row.ratingChange,
      performanceTrend: trend,
      performanceTrendLabel: performanceTrendLabel(trend, row.ratingChange),
      selectionPreviousRole: row.selectionPreviousRole,
      selectionCurrentRole: row.selectionCurrentRole,
      selectionTrend: (row.selectionTrend as SelectionTrend | null) ?? null,
      selectionBadge: row.selectionBadge,
      isRugby365Potm: row.isRugby365Potm,
      isOfficialPotm: row.isOfficialPotm,
    };
  });

  return {
    fixtureId,
    ratings,
    rugby365PotmPlayerId: fixture?.rugby365PotmPlayerId ?? null,
    officialPotmPlayerId: fixture?.officialPotmPlayerId ?? null,
    officialPotmName: fixture?.officialPotmName ?? null,
  };
}

/** Resolve career ratings for CMS player ids (line-up rows without match rating yet). */
export async function listCareerRatingsForPlayerIds(
  playerIds: string[],
): Promise<Map<string, number>> {
  return loadCareerRatingsByPlayerId(playerIds);
}

export type SquadPlayerRankings = {
  careerRating: number | null;
  formRating: number | null;
  formLabel: string;
  latestMatchRating: number | null;
  /** Current-season match-v1 average (1–10), null if none rated. */
  seasonMatchAverage: number | null;
};

const EMPTY_SQUAD_RANKINGS: SquadPlayerRankings = {
  careerRating: null,
  formRating: null,
  formLabel: "—",
  latestMatchRating: null,
  seasonMatchAverage: null,
};

/** Batch career + form (+ optional latest fixture match) for squad tables. */
export async function listSquadRankingsForPlayerIds(
  playerIds: string[],
  options?: {
    latestFixtureId?: string | null;
    latestFixturePublished?: boolean;
    /** Season id used for season match average (defaults to latest fixture season). */
    seasonId?: string | null;
  },
): Promise<Map<string, SquadPlayerRankings>> {
  const unique = [...new Set(playerIds.filter(Boolean))];
  const result = new Map<string, SquadPlayerRankings>();
  if (!unique.length) return result;

  const [careerMap, recentMap, seasonAvgMap] = await Promise.all([
    loadCareerRatingsByPlayerId(unique),
    loadRecentMatchRatingsByPlayerId(unique, null, 10),
    loadSeasonMatchAveragesByPlayerId(unique, options?.seasonId ?? null),
  ]);

  const latestMatchByPlayer = new Map<string, number>();
  if (options?.latestFixtureId && options.latestFixturePublished) {
    const bundle = await listMatchRatingsForFixture(options.latestFixtureId);
    for (const row of bundle.ratings) {
      if (row.rating != null && row.ratingStatus !== "unavailable") {
        latestMatchByPlayer.set(row.playerId, row.rating);
      }
    }
  }

  for (const playerId of unique) {
    const form = computeFormRatingFromMatchRatings(recentMap.get(playerId) ?? [], 5);
    result.set(playerId, {
      careerRating: careerMap.get(playerId) ?? null,
      formRating: form.formRating,
      formLabel: formTrendLabel(form.formTrend, form.formRating),
      latestMatchRating: latestMatchByPlayer.get(playerId) ?? null,
      seasonMatchAverage: seasonAvgMap.get(playerId) ?? null,
    });
  }
  return result;
}

async function loadSeasonMatchAveragesByPlayerId(
  playerIds: string[],
  seasonId: string | null,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!playerIds.length) return map;
  const db = getDb();

  let resolvedSeasonId = seasonId;
  if (!resolvedSeasonId) {
    const [latest] = await db
      .select({ seasonId: fixtures.seasonId })
      .from(playerMatchRatings)
      .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
      .where(
        and(
          inArray(playerMatchRatings.playerId, playerIds),
          sql`${playerMatchRatings.rating} is not null`,
          sql`${fixtures.seasonId} is not null`,
        ),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(1);
    resolvedSeasonId = latest?.seasonId ?? null;
  }
  if (!resolvedSeasonId) return map;

  const rows = await db
    .select({
      playerId: playerMatchRatings.playerId,
      rating: playerMatchRatings.rating,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        inArray(playerMatchRatings.playerId, playerIds),
        eq(fixtures.seasonId, resolvedSeasonId),
        sql`${playerMatchRatings.rating} is not null`,
      ),
    );

  const sums = new Map<string, { total: number; n: number }>();
  for (const row of rows) {
    if (row.rating == null) continue;
    const prev = sums.get(row.playerId) ?? { total: 0, n: 0 };
    prev.total += row.rating;
    prev.n += 1;
    sums.set(row.playerId, prev);
  }
  for (const [playerId, agg] of sums) {
    if (agg.n > 0) map.set(playerId, Math.round((agg.total / agg.n) * 10) / 10);
  }
  return map;
}

export function emptySquadRankings(): SquadPlayerRankings {
  return { ...EMPTY_SQUAD_RANKINGS };
}

export type LineupSquadContext = {
  teamId: string;
  jerseyNumber: number | null;
  squadRole: string | null;
  positionName: string | null;
};

function careerFormRatingDisplay(
  link: CmsEntityLink,
  rankings: SquadPlayerRankings,
  squad?: LineupSquadContext | null,
): MatchRatingDisplay {
  return {
    playerId: link.id,
    externalPlayerId: link.externalProviderId,
    teamId: squad?.teamId ?? "",
    playerName: link.name,
    jerseyNumber: squad?.jerseyNumber ?? null,
    positionName: squad?.positionName ?? null,
    squadRole: normalizeSquadRole(squad?.squadRole ?? null, squad?.jerseyNumber ?? null),
    minutesPlayed: 0,
    careerRating: rankings.careerRating,
    careerModel: CAREER_RATING_MODEL,
    rating: null,
    matchModel: MATCH_RATING_MODEL,
    ratingStatus: "unavailable",
    performanceBand: null,
    ratingLabel: "—",
    ratingExplanation: null,
    positiveImpacts: [],
    deductions: [],
    matchContext: [],
    formRating: rankings.formRating,
    formTrend: null,
    formLabel: rankings.formLabel,
    previousRating: null,
    ratingChange: null,
    performanceTrend: null,
    performanceTrendLabel: "NEW",
    selectionPreviousRole: null,
    selectionCurrentRole: null,
    selectionTrend: null,
    selectionBadge: null,
    isRugby365Potm: false,
    isOfficialPotm: false,
  };
}

/**
 * Ensure lineup rows always carry Career (and Form when Match is absent).
 * Used before kick-off and to fill gaps after full time.
 */
export async function attachCareerAndFormToLineupRatings(
  ratings: MatchRatingDisplay[],
  playerLinks: CmsEntityLink[],
  squadByPlayerId?: Map<string, LineupSquadContext> | null,
): Promise<MatchRatingDisplay[]> {
  const linkById = new Map<string, CmsEntityLink>();
  for (const link of playerLinks) {
    if (link.id) linkById.set(link.id, link);
  }
  const allIds = [
    ...new Set([
      ...ratings.map((row) => row.playerId).filter(Boolean),
      ...playerLinks.map((link) => link.id).filter(Boolean),
    ]),
  ];
  if (allIds.length === 0) return ratings;

  const rankings = await listSquadRankingsForPlayerIds(allIds);
  const byPlayer = new Map(ratings.map((row) => [row.playerId, { ...row }]));

  for (const playerId of allIds) {
    const rank = rankings.get(playerId) ?? emptySquadRankings();
    const squad = squadByPlayerId?.get(playerId) ?? null;
    const existing = byPlayer.get(playerId);
    if (existing) {
      if (existing.careerRating == null && rank.careerRating != null) {
        existing.careerRating = rank.careerRating;
      }
      if (existing.formRating == null && rank.formRating != null) {
        existing.formRating = rank.formRating;
        existing.formLabel = rank.formLabel;
      }
      // Pre-match career/form rows historically had empty teamId — fill from squad.
      if ((!existing.teamId || existing.teamId === "") && squad?.teamId) {
        existing.teamId = squad.teamId;
      }
      if (existing.jerseyNumber == null && squad?.jerseyNumber != null) {
        existing.jerseyNumber = squad.jerseyNumber;
      }
      if (!existing.positionName && squad?.positionName) {
        existing.positionName = squad.positionName;
      }
      if (squad?.squadRole) {
        existing.squadRole = normalizeSquadRole(squad.squadRole, existing.jerseyNumber);
      }
      byPlayer.set(playerId, existing);
      continue;
    }
    const link = linkById.get(playerId);
    if (!link) continue;
    if (rank.careerRating == null && rank.formRating == null) continue;
    byPlayer.set(playerId, careerFormRatingDisplay(link, rank, squad));
  }

  return [...byPlayer.values()];
}

export async function enrichRatingsWithCareerFallback(
  ratings: MatchRatingDisplay[],
  playerLinks: CmsEntityLink[],
): Promise<MatchRatingDisplay[]> {
  return attachCareerAndFormToLineupRatings(ratings, playerLinks);
}

type SnapshotLineups = {
  home?: { starting?: Array<{ providerId?: string }>; substitutes?: Array<{ providerId?: string }> };
  away?: { starting?: Array<{ providerId?: string }>; substitutes?: Array<{ providerId?: string }> };
};

function collectLineupProviderIds(lineups?: SnapshotLineups | null): string[] {
  if (!lineups) return [];
  const ids: string[] = [];
  for (const side of [lineups.home, lineups.away]) {
    if (!side) continue;
    for (const player of [...(side.starting ?? []), ...(side.substitutes ?? [])]) {
      if (player.providerId) ids.push(player.providerId);
    }
  }
  return ids;
}

/** Admin match edit: Career (+ Form) before kick-off; Match + Career after full time. */
export async function getAdminFixtureLineupRatings(
  fixtureId: string,
): Promise<FixtureMatchRatingsBundle> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  const emptyBundle: FixtureMatchRatingsBundle = {
    fixtureId,
    ratings: [],
    rugby365PotmPlayerId: fixture?.rugby365PotmPlayerId ?? null,
    officialPotmPlayerId: fixture?.officialPotmPlayerId ?? null,
    officialPotmName: fixture?.officialPotmName ?? null,
  };
  if (!fixture) return emptyBundle;

  const published = isFixtureRatingsPublished(fixture.status);
  let bundle = emptyBundle;
  if (published) {
    try {
      await calculateAndPersistFixtureMatchRatings(fixtureId);
    } catch {
      // Best-effort — still list stored ratings.
    }
    bundle = await listMatchRatingsForFixture(fixtureId);
  }

  const squadLinks = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      externalProviderId: players.externalProviderId,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  const snap = fixture.providerSnapshot as { lineups?: SnapshotLineups } | null | undefined;
  const playersByExt = await loadPlayersByExternalIds(collectLineupProviderIds(snap?.lineups));

  const linkById = new Map<string, CmsEntityLink>();
  for (const row of squadLinks) {
    linkById.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      externalProviderId: row.externalProviderId,
    });
  }
  for (const link of playersByExt.values()) {
    linkById.set(link.id, link);
  }

  // Include mapped squad ids even when fixture_players join missed a row.
  const squadPlayerIds = await listFixtureSquadPlayerIds(fixtureId);
  if (squadPlayerIds.length > linkById.size) {
    const missingIds = squadPlayerIds.filter((id) => !linkById.has(id));
    if (missingIds.length > 0) {
      const extraRows = await db
        .select({
          id: players.id,
          slug: players.slug,
          name: players.name,
          externalProviderId: players.externalProviderId,
        })
        .from(players)
        .where(inArray(players.id, missingIds));
      for (const row of extraRows) {
        linkById.set(row.id, {
          id: row.id,
          slug: row.slug,
          name: row.name,
          externalProviderId: row.externalProviderId,
        });
      }
    }
  }

  const squadContextRows = await db
    .select({
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
      jerseyNumber: fixturePlayers.jerseyNumber,
      squadRole: fixturePlayers.squadRole,
      positionName: fixturePlayers.positionName,
    })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));
  const squadByPlayerId = new Map<string, LineupSquadContext>();
  for (const row of squadContextRows) {
    squadByPlayerId.set(row.playerId, {
      teamId: row.teamId,
      jerseyNumber: row.jerseyNumber,
      squadRole: row.squadRole,
      positionName: row.positionName,
    });
  }

  const ratings = await attachCareerAndFormToLineupRatings(
    bundle.ratings,
    [...linkById.values()],
    squadByPlayerId,
  );
  return { ...bundle, ratings };
}

/** Prevent concurrent SDMS enrich of the same fixture (page after() + backfill stampede). */
const sdmsEnrichInflight = new Set<string>();

/**
 * If a finished fixture has linked squad/performance data but missing match-rating rows
 * (e.g. squad imported after the first ratings pass, or CMS never enriched from SDMS),
 * sync from SDMS when needed and calculate ratings from real performance stats.
 * Idempotent when all expected ratings already exist.
 *
 * Pass `allowSdmsEnrich: false` on the Match Centre request path — SDMS enrich is
 * 13+ HTTP calls (default 20s each) plus stats import and must not block RSC.
 */
export async function ensureMissingFixturePlayerMatchRatings(
  fixtureId: string,
  options: { matchId?: string | null; allowSdmsEnrich?: boolean } = {},
): Promise<{
  enriched: boolean;
  calculated: number;
  triggered: boolean;
  needsSdmsEnrich: boolean;
}> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture || !isFixtureRatingsPublished(fixture.status)) {
    return { enriched: false, calculated: 0, triggered: false, needsSdmsEnrich: false };
  }

  const countRows = async (
    table: typeof fixturePlayers | typeof playerMatchPerformanceStats | typeof playerMatchRatings,
  ): Promise<number> => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(eq(table.fixtureId, fixtureId));
    return row?.count ?? 0;
  };

  const countPerfPlayersMissingRatings = async (): Promise<{
    perfCount: number;
    missingCount: number;
  }> => {
    const perfRows = await db
      .select({ playerId: playerMatchPerformanceStats.playerId })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.fixtureId, fixtureId));
    if (perfRows.length === 0) return { perfCount: 0, missingCount: 0 };

    const perfPlayerIds = perfRows.map((r) => r.playerId);
    const ratingRows = await db
      .select({ playerId: playerMatchRatings.playerId })
      .from(playerMatchRatings)
      .where(
        and(
          eq(playerMatchRatings.fixtureId, fixtureId),
          inArray(playerMatchRatings.playerId, perfPlayerIds),
          sql`${playerMatchRatings.rating} is not null`,
        ),
      );
    const ratedIds = new Set(ratingRows.map((r) => r.playerId));
    return {
      perfCount: perfPlayerIds.length,
      missingCount: perfPlayerIds.filter((id) => !ratedIds.has(id)).length,
    };
  };

  let enriched = false;
  let squadCount = await countRows(fixturePlayers);
  let perfCount = await countRows(playerMatchPerformanceStats);

  const matchId = options.matchId ?? fixture.externalMatchId;
  const allowSdmsEnrich = options.allowSdmsEnrich !== false;
  if ((squadCount === 0 || perfCount === 0) && matchId && allowSdmsEnrich) {
    if (sdmsEnrichInflight.has(fixtureId)) {
      // Another caller is already pulling this match from SDMS.
    } else {
      sdmsEnrichInflight.add(fixtureId);
      try {
        const { enrichFixtureFromSdmsMatch } = await import("./planet-rugby-match-import-service");
        await enrichFixtureFromSdmsMatch(fixtureId, matchId, { timeoutMs: 8_000 });
        enriched = true;
        squadCount = await countRows(fixturePlayers);
        perfCount = await countRows(playerMatchPerformanceStats);
      } catch {
        // Enrichment is best-effort — still attempt calc from any existing performance rows.
      } finally {
        sdmsEnrichInflight.delete(fixtureId);
      }
    }
  }

  const { perfCount: perfPlayers, missingCount } = await countPerfPlayersMissingRatings();
  const needsSdmsEnrich =
    Boolean(matchId) && (squadCount === 0 || perfCount === 0) && !allowSdmsEnrich;
  if (perfPlayers === 0 || missingCount === 0) {
    return { enriched, calculated: 0, triggered: enriched, needsSdmsEnrich };
  }

  try {
    const result = await calculateAndPersistFixtureMatchRatings(fixtureId);
    return { enriched, calculated: result.calculated, triggered: true, needsSdmsEnrich };
  } catch {
    return { enriched, calculated: 0, triggered: enriched, needsSdmsEnrich };
  }
}

/**
 * If a finished fixture has linked squad players without stored career ratings
 * (e.g. first match appearance before batch career calc), compute and persist them.
 * Idempotent when all squad players already have career ratings.
 */
export async function ensureMissingFixturePlayerCareerRatings(
  fixtureId: string,
): Promise<{ calculated: number; triggered: boolean }> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture || !isFixtureRatingsPublished(fixture.status)) {
    return { calculated: 0, triggered: false };
  }

  const squadRows = await db
    .select({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));
  const playerIds = [...new Set(squadRows.map((row) => row.playerId))];
  if (playerIds.length === 0) return { calculated: 0, triggered: false };

  const existingRows = await db
    .select({ playerId: playerRatings.playerId })
    .from(playerRatings)
    .where(
      and(
        inArray(playerRatings.playerId, playerIds),
        or(
          sql`${playerRatings.playerRating} is not null`,
          sql`${playerRatings.manualOverrideRating} is not null`,
        ),
      ),
    );
  const ratedIds = new Set(existingRows.map((row) => row.playerId));
  const missingIds = playerIds.filter((id) => !ratedIds.has(id));
  if (missingIds.length === 0) return { calculated: 0, triggered: false };

  const { calculateAndPersistPlayerRating } = await import("./player-bio-packet-service");
  let calculated = 0;
  for (const playerId of missingIds) {
    try {
      const rating = await calculateAndPersistPlayerRating(playerId);
      if (rating.displayRating != null) calculated += 1;
    } catch {
      // Career rating backfill is best-effort per player.
    }
  }
  return { calculated, triggered: true };
}

export async function calculateAndPersistFixtureMatchRatings(fixtureId: string): Promise<{
  calculated: number;
  potmPlayerId: string | null;
  coachesCalculated?: number;
  refereeCalculated?: number;
}> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return { calculated: 0, potmPlayerId: null };
  if (!isFixtureRatingsPublished(fixture.status)) {
    return { calculated: 0, potmPlayerId: null };
  }

  const perfRowsRaw = await db
    .select()
    .from(playerMatchPerformanceStats)
    .where(eq(playerMatchPerformanceStats.fixtureId, fixtureId));

  // Prefer real advanced / estimated match rows over zero-minute leaderboard seeds.
  const providerRank = (provider: string | null | undefined): number => {
    switch (provider) {
      case "sdms":
        return 100;
      case "ai_algorithm_estimate":
        return 80;
      case "fixture_players":
        return 40;
      case "scoring_events":
        return 30;
      case "opta_published_leaderboard":
      case "wikipedia_statistics":
        return 10;
      default:
        return 20;
    }
  };
  const bestPerfByPlayer = new Map<string, (typeof perfRowsRaw)[number]>();
  for (const row of perfRowsRaw) {
    const existing = bestPerfByPlayer.get(row.playerId);
    if (!existing || providerRank(row.sourceProvider) > providerRank(existing.sourceProvider)) {
      bestPerfByPlayer.set(row.playerId, row);
    }
  }
  const perfRows = [...bestPerfByPlayer.values()];

  const squadRows = await db
    .select()
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  const squadByPlayer = new Map(squadRows.map((s) => [s.playerId, s]));

  const statusForProvider = (provider: string | null | undefined): MatchRatingStatus => {
    if (
      provider === "sdms" ||
      provider === "rugby_data" ||
      provider === "ai_algorithm_estimate"
    ) {
      return "final";
    }
    // Scoring-only / rollup historic rows — keep visible but mark provisional (low confidence).
    if (
      provider === "fixture_players" ||
      provider === "scoring_events" ||
      provider === "rwc_player_rollup" ||
      provider === "opta_published_leaderboard" ||
      provider === "wikipedia_statistics"
    ) {
      return "provisional";
    }
    return providerRank(provider) >= 80 ? "final" : "provisional";
  };

  let best: { playerId: string; rating: number } | null = null;
  let calculated = 0;

  for (const perf of perfRows) {
    const squad = squadByPlayer.get(perf.playerId);
    const role = normalizeSquadRole(squad?.squadRole ?? null, squad?.jerseyNumber ?? null);
    const computed = computeMatchRating10({
      ...perf,
      extras: (perf.extras ?? {}) as Record<string, unknown>,
    });
    const impacts = buildImpacts(perf);
    const status = statusForProvider(perf.sourceProvider);

    const prevConditions = [
      eq(playerMatchRatings.playerId, perf.playerId),
      ne(playerMatchRatings.fixtureId, fixtureId),
      sql`${playerMatchRatings.rating} is not null`,
    ];
    if (fixture.competitionId) {
      prevConditions.push(eq(playerMatchRatings.competitionId, fixture.competitionId));
    }

    const [previous] = await db
      .select({
        fixtureId: playerMatchRatings.fixtureId,
        rating: playerMatchRatings.rating,
        squadRole: playerMatchRatings.squadRole,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(playerMatchRatings)
      .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
      .where(and(...prevConditions))
      .orderBy(desc(fixtures.kickoffAt))
      .limit(1);

    let performanceTrend: PerformanceTrend = "new";
    let ratingChange: number | null = null;
    if (previous?.rating != null) {
      ratingChange = Math.round((computed.rating - previous.rating) * 10) / 10;
      if (Math.abs(ratingChange) < 0.05) performanceTrend = "flat";
      else if (ratingChange > 0) performanceTrend = "up";
      else performanceTrend = "down";
    }

    const previousRole = (previous?.squadRole as SquadRole | null) ?? null;
    const selection = computeSelectionMovement(previousRole, role);

    const ratingValue = computed.rating;
    if (!best || ratingValue > best.rating) {
      best = { playerId: perf.playerId, rating: ratingValue };
    }

    const existing = await db
      .select({ id: playerMatchRatings.id })
      .from(playerMatchRatings)
      .where(
        and(
          eq(playerMatchRatings.fixtureId, fixtureId),
          eq(playerMatchRatings.playerId, perf.playerId),
        ),
      )
      .limit(1);

    const payload = {
      teamId: perf.teamId,
      competitionId: fixture.competitionId ?? perf.competitionId,
      seasonId: fixture.seasonId ?? perf.seasonId,
      externalPlayerId: perf.externalPlayerId,
      squadRole: role,
      jerseyNumber: squad?.jerseyNumber ?? null,
      positionName: squad?.positionName ?? null,
      minutesPlayed: perf.minutesPlayed,
      rating: ratingValue,
      ratingStatus: status,
      performanceBand: performanceBandFor(ratingValue),
      ratingExplanation: computed.explanation,
      positiveImpacts: impacts.positive,
      deductions: impacts.deductions,
      matchContext: impacts.context,
      attackContribution: computed.attack,
      defenceContribution: computed.defence,
      previousFixtureId: previous?.fixtureId ?? null,
      previousRating: previous?.rating ?? null,
      ratingChange,
      performanceTrend,
      selectionPreviousRole: previousRole,
      selectionCurrentRole: role,
      selectionTrend: selection.trend,
      selectionBadge: selection.badge,
      isRugby365Potm: false,
      sourceProvider: "rugby365",
      modelVersion: MATCH_RATING_MODEL,
      calculatedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing[0]) {
      await db
        .update(playerMatchRatings)
        .set(payload)
        .where(eq(playerMatchRatings.id, existing[0].id));
    } else {
      await db.insert(playerMatchRatings).values({
        fixtureId,
        playerId: perf.playerId,
        ...payload,
      });
    }
    calculated += 1;
  }

  await db
    .update(playerMatchRatings)
    .set({ isRugby365Potm: false, updatedAt: new Date() })
    .where(eq(playerMatchRatings.fixtureId, fixtureId));

  let potmPlayerId: string | null = null;
  if (best) {
    potmPlayerId = best.playerId;
    await db
      .update(playerMatchRatings)
      .set({ isRugby365Potm: true, updatedAt: new Date() })
      .where(
        and(
          eq(playerMatchRatings.fixtureId, fixtureId),
          eq(playerMatchRatings.playerId, best.playerId),
        ),
      );
    await db
      .update(fixtures)
      .set({ rugby365PotmPlayerId: best.playerId })
      .where(eq(fixtures.id, fixtureId));
  }

  // Coach + referee match ratings (same publish gate).
  let coachesCalculated = 0;
  let refereeCalculated = 0;
  try {
    const { calculateAndPersistFixtureStaffMatchRatings } = await import(
      "./staff-match-rating-service"
    );
    const staff = await calculateAndPersistFixtureStaffMatchRatings(fixtureId);
    coachesCalculated = staff.coachesCalculated;
    refereeCalculated = staff.refereeCalculated;
  } catch {
    // Staff ratings are best-effort alongside player ratings.
  }

  // Record DNPs: unused bench + season members not selected for this fixture.
  try {
    await persistFixtureDidNotPlayRecords({
      fixtureId,
      fixture,
      squadRows,
      ratedPlayerIds: new Set(perfRows.map((p) => p.playerId)),
    });
  } catch {
    // DNP ledger is best-effort; never block match ratings.
  }

  try {
    const { cascadeFixtureDataChange } = await import("./data-change-event-service");
    await cascadeFixtureDataChange({
      fixtureId,
      eventType: "PLAYER_RATINGS_UPDATED",
      source: "rugby365",
      importMethod: "SYSTEM",
      processNow: false,
    });
  } catch {
    // Stale marking is best-effort.
  }

  return { calculated, potmPlayerId, coachesCalculated, refereeCalculated };
}

/**
 * Persist selection-trend rows for players who did not receive a match rating:
 * - Matchday squad with 0 minutes / no performance row → unused_bench
 * - Active season members for either team not in the matchday 23 → not_selected
 */
async function persistFixtureDidNotPlayRecords(input: {
  fixtureId: string;
  fixture: typeof fixtures.$inferSelect;
  squadRows: Array<typeof fixturePlayers.$inferSelect>;
  ratedPlayerIds: Set<string>;
}): Promise<{ unusedBench: number; notSelected: number }> {
  const { fixtureId, fixture, squadRows, ratedPlayerIds } = input;
  const db = getDb();
  let unusedBench = 0;
  let notSelected = 0;

  const squadPlayerIds = new Set(squadRows.map((s) => s.playerId));

  // Unused bench / zero-minute squad entries
  for (const squad of squadRows) {
    if (ratedPlayerIds.has(squad.playerId)) continue;
    const role = normalizeSquadRole(squad.squadRole ?? null, squad.jerseyNumber ?? null);
    const previousRole = await loadPreviousSquadRole(squad.playerId, fixtureId, fixture.competitionId);
    const selection = computeSelectionMovement(previousRole, role);
    await upsertSelectionTrend({
      playerId: squad.playerId,
      teamId: squad.teamId,
      competitionId: fixture.competitionId,
      fixtureId,
      previousFixtureId: null,
      currentRole: role,
      previousRole,
      selectionTrend: selection.trend,
      selectionBadge: selection.badge,
      reason: "unused_bench",
      minutesCurrent: 0,
    });
    unusedBench += 1;
  }

  // Season members not in matchday squad
  if (fixture.seasonId) {
    const teamIds = [fixture.homeTeamId, fixture.awayTeamId].filter(Boolean) as string[];
    for (const teamId of teamIds) {
      const members = await db
        .select({
          playerId: playerTeamMemberships.playerId,
          status: playerTeamMemberships.status,
        })
        .from(playerTeamMemberships)
        .where(
          and(
            eq(playerTeamMemberships.teamId, teamId),
            eq(playerTeamMemberships.seasonId, fixture.seasonId),
            inArray(playerTeamMemberships.status, ["active", "incoming", "loan_in"]),
          ),
        );

      for (const member of members) {
        if (squadPlayerIds.has(member.playerId) || ratedPlayerIds.has(member.playerId)) continue;
        const previousRole = await loadPreviousSquadRole(
          member.playerId,
          fixtureId,
          fixture.competitionId,
        );
        const selection = computeSelectionMovement(previousRole, "not_selected");
        await upsertSelectionTrend({
          playerId: member.playerId,
          teamId,
          competitionId: fixture.competitionId,
          fixtureId,
          previousFixtureId: null,
          currentRole: "not_selected",
          previousRole,
          selectionTrend: selection.trend,
          selectionBadge: selection.badge,
          reason: "not_selected",
          minutesCurrent: 0,
        });
        notSelected += 1;
      }
    }
  }

  return { unusedBench, notSelected };
}

async function loadPreviousSquadRole(
  playerId: string,
  fixtureId: string,
  competitionId: string | null,
): Promise<SquadRole | null> {
  const db = getDb();
  const conditions = [
    eq(playerMatchRatings.playerId, playerId),
    ne(playerMatchRatings.fixtureId, fixtureId),
    sql`${playerMatchRatings.rating} is not null`,
  ];
  if (competitionId) conditions.push(eq(playerMatchRatings.competitionId, competitionId));

  const [previous] = await db
    .select({ squadRole: playerMatchRatings.squadRole })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(and(...conditions))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);

  return (previous?.squadRole as SquadRole | null) ?? null;
}

async function upsertSelectionTrend(input: {
  playerId: string;
  teamId: string | null;
  competitionId: string | null;
  fixtureId: string;
  previousFixtureId: string | null;
  currentRole: SquadRole;
  previousRole: SquadRole | null;
  selectionTrend: SelectionTrend;
  selectionBadge: string;
  reason: string;
  minutesCurrent: number | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select({ id: playerSelectionTrends.id })
    .from(playerSelectionTrends)
    .where(
      and(
        eq(playerSelectionTrends.fixtureId, input.fixtureId),
        eq(playerSelectionTrends.playerId, input.playerId),
      ),
    )
    .limit(1);

  const payload = {
    teamId: input.teamId,
    competitionId: input.competitionId,
    previousFixtureId: input.previousFixtureId,
    currentRole: input.currentRole,
    previousRole: input.previousRole,
    selectionTrend: input.selectionTrend,
    selectionBadge: input.selectionBadge,
    reason: input.reason,
    minutesCurrent: input.minutesCurrent,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(playerSelectionTrends)
      .set(payload)
      .where(eq(playerSelectionTrends.id, existing.id));
    return;
  }

  await db.insert(playerSelectionTrends).values({
    playerId: input.playerId,
    fixtureId: input.fixtureId,
    ...payload,
  });
}

export async function listRatingLabRows(limit = 100) {
  const db = getDb();
  const rows = await db
    .select({
      rating: playerMatchRatings,
      playerName: players.name,
      teamName: teams.name,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(playerMatchRatings)
    .innerJoin(players, eq(playerMatchRatings.playerId, players.id))
    .innerJoin(teams, eq(playerMatchRatings.teamId, teams.id))
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .orderBy(desc(fixtures.kickoffAt), desc(playerMatchRatings.rating))
    .limit(limit);

  return rows.map((row) => ({
    ...row.rating,
    playerName: row.playerName,
    teamName: row.teamName,
    fixtureSlug: row.fixtureSlug,
    kickoffAt: row.kickoffAt,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    flags: buildStrangeCaseFlags(row.rating),
  }));
}

function buildStrangeCaseFlags(row: typeof playerMatchRatings.$inferSelect): string[] {
  const flags: string[] = [];
  const rating = row.manualOverrideRating ?? row.rating;
  if (rating != null && rating >= 7.5 && row.selectionTrend === "down") {
    flags.push("Strong rating but selection down");
  }
  if (rating != null && rating < 5.5 && row.selectionCurrentRole === "starter") {
    flags.push("Poor rating but still starting");
  }
  if (row.performanceTrend === "up" && row.selectionTrend === "down") {
    flags.push("Rating up, selection down");
  }
  if (row.selectionBadge === "BENCH ▼" && rating != null && rating >= 7) {
    flags.push("Benched despite strong rating");
  }
  return flags;
}
