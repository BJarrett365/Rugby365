/**
 * Load recent appearance inputs for PlayerFormEngine + optional persist.
 */
import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerFormHistory,
  playerMatchPerformanceStats,
  playerMatchRatings,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  computePlayerFormScore,
  PLAYER_FORM_MODEL,
  type PlayerFormMatchInput,
  type PlayerFormResult,
} from "./player-form-engine";

function extrasNum(extras: unknown, ...keys: string[]): number | null {
  if (!extras || typeof extras !== "object") return null;
  const row = extras as Record<string, unknown>;
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function normalizeRating(r: number | null): number | null {
  if (r == null || !Number.isFinite(r)) return null;
  if (r > 10) return Math.round((r / 10) * 10) / 10;
  return Math.round(r * 10) / 10;
}

function resultFromScores(
  teamId: string | null,
  homeTeamId: string | null,
  awayTeamId: string | null,
  homeScore: number,
  awayScore: number,
  status: string,
): "W" | "D" | "L" | null {
  const s = status.toLowerCase();
  const finished =
    s.includes("full") || s === "ft" || s.includes("complete") || s === "result" || s === "finished";
  if (!finished || !teamId) return null;
  const isHome = teamId === homeTeamId;
  const isAway = teamId === awayTeamId;
  if (!isHome && !isAway) return null;
  const forPts = isHome ? homeScore : awayScore;
  const against = isHome ? awayScore : homeScore;
  if (forPts > against) return "W";
  if (forPts < against) return "L";
  return "D";
}

export async function loadPlayerFormMatchInputs(
  playerId: string,
  limit = 10,
): Promise<PlayerFormMatchInput[]> {
  const db = getDb();

  const fpRows = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      teamId: fixturePlayers.teamId,
      points: fixturePlayers.points,
      tries: fixturePlayers.tries,
      conversions: fixturePlayers.conversions,
      penalties: fixturePlayers.penalties,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(Math.max(limit * 2, 20));

  if (!fpRows.length) return [];

  const fixtureIds = fpRows.map((r) => r.fixtureId);

  const [perfRows, ratingRows] = await Promise.all([
    db
      .select({
        fixtureId: playerMatchPerformanceStats.fixtureId,
        minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
        points: playerMatchPerformanceStats.points,
        tries: playerMatchPerformanceStats.tries,
        tryAssists: playerMatchPerformanceStats.tryAssists,
        lineBreaks: playerMatchPerformanceStats.lineBreaks,
        tacklesMade: playerMatchPerformanceStats.tacklesMade,
        metresCarried: playerMatchPerformanceStats.metresCarried,
        carries: playerMatchPerformanceStats.carries,
        turnoversWon: playerMatchPerformanceStats.turnoversWon,
        defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
        extras: playerMatchPerformanceStats.extras,
      })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          eq(playerMatchPerformanceStats.playerId, playerId),
          inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
        ),
      ),
    db
      .select({
        fixtureId: playerMatchRatings.fixtureId,
        rating: playerMatchRatings.rating,
      })
      .from(playerMatchRatings)
      .where(
        and(
          eq(playerMatchRatings.playerId, playerId),
          inArray(playerMatchRatings.fixtureId, fixtureIds),
        ),
      ),
  ]);

  const perfByFixture = new Map(perfRows.map((r) => [r.fixtureId, r]));
  const ratingByFixture = new Map(ratingRows.map((r) => [r.fixtureId, r.rating]));

  const inputs: PlayerFormMatchInput[] = [];
  for (const row of fpRows) {
    const perf = perfByFixture.get(row.fixtureId);
    const extras = perf?.extras;
    const kicks =
      extrasNum(extras, "kicksFromHand", "kicks_from_hand", "kicks") ?? null;
    const goalKickAttempts =
      extrasNum(
        extras,
        "goalKickAttempts",
        "goal_kick_attempts",
        "shotsAtGoal",
        "shots_at_goal",
      ) ?? null;
    const goalKicksMade =
      extrasNum(extras, "goalKicksMade", "goal_kicks_made") ??
      (row.conversions != null || row.penalties != null
        ? (row.conversions ?? 0) + (row.penalties ?? 0)
        : null);

    inputs.push({
      matchRating: normalizeRating(ratingByFixture.get(row.fixtureId) ?? null),
      minutes: perf?.minutesPlayed ?? null,
      points: perf?.points ?? row.points ?? null,
      result: resultFromScores(
        row.teamId,
        row.homeTeamId,
        row.awayTeamId,
        row.homeScore,
        row.awayScore,
        row.status,
      ),
      conversions: row.conversions,
      penalties: row.penalties,
      goalKicksMade,
      goalKickAttempts,
      tryAssists: perf?.tryAssists ?? null,
      kicks,
      lineBreaks: perf?.lineBreaks ?? null,
      tries: perf?.tries ?? row.tries ?? null,
      tackles: perf?.tacklesMade ?? null,
      metres: perf?.metresCarried ?? null,
      carries: perf?.carries ?? null,
      turnovers: perf?.turnoversWon ?? null,
      defendersBeaten: perf?.defendersBeaten ?? null,
    });
    if (inputs.length >= limit) break;
  }

  return inputs;
}

export async function computePlayerFormForPlayer(input: {
  playerId: string;
  positionName?: string | null;
  limit?: number;
}): Promise<PlayerFormResult> {
  const matches = await loadPlayerFormMatchInputs(input.playerId, input.limit ?? 10);
  return computePlayerFormScore(matches, {
    limit: input.limit ?? 10,
    positionName: input.positionName,
  });
}

/** Persist current form snapshot (is_current). Safe no-op if table missing mid-migrate. */
export async function persistPlayerFormHistory(input: {
  playerId: string;
  form: PlayerFormResult;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  try {
    await db
      .update(playerFormHistory)
      .set({ isCurrent: false })
      .where(and(eq(playerFormHistory.playerId, input.playerId), eq(playerFormHistory.isCurrent, true)));

    await db.insert(playerFormHistory).values({
      playerId: input.playerId,
      formScore: input.form.formScore,
      formLabel: input.form.formLabel,
      confidence: input.form.confidence,
      matchesUsed: input.form.matchesUsed,
      appearancesEligible: input.form.appearancesEligible,
      modelVersion: input.form.modelVersion || PLAYER_FORM_MODEL,
      resultStrip: input.form.resultStrip,
      components: input.form.components,
      metrics: input.form.metricDisplays,
      calculationReason: input.reason ?? "recalculated",
      isCurrent: true,
      calculatedAt: now,
    });
  } catch {
    /* table may not exist yet during rollout */
  }
}
