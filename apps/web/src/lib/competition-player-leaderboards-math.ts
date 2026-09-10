/** Pure leaderboard helpers — kept out of the DB service so unit tests stay offline. */

export const RUGBY_CHAMPIONSHIP_ADVANCED_LEADERBOARD_METRICS = [
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

export type RugbyChampionshipAdvancedLeaderboardMetric =
  (typeof RUGBY_CHAMPIONSHIP_ADVANCED_LEADERBOARD_METRICS)[number];

/** Metrics with all zeros are treated as untracked, not as a zero-ranked table. */
export function metricHasTrackedData(
  rows: Array<Record<string, number | undefined>>,
  metric: string,
): boolean {
  return rows.some((row) => (row[metric] ?? 0) > 0);
}

export function leaderboardEmptyMessage(input: {
  hasTrackedData: boolean;
  playerCount: number;
}): string {
  if (input.playerCount === 0) {
    return "No player statistics available for this season.";
  }
  if (!input.hasTrackedData) {
    return "These statistics were not recorded for this season.";
  }
  return "No data available for this season.";
}
