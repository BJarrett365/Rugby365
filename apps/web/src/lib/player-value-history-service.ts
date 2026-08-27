import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerMatchRatings,
  players,
  playerValueHistory,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  classifyValueTrend90d,
  DEFAULT_VALUE_CHANGE_THRESHOLD,
  deriveMarketValue30dMovement,
  shouldSaveValueSnapshot,
  type MarketValueSnapshot,
  type PlayerValueSnapshotType,
} from "./player-market-value-trend-utils";
import { ageAtDate } from "./player-value-backfill-math";
import { computePlayerValue, PLAYER_VALUE_MODEL, type PlayerValueFactor } from "./player-value-math";

export type PlayerValueHistoryRow = {
  id: string;
  playerId: string;
  snapshotDate: Date;
  estimatedValue: number;
  currency: string;
  confidence: number;
  coverage: number | null;
  overallRating: number | null;
  potentialRating: number | null;
  currentFormScore: number | null;
  clubId: string | null;
  clubName: string | null;
  competitionId: string | null;
  contractEndDate: string | null;
  contractMonthsRemaining: number | null;
  ageAtSnapshot: number | null;
  primaryPosition: string | null;
  valueScore: number | null;
  modelVersion: string;
  snapshotType: PlayerValueSnapshotType;
  status: string;
  calculationReason: string | null;
  factorScores: PlayerValueFactor[];
  createdAt: Date;
};

export type SaveValueSnapshotInput = {
  playerId: string;
  estimatedValue: number;
  currency?: "GBP";
  confidence: number;
  coverage?: number | null;
  overallRating?: number | null;
  potentialRating?: number | null;
  currentFormScore?: number | null;
  clubId?: string | null;
  competitionId?: string | null;
  contractEndDate?: string | null;
  contractMonthsRemaining?: number | null;
  ageAtSnapshot?: number | null;
  primaryPosition?: string | null;
  valueScore?: number | null;
  modelVersion: string;
  snapshotType?: PlayerValueSnapshotType;
  status?: string;
  calculationReason?: string | null;
  factorScores?: PlayerValueFactor[];
  snapshotDate?: Date;
  /** Force persist regardless of threshold (material events). */
  materialEvent?: boolean;
  changeThreshold?: number;
};

function rowToSnapshot(row: PlayerValueHistoryRow): MarketValueSnapshot {
  return {
    snapshotAt: row.snapshotDate,
    marketValueGbp: row.estimatedValue,
    confidence: row.confidence,
    overallRating: row.overallRating,
    clubName: row.clubName,
    modelVersion: row.modelVersion,
    snapshotType: row.snapshotType,
    coverage: row.coverage,
  };
}

export async function getLatestValueSnapshot(playerId: string): Promise<PlayerValueHistoryRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: playerValueHistory.id,
      playerId: playerValueHistory.playerId,
      snapshotDate: playerValueHistory.snapshotDate,
      estimatedValue: playerValueHistory.estimatedValue,
      currency: playerValueHistory.currency,
      confidence: playerValueHistory.confidence,
      coverage: playerValueHistory.coverage,
      overallRating: playerValueHistory.overallRating,
      potentialRating: playerValueHistory.potentialRating,
      currentFormScore: playerValueHistory.currentFormScore,
      clubId: playerValueHistory.clubId,
      clubName: teams.name,
      competitionId: playerValueHistory.competitionId,
      contractEndDate: playerValueHistory.contractEndDate,
      contractMonthsRemaining: playerValueHistory.contractMonthsRemaining,
      ageAtSnapshot: playerValueHistory.ageAtSnapshot,
      primaryPosition: playerValueHistory.primaryPosition,
      valueScore: playerValueHistory.valueScore,
      modelVersion: playerValueHistory.modelVersion,
      snapshotType: playerValueHistory.snapshotType,
      status: playerValueHistory.status,
      calculationReason: playerValueHistory.calculationReason,
      factorScores: playerValueHistory.factorScores,
      createdAt: playerValueHistory.createdAt,
    })
    .from(playerValueHistory)
    .leftJoin(teams, eq(playerValueHistory.clubId, teams.id))
    .where(eq(playerValueHistory.playerId, playerId))
    .orderBy(desc(playerValueHistory.snapshotDate))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    snapshotType: (row.snapshotType?.toUpperCase() ?? "LIVE") as PlayerValueSnapshotType,
    factorScores: Array.isArray(row.factorScores) ? (row.factorScores as PlayerValueFactor[]) : [],
    contractEndDate: row.contractEndDate ? String(row.contractEndDate) : null,
  };
}

const VALUE_HISTORY_SELECT = {
  id: playerValueHistory.id,
  playerId: playerValueHistory.playerId,
  snapshotDate: playerValueHistory.snapshotDate,
  estimatedValue: playerValueHistory.estimatedValue,
  currency: playerValueHistory.currency,
  confidence: playerValueHistory.confidence,
  coverage: playerValueHistory.coverage,
  overallRating: playerValueHistory.overallRating,
  potentialRating: playerValueHistory.potentialRating,
  currentFormScore: playerValueHistory.currentFormScore,
  clubId: playerValueHistory.clubId,
  clubName: teams.name,
  competitionId: playerValueHistory.competitionId,
  contractEndDate: playerValueHistory.contractEndDate,
  contractMonthsRemaining: playerValueHistory.contractMonthsRemaining,
  ageAtSnapshot: playerValueHistory.ageAtSnapshot,
  primaryPosition: playerValueHistory.primaryPosition,
  valueScore: playerValueHistory.valueScore,
  modelVersion: playerValueHistory.modelVersion,
  snapshotType: playerValueHistory.snapshotType,
  status: playerValueHistory.status,
  calculationReason: playerValueHistory.calculationReason,
  factorScores: playerValueHistory.factorScores,
  createdAt: playerValueHistory.createdAt,
} as const;

function mapValueHistoryRows(
  rows: Array<{
    id: string;
    playerId: string;
    snapshotDate: Date;
    estimatedValue: number;
    currency: string;
    confidence: number;
    coverage: number | null;
    overallRating: number | null;
    potentialRating: number | null;
    currentFormScore: number | null;
    clubId: string | null;
    clubName: string | null;
    competitionId: string | null;
    contractEndDate: string | Date | null;
    contractMonthsRemaining: number | null;
    ageAtSnapshot: number | null;
    primaryPosition: string | null;
    valueScore: number | null;
    modelVersion: string;
    snapshotType: string;
    status: string;
    calculationReason: string | null;
    factorScores: unknown;
    createdAt: Date;
  }>,
): PlayerValueHistoryRow[] {
  return rows.map((row) => ({
    ...row,
    snapshotType: (row.snapshotType?.toUpperCase() ?? "LIVE") as PlayerValueSnapshotType,
    factorScores: Array.isArray(row.factorScores) ? (row.factorScores as PlayerValueFactor[]) : [],
    contractEndDate: row.contractEndDate ? String(row.contractEndDate) : null,
  }));
}

export async function getValueHistory(
  playerId: string,
  rangeMonths = 24,
): Promise<PlayerValueHistoryRow[]> {
  const db = getDb();
  const rangeStart = new Date();
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - rangeMonths);

  const rows = await db
    .select(VALUE_HISTORY_SELECT)
    .from(playerValueHistory)
    .leftJoin(teams, eq(playerValueHistory.clubId, teams.id))
    .where(and(eq(playerValueHistory.playerId, playerId), gte(playerValueHistory.snapshotDate, rangeStart)))
    .orderBy(asc(playerValueHistory.snapshotDate));

  return mapValueHistoryRows(rows);
}

/** All persisted value snapshots for career VALUE TIMELINE (no fabricated points). */
export async function getValueHistoryCareer(playerId: string): Promise<PlayerValueHistoryRow[]> {
  const db = getDb();
  const rows = await db
    .select(VALUE_HISTORY_SELECT)
    .from(playerValueHistory)
    .leftJoin(teams, eq(playerValueHistory.clubId, teams.id))
    .where(eq(playerValueHistory.playerId, playerId))
    .orderBy(asc(playerValueHistory.snapshotDate));

  return mapValueHistoryRows(rows);
}

export async function saveValueSnapshot(input: SaveValueSnapshotInput): Promise<PlayerValueHistoryRow | null> {
  const latest = await getLatestValueSnapshot(input.playerId);
  const now = input.snapshotDate ?? new Date();

  const decision = shouldSaveValueSnapshot({
    previousValueGbp: latest?.estimatedValue ?? null,
    nextValueGbp: input.estimatedValue,
    materialEvent: input.materialEvent,
    lastSnapshotAt: latest?.snapshotDate ?? null,
    now,
    changeThreshold: input.changeThreshold ?? DEFAULT_VALUE_CHANGE_THRESHOLD,
  });

  if (!decision.shouldSave) return null;

  const db = getDb();
  const [saved] = await db
    .insert(playerValueHistory)
    .values({
      playerId: input.playerId,
      snapshotDate: now,
      estimatedValue: input.estimatedValue,
      currency: input.currency ?? "GBP",
      confidence: input.confidence,
      coverage: input.coverage ?? null,
      overallRating: input.overallRating ?? null,
      potentialRating: input.potentialRating ?? null,
      currentFormScore: input.currentFormScore ?? null,
      clubId: input.clubId ?? null,
      competitionId: input.competitionId ?? null,
      contractEndDate: input.contractEndDate ?? null,
      contractMonthsRemaining: input.contractMonthsRemaining ?? null,
      ageAtSnapshot: input.ageAtSnapshot ?? null,
      primaryPosition: input.primaryPosition ?? null,
      valueScore: input.valueScore ?? null,
      modelVersion: input.modelVersion,
      snapshotType: input.snapshotType ?? "LIVE",
      status: input.status ?? "active",
      calculationReason: input.calculationReason ?? decision.reason,
      factorScores: input.factorScores ?? [],
    })
    .returning();

  if (!saved) return null;

  let clubName: string | null = null;
  if (saved.clubId) {
    const [club] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, saved.clubId)).limit(1);
    clubName = club?.name ?? null;
  }

  return {
    ...saved,
    clubName,
    snapshotType: (saved.snapshotType?.toUpperCase() ?? "LIVE") as PlayerValueSnapshotType,
    factorScores: Array.isArray(saved.factorScores) ? (saved.factorScores as PlayerValueFactor[]) : [],
    contractEndDate: saved.contractEndDate ? String(saved.contractEndDate) : null,
  };
}

export async function compute30DayChange(playerId: string) {
  const history = await getValueHistory(playerId, 24);
  return deriveMarketValue30dMovement({
    snapshots: history.map(rowToSnapshot),
    toleranceDays: 15,
  });
}

export async function classifyValueTrend(playerId: string) {
  const history = await getValueHistory(playerId, 24);
  return classifyValueTrend90d({
    snapshots: history.map(rowToSnapshot),
    toleranceDays: 15,
  });
}

/**
 * Backfill historic value snapshots using period-accurate inputs.
 * Monthly month-end only; never overwrites LIVE; never uses today's OVR/age/club for historic points.
 */
export async function backfillPlayerValueHistory(
  playerId: string,
  options: {
    from?: Date;
    to?: Date;
    range?: 6 | 12 | 24 | "career";
    now?: Date;
  } = {},
): Promise<{ inserted: number; skipped: number; quality?: unknown }> {
  const { runPlayerValueHistoryBackfill } = await import("./player-value-backfill-service");
  let range: 6 | 12 | 24 | "career" = options.range ?? 6;
  if (options.from && options.to && options.range == null) {
    const months =
      (options.to.getUTCFullYear() - options.from.getUTCFullYear()) * 12 +
      (options.to.getUTCMonth() - options.from.getUTCMonth()) +
      1;
    if (months <= 6) range = 6;
    else if (months <= 12) range = 12;
    else if (months <= 24) range = 24;
    else range = "career";
  }
  const result = await runPlayerValueHistoryBackfill(playerId, range, { now: options.now });
  return { inserted: result.inserted, skipped: result.skipped, quality: result.quality };
}

/** Career VALUE TIMELINE read model from persisted snapshots only. */
export async function getPlayerValueTimeline(playerId: string, now = new Date()) {
  const { deriveCareerValueTimeline } = await import("./player-value-timeline-utils");
  const rows = await getValueHistoryCareer(playerId);
  const snapshots = rows.map(rowToSnapshot);
  return deriveCareerValueTimeline({ snapshots, now });
}

export async function auditPlayerValueHistory(playerId: string) {
  const db = getDb();
  const rows = await db
    .select({
      snapshotDate: playerValueHistory.snapshotDate,
      snapshotType: playerValueHistory.snapshotType,
      estimatedValue: playerValueHistory.estimatedValue,
    })
    .from(playerValueHistory)
    .where(eq(playerValueHistory.playerId, playerId))
    .orderBy(asc(playerValueHistory.snapshotDate));

  const byType: Record<string, number> = {};
  for (const row of rows) {
    const key = (row.snapshotType ?? "UNKNOWN").toUpperCase();
    byType[key] = (byType[key] ?? 0) + 1;
  }

  return {
    count: rows.length,
    earliest: rows[0]?.snapshotDate?.toISOString() ?? null,
    latest: rows[rows.length - 1]?.snapshotDate?.toISOString() ?? null,
    byType,
    rows: rows.map((r) => ({
      date: r.snapshotDate.toISOString(),
      type: r.snapshotType,
      valueGbp: r.estimatedValue,
    })),
  };
}

/**
 * Rebuild historic market-value points from real appearance years only.
 * Each year with fixtures gets one snapshot on the last kickoff of that year,
 * valued with period age / club / competition / match ratings — not today's value copied back.
 */
export async function rebuildValueTimelineFromAppearances(
  playerId: string,
): Promise<{ inserted: number; years: number[] }> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return { inserted: 0, years: [] };

  const yearRows = await db
    .select({
      year: sql<number>`extract(year from ${fixtures.kickoffAt})::int`,
      lastKickoff: sql<Date>`max(${fixtures.kickoffAt})`,
      apps: sql<number>`count(*)::int`,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixtures.id, fixturePlayers.fixtureId))
    .where(eq(fixturePlayers.playerId, playerId))
    .groupBy(sql`extract(year from ${fixtures.kickoffAt})`)
    .orderBy(sql`extract(year from ${fixtures.kickoffAt})`);

  if (yearRows.length === 0) return { inserted: 0, years: [] };

  // Drop prior appearance reconstructions so re-runs stay idempotent.
  await db
    .delete(playerValueHistory)
    .where(
      and(
        eq(playerValueHistory.playerId, playerId),
        eq(playerValueHistory.calculationReason, "APPEARANCE_YEAR_RECONSTRUCTION"),
      ),
    );

  const existing = await db
    .select({
      snapshotDate: playerValueHistory.snapshotDate,
      snapshotType: playerValueHistory.snapshotType,
    })
    .from(playerValueHistory)
    .where(eq(playerValueHistory.playerId, playerId));
  const blockedMonths = new Set(
    existing
      .filter((r) => (r.snapshotType ?? "").toUpperCase() === "LIVE")
      .map((r) => r.snapshotDate.toISOString().slice(0, 7)),
  );

  let inserted = 0;
  const years: number[] = [];

  for (const row of yearRows) {
    const asOf = new Date(row.lastKickoff);
    if (Number.isNaN(asOf.getTime())) continue;
    const monthKey = asOf.toISOString().slice(0, 7);
    if (blockedMonths.has(monthKey)) continue;

    const [side] = await db
      .select({
        teamId: fixturePlayers.teamId,
        teamName: teams.name,
        competitionId: fixtures.competitionId,
        competitionSlug: competitions.slug,
        competitionName: competitions.name,
      })
      .from(fixturePlayers)
      .innerJoin(fixtures, eq(fixtures.id, fixturePlayers.fixtureId))
      .leftJoin(teams, eq(teams.id, fixturePlayers.teamId))
      .leftJoin(competitions, eq(competitions.id, fixtures.competitionId))
      .where(
        and(
          eq(fixturePlayers.playerId, playerId),
          eq(fixtures.kickoffAt, asOf),
        ),
      )
      .limit(1);

    if (!side?.teamId || !(side.competitionId || side.competitionSlug || side.competitionName)) {
      continue;
    }

    const priorRatings = await db
      .select({ rating: playerMatchRatings.rating })
      .from(playerMatchRatings)
      .innerJoin(fixtures, eq(fixtures.id, playerMatchRatings.fixtureId))
      .where(
        and(
          eq(playerMatchRatings.playerId, playerId),
          lte(fixtures.kickoffAt, asOf),
          sql`${playerMatchRatings.rating} is not null`,
        ),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(5);

    const lastFive = priorRatings
      .map((r) => Number(r.rating))
      .filter((n) => Number.isFinite(n))
      .map((n) => (n > 10 ? n / 10 : n))
      .reverse();

    if (lastFive.length < 1) continue;

    const matchAvg = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
    const overallRating = Math.round(55 + matchAvg * 4);
    const formScore = overallRating;
    const age = ageAtDate(player.birthDate, asOf);

    const [capsRow] = await db
      .select({ caps: sql<number>`count(*)::int` })
      .from(fixturePlayers)
      .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
      .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
      .where(
        and(
          eq(fixturePlayers.playerId, playerId),
          lte(fixtures.kickoffAt, asOf),
          sql`(
            ${competitions.competitionType} in ('international', 'world_cup')
            or ${competitions.slug} ilike '%nations%'
            or ${competitions.slug} ilike '%world-cup%'
            or ${competitions.name} ilike '%nations%'
            or ${competitions.name} ilike '%world cup%'
            or ${competitions.name} ilike '%all black%'
          )`,
        ),
      );

    const result = computePlayerValue({
      currentRating: overallRating,
      seasonRating: null,
      formScore,
      lastFiveMatchRatings: lastFive,
      potential: null,
      reputation: null,
      age,
      positionName: player.positionName,
      competitionKey: side.competitionSlug ?? side.competitionName,
      internationalCaps: Number(capsRow?.caps ?? 0),
      contractMonthsRemaining: null,
      daysUnavailableLastYear: null,
      isCaptain: null,
      hasSocialPresence: false,
      mediaNudgePct: null,
    });

    await db.insert(playerValueHistory).values({
      playerId,
      snapshotDate: asOf,
      estimatedValue: result.marketValueGbp,
      currency: "GBP",
      confidence: Math.min(result.confidence, 0.62),
      coverage: 70,
      overallRating,
      potentialRating: null,
      currentFormScore: formScore,
      clubId: side.teamId,
      competitionId: side.competitionId,
      contractEndDate: null,
      contractMonthsRemaining: null,
      ageAtSnapshot: age,
      primaryPosition: player.positionName,
      valueScore: null,
      modelVersion: PLAYER_VALUE_MODEL,
      snapshotType: "BACKFILLED",
      status: "active",
      calculationReason: "APPEARANCE_YEAR_RECONSTRUCTION",
      factorScores: result.factors,
    });

    inserted += 1;
    years.push(row.year);
    blockedMonths.add(monthKey);
  }

  return { inserted, years };
}
