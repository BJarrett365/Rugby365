import "server-only";

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { playerValueHistory, teams } from "@rugby365/db";
import { getDb } from "./db";
import {
  classifyValueTrend90d,
  DEFAULT_VALUE_CHANGE_THRESHOLD,
  deriveMarketValue30dMovement,
  shouldSaveValueSnapshot,
  type MarketValueSnapshot,
  type PlayerValueSnapshotType,
} from "./player-market-value-trend-utils";
import type { PlayerValueFactor } from "./player-value-math";

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
