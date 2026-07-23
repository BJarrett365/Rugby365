export type MatchDetailTab =
  | "details"
  | "stats"
  | "player-stats"
  | "lineups"
  | "tables"
  | "head-to-head"
  | "edit";

export function parseMatchDetailTab(value: string | undefined): MatchDetailTab {
  if (
    value === "stats" ||
    value === "player-stats" ||
    value === "lineups" ||
    value === "tables" ||
    value === "head-to-head" ||
    value === "edit"
  ) {
    return value;
  }
  return "details";
}
