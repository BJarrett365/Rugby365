/** Overlay Wikipedia / match-event scoring onto competition player leaderboards. */

import { normalizeScorerKey } from "./event-scorer-match";

export function scoringRowKey(playerId: string, teamId: string): string {
  return `${playerId}:${teamId}`;
}

const LEADERBOARD_COUNT_KEYS = [
  "appearances",
  "minutesPlayed",
  "points",
  "tries",
  "tacklesCompleted",
  "metresCarried",
  "carries",
  "tryAssists",
  "defendersBeaten",
  "lineBreaks",
  "turnoversWon",
  "dominantTackles",
  "postContactMetres",
] as const;

type LeaderboardIdentityRow = {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerImageUrl?: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string;
  appearances?: number;
  minutesPlayed?: number;
  points?: number;
  tries?: number;
  tacklesCompleted?: number;
  metresCarried?: number;
  carries?: number;
  tryAssists?: number;
  defendersBeaten?: number;
  lineBreaks?: number;
  turnoversWon?: number;
  dominantTackles?: number;
  postContactMetres?: number;
};

export function leaderboardDuplicateKey(row: {
  playerName: string;
  teamSlug: string;
}): string {
  return `${normalizeScorerKey(row.playerName)}|${row.teamSlug}`;
}

function leaderboardIdentityRank(row: LeaderboardIdentityRow): number {
  let score = 0;
  if (!row.playerSlug.includes("__legacy__")) score += 10_000;
  if (row.playerImageUrl) score += 1_000;
  if (row.playerName.includes("'") || row.playerName.includes("\u2019")) score += 100;
  score += (row.appearances ?? 0) * 10;
  score += row.points ?? 0;
  score += Math.min(row.playerName.length, 40);
  return score;
}

function maxMetric(
  a: LeaderboardIdentityRow,
  b: LeaderboardIdentityRow,
  key: (typeof LEADERBOARD_COUNT_KEYS)[number],
): number {
  return Math.max(Number(a[key] ?? 0), Number(b[key] ?? 0));
}

/**
 * Collapse canonical vs legacy (and apostrophe-variant) player rows so the same
 * person is not listed twice on a competition leaderboard.
 */
export function collapseDuplicateLeaderboardPlayers<T extends LeaderboardIdentityRow>(
  rows: T[],
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const normalized = normalizeScorerKey(row.playerName);
    const key = normalized ? leaderboardDuplicateKey(row) : `${row.playerId}:${row.teamId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row });
      continue;
    }
    const keep = leaderboardIdentityRank(row) > leaderboardIdentityRank(existing) ? row : existing;
    const other = keep === row ? existing : row;
    const merged = { ...keep };
    for (const metric of LEADERBOARD_COUNT_KEYS) {
      (merged as Record<string, unknown>)[metric] = maxMetric(keep, other, metric);
    }
    byKey.set(key, merged);
  }
  return [...byKey.values()];
}

export function aggregatesHaveScoring(
  rows: Array<{ tries?: number; points?: number }>,
): boolean {
  return rows.some((row) => (row.tries ?? 0) > 0 || (row.points ?? 0) > 0);
}

export function mergeEventScoringIntoRows<
  T extends { playerId: string; teamId: string; tries: number; points: number },
>(rows: T[], scoring: T[]): T[] {
  const byKey = new Map(rows.map((row) => [scoringRowKey(row.playerId, row.teamId), { ...row }]));
  for (const event of scoring) {
    const key = scoringRowKey(event.playerId, event.teamId);
    const existing = byKey.get(key);
    if (existing) {
      existing.tries = Math.max(existing.tries, event.tries);
      existing.points = Math.max(existing.points, event.points);
      byKey.set(key, existing);
      continue;
    }
    byKey.set(key, { ...event });
  }
  return [...byKey.values()];
}

/** Historical box scores rarely include try assists; don't rank a single imported match as the season. */
export function clearTryAssists<T extends { tryAssists: number }>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row, tryAssists: 0 }));
}
