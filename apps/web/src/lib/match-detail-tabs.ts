export type MatchDetailTab = "details" | "stats" | "lineups" | "head-to-head" | "edit";

export function parseMatchDetailTab(value: string | undefined): MatchDetailTab {
  if (value === "stats" || value === "lineups" || value === "head-to-head" || value === "edit") {
    return value;
  }
  return "details";
}
