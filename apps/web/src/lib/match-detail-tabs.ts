export type MatchDetailTab =
  | "details"
  | "animation"
  | "audio"
  | "data-commentary"
  | "watchalong"
  | "highlights"
  | "stats"
  | "player-stats"
  | "lineups"
  | "tables"
  | "head-to-head"
  | "betting"
  | "edit";

export function parseMatchDetailTab(value: string | undefined): MatchDetailTab {
  if (
    value === "animation" ||
    value === "audio" ||
    value === "data-commentary" ||
    value === "watchalong" ||
    value === "highlights" ||
    value === "stats" ||
    value === "player-stats" ||
    value === "lineups" ||
    value === "tables" ||
    value === "head-to-head" ||
    value === "betting" ||
    value === "edit"
  ) {
    return value;
  }
  return "details";
}

export function matchDetailTabHref(pathname: string, tab: MatchDetailTab): string {
  if (tab === "details") return pathname;
  return `${pathname}?tab=${tab}`;
}
