/**
 * Rugby365 Match Ratings (0–10 scale) for lineup display.
 * Stored per fixture+player — do not invent a separate display rating.
 */
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerRatings,
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
};

const EMPTY_SQUAD_RANKINGS: SquadPlayerRankings = {
  careerRating: null,
  formRating: null,
  formLabel: "—",
  latestMatchRating: null,
};

/** Batch career + form (+ optional latest fixture match) for squad tables. */
export async function listSquadRankingsForPlayerIds(
  playerIds: string[],
  options?: {
    latestFixtureId?: string | null;
    latestFixturePublished?: boolean;
  },
): Promise<Map<string, SquadPlayerRankings>> {
  const unique = [...new Set(playerIds.filter(Boolean))];
  const result = new Map<string, SquadPlayerRankings>();
  if (!unique.length) return result;

  const [careerMap, recentMap] = await Promise.all([
    loadCareerRatingsByPlayerId(unique),
    loadRecentMatchRatingsByPlayerId(unique, null, 10),
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
    });
  }
  return result;
}

export function emptySquadRankings(): SquadPlayerRankings {
  return { ...EMPTY_SQUAD_RANKINGS };
}

function careerFormRatingDisplay(
  link: CmsEntityLink,
  rankings: SquadPlayerRankings,
): MatchRatingDisplay {
  return {
    playerId: link.id,
    externalPlayerId: link.externalProviderId,
    teamId: "",
    playerName: link.name,
    jerseyNumber: null,
    positionName: null,
    squadRole: "starter",
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
    const existing = byPlayer.get(playerId);
    if (existing) {
      if (existing.careerRating == null && rank.careerRating != null) {
        existing.careerRating = rank.careerRating;
      }
      if (existing.formRating == null && rank.formRating != null) {
        existing.formRating = rank.formRating;
        existing.formLabel = rank.formLabel;
      }
      byPlayer.set(playerId, existing);
      continue;
    }
    const link = linkById.get(playerId);
    if (!link) continue;
    if (rank.careerRating == null && rank.formRating == null) continue;
    byPlayer.set(playerId, careerFormRatingDisplay(link, rank));
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

  const ratings = await attachCareerAndFormToLineupRatings(bundle.ratings, [
    ...linkById.values(),
  ]);
  return { ...bundle, ratings };
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

  const perfRows = await db
    .select()
    .from(playerMatchPerformanceStats)
    .where(eq(playerMatchPerformanceStats.fixtureId, fixtureId));

  const squadRows = await db
    .select()
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  const squadByPlayer = new Map(squadRows.map((s) => [s.playerId, s]));

  const status: MatchRatingStatus = "final";

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
  if (best && status === "final") {
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

  return { calculated, potmPlayerId, coachesCalculated, refereeCalculated };
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
