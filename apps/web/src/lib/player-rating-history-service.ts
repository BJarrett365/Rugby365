import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { playerRatingHistory } from "@rugby365/db";
import { getDb } from "./db";
import {
  buildRatingHistorySummary,
  extractRatingMetricSeries,
  type RatingHistoryPoint,
  type RatingHistorySummary,
} from "./player-rating-history-utils";

export type PlayerRatingSnapshotType = "LIVE" | "BACKFILLED" | "RECALCULATED";

export type SavePlayerRatingHistoryInput = {
  playerId: string;
  overallRating: number;
  previousRating?: number | null;
  ratingChange?: number | null;
  attack?: number | null;
  defence?: number | null;
  kicking?: number | null;
  playmaking?: number | null;
  gameManagement?: number | null;
  physical?: number | null;
  form?: number | null;
  confidence?: number | null;
  coverage?: number | null;
  modelVersion?: string;
  snapshotType?: PlayerRatingSnapshotType;
  fixtureId?: string | null;
  teamId?: string | null;
  competitionId?: string | null;
  matchDate?: Date | null;
  competitionName?: string | null;
  teamName?: string | null;
  opponentName?: string | null;
  fixtureSlug?: string | null;
  majorMatchLabel?: string | null;
  intelligence?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
};

/** player_rating_history.confidence is integer 0–100; ratingConfidence is often 0–1 real. */
function normalizeHistoryConfidence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 1) return Math.round(Math.max(0, Math.min(1, value)) * 100);
  return Math.round(Math.max(0, Math.min(100, value)));
}

/**
 * Persist an overall-ability rating snapshot.
 * Call on match complete / material recalc — never on public page load.
 * Upserts when fixtureId is set (unique per player+fixture).
 */
export async function savePlayerRatingHistorySnapshot(
  input: SavePlayerRatingHistoryInput,
): Promise<{ id: string } | null> {
  if (!Number.isFinite(input.overallRating)) return null;
  // Reject obvious 0–10 match ratings leaking into overall ability history.
  if (input.overallRating > 0 && input.overallRating <= 10) return null;

  const db = getDb();
  const snapshotType = (input.snapshotType ?? "LIVE").toLowerCase();
  const patch = {
    overallRating: input.overallRating,
    previousRating: input.previousRating ?? null,
    ratingChange: input.ratingChange ?? null,
    attack: input.attack ?? null,
    defence: input.defence ?? null,
    kicking: input.kicking ?? null,
    playmaking: input.playmaking ?? null,
    gameManagement: input.gameManagement ?? null,
    physical: input.physical ?? null,
    form: input.form ?? null,
    confidence: normalizeHistoryConfidence(input.confidence),
    coverage: input.coverage ?? null,
    modelVersion: input.modelVersion ?? "player-fly-half-v1",
    intelligence: input.intelligence ?? {},
    metrics: input.metrics ?? {},
    snapshotType,
    matchDate: input.matchDate ?? new Date(),
    calculatedAt: new Date(),
    majorMatchLabel: input.majorMatchLabel ?? null,
    competitionName: input.competitionName ?? null,
    teamName: input.teamName ?? null,
    opponentName: input.opponentName ?? null,
    fixtureSlug: input.fixtureSlug ?? null,
    teamId: input.teamId ?? null,
    competitionId: input.competitionId ?? null,
  };

  if (input.fixtureId) {
    const [existing] = await db
      .select({ id: playerRatingHistory.id })
      .from(playerRatingHistory)
      .where(
        and(
          eq(playerRatingHistory.playerId, input.playerId),
          eq(playerRatingHistory.fixtureId, input.fixtureId),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(playerRatingHistory)
        .set(patch)
        .where(eq(playerRatingHistory.id, existing.id));
      return existing;
    }
  }

  const [saved] = await db
    .insert(playerRatingHistory)
    .values({
      playerId: input.playerId,
      fixtureId: input.fixtureId ?? null,
      ...patch,
    })
    .returning({ id: playerRatingHistory.id });
  return saved ?? null;
}

export async function getPlayerRatingHistoryRows(playerId: string, limit = 200) {
  const db = getDb();
  return db
    .select()
    .from(playerRatingHistory)
    .where(eq(playerRatingHistory.playerId, playerId))
    .orderBy(asc(playerRatingHistory.matchDate))
    .limit(limit);
}

export async function getLatestPlayerRatingHistory(playerId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(playerRatingHistory)
    .where(eq(playerRatingHistory.playerId, playerId))
    .orderBy(desc(playerRatingHistory.matchDate), desc(playerRatingHistory.calculatedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Overall-ability series only (excludes 0–10 match-score leakage).
 * BACKFILLED overall ratings (0–100) are valid history — include them.
 */
export function buildOverallAbilitySeriesFromRows(
  rows: Array<{
    matchDate: Date | null;
    calculatedAt: Date;
    overallRating: number;
    ratingChange: number | null;
    attack: number | null;
    defence: number | null;
    kicking: number | null;
    playmaking: number | null;
    gameManagement: number | null;
    physical: number | null;
    form: number | null;
    opponentName: string | null;
    competitionName: string | null;
    fixtureSlug: string | null;
    majorMatchLabel: string | null;
    snapshotType: string;
  }>,
): { series: RatingHistoryPoint[]; summary: RatingHistorySummary } {
  const mapped = rows.map((r) => {
    const looksLikeMatchScore = r.overallRating > 0 && r.overallRating <= 10;
    const seriesKind = looksLikeMatchScore
      ? ("match_performance" as const)
      : ("overall_ability" as const);
    return {
      date: (r.matchDate ?? r.calculatedAt).toISOString(),
      overall: r.overallRating,
      change: r.ratingChange,
      attack: r.attack,
      defence: r.defence,
      kicking: r.kicking,
      playmaking: r.playmaking,
      gameManagement: r.gameManagement,
      physical: r.physical,
      form: r.form,
      opponentName: r.opponentName,
      competitionName: r.competitionName,
      fixtureSlug: r.fixtureSlug,
      majorMatchLabel: r.majorMatchLabel,
      snapshotType: r.snapshotType,
      seriesKind,
    };
  });

  const abilityRows = mapped.filter((r) => r.seriesKind === "overall_ability");
  const series = extractRatingMetricSeries(abilityRows, "overall");
  return { series, summary: buildRatingHistorySummary(series) };
}

/** Seed a LIVE snapshot from current player_ratings when history is empty (material recalc). */
export async function ensureCurrentRatingHistorySnapshot(input: {
  playerId: string;
  overallRating: number;
  previousRating?: number | null;
  attack?: number | null;
  defence?: number | null;
  kicking?: number | null;
  playmaking?: number | null;
  gameManagement?: number | null;
  physical?: number | null;
  form?: number | null;
  confidence?: number | null;
  coverage?: number | null;
  modelVersion?: string;
}): Promise<{ id: string } | null> {
  const latest = await getLatestPlayerRatingHistory(input.playerId);
  if (latest) {
    const delta =
      latest.overallRating > 0
        ? Math.abs(input.overallRating - latest.overallRating) / latest.overallRating
        : 1;
    // Only append when material change (≥0.5 absolute or ≥1%).
    if (Math.abs(input.overallRating - latest.overallRating) < 0.5 && delta < 0.01) {
      return null;
    }
  }

  return savePlayerRatingHistorySnapshot({
    playerId: input.playerId,
    overallRating: input.overallRating,
    previousRating: latest?.overallRating ?? input.previousRating ?? null,
    ratingChange:
      latest != null ? Math.round((input.overallRating - latest.overallRating) * 10) / 10 : null,
    attack: input.attack,
    defence: input.defence,
    kicking: input.kicking,
    playmaking: input.playmaking,
    gameManagement: input.gameManagement,
    physical: input.physical,
    form: input.form,
    confidence: input.confidence,
    coverage: input.coverage,
    modelVersion: input.modelVersion,
    snapshotType: latest ? "RECALCULATED" : "LIVE",
    matchDate: new Date(),
  });
}
