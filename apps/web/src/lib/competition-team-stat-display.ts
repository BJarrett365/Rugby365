/** Pure helpers for competition team leaderboards. */

/** Try value became 5 points from 1992; RWC 1987–1991 used 4. */
export function tryPointsForSeasonYear(year: number | null | undefined): number {
  return year != null && year < 1992 ? 4 : 5;
}

export function teamMatchScoringPoints(
  input: {
    tries: number;
    conversions: number;
    penalties: number;
    dropGoals: number;
  },
  options?: { seasonYear?: number | null; sections?: unknown },
): number {
  const fromSections = teamStatSectionNumber(options?.sections, ["scoring", "match_points"]);
  if (fromSections > 0) return fromSections;

  const tryPts = tryPointsForSeasonYear(options?.seasonYear);
  return (
    input.tries * tryPts +
    input.conversions * 2 +
    input.penalties * 3 +
    input.dropGoals * 3
  );
}

export function teamStatSectionNumber(sections: unknown, path: string[]): number {
  let cur: unknown = sections;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return 0;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
}

/** Higher wins when multiple provider rows exist for the same fixture+team. */
export function teamMatchStatsProviderPriority(provider: string | null | undefined): number {
  switch (provider) {
    case "sdms":
      return 100;
    case "rugby_data":
      return 90;
    case "manual":
      return 80;
    case "rwc_player_rollup":
      return 50;
    default:
      return 10;
  }
}
