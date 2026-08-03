/** Pure helpers for competition team leaderboards. */

export function teamMatchScoringPoints(input: {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
}): number {
  return input.tries * 5 + input.conversions * 2 + input.penalties * 3 + input.dropGoals * 3;
}

export function teamStatSectionNumber(sections: unknown, path: string[]): number {
  let cur: unknown = sections;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return 0;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
}
