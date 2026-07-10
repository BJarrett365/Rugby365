import { buildLeagueStandingsFromPerspectives, filterBySide } from "./rugby-table-metrics-service";
import type {
  FormResult,
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { FormResult };

export const FORM_MATCH_COUNT_PRESETS = [3, 5, 6, 10] as const;
export const DEFAULT_FORM_MATCH_COUNT = 5;

function compareRecentPerspectives(a: TeamFixturePerspective, b: TeamFixturePerspective): number {
  const at = a.kickoffAt?.getTime() ?? 0;
  const bt = b.kickoffAt?.getTime() ?? 0;
  if (bt !== at) return bt - at;
  return b.fixtureId.localeCompare(a.fixtureId);
}

export function formResultForPerspective(row: TeamFixturePerspective): FormResult {
  if (row.pointsFor > row.pointsAgainst) return "W";
  if (row.pointsFor === row.pointsAgainst) return "D";
  return "L";
}

/** Latest N completed matches per team — venue filter applied before slicing. */
export function recentFormMatchesByTeam(
  perspectives: TeamFixturePerspective[],
  matchCount: number,
  tableView: RugbyTableView = "all",
): Map<string, TeamFixturePerspective[]> {
  let scoped = perspectives;
  if (tableView === "home") scoped = filterBySide(perspectives, "home");
  if (tableView === "away") scoped = filterBySide(perspectives, "away");

  const byTeam = new Map<string, TeamFixturePerspective[]>();
  for (const row of scoped) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push(row);
    byTeam.set(row.teamId, list);
  }

  const selected = new Map<string, TeamFixturePerspective[]>();
  for (const [teamId, rows] of byTeam) {
    const sorted = [...rows].sort(compareRecentPerspectives);
    selected.set(teamId, sorted.slice(0, Math.max(1, matchCount)));
  }
  return selected;
}

export function flattenRecentFormMatches(
  matchesByTeam: Map<string, TeamFixturePerspective[]>,
): TeamFixturePerspective[] {
  return [...matchesByTeam.values()].flat();
}

export function formatFormDateRange(perspectives: TeamFixturePerspective[]): string | null {
  const dates = perspectives
    .map((row) => row.kickoffAt)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (!dates.length) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  const from = formatter.format(sorted[0]!);
  const to = formatter.format(sorted[sorted.length - 1]!);
  return from === to ? from : `${from} – ${to}`;
}

export function buildFormTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  matchCount: number;
  tableView: RugbyTableView;
  rules: RugbyScoringRules;
}): {
  rows: RugbyTableStandingRow[];
  dateRangeLabel: string | null;
  formMatchCount: number;
} {
  const matchCount = Math.max(1, input.matchCount);
  const matchesByTeam = recentFormMatchesByTeam(input.perspectives, matchCount, input.tableView);
  const scopedPerspectives = flattenRecentFormMatches(matchesByTeam);
  const standings = buildLeagueStandingsFromPerspectives(scopedPerspectives, input.rules);

  const formByTeam = new Map<string, { sequence: FormResult[]; matchesUsed: number }>();
  for (const [teamId, matches] of matchesByTeam) {
    formByTeam.set(teamId, {
      sequence: matches.map(formResultForPerspective),
      matchesUsed: matches.length,
    });
  }

  const rows = standings.map((row) => {
    const formMeta = formByTeam.get(row.teamId);
    return {
      ...row,
      formSequence: formMeta?.sequence ?? [],
      matchesRequested: matchCount,
      matchesUsed: formMeta?.matchesUsed ?? row.played,
    };
  });

  return {
    rows,
    dateRangeLabel: formatFormDateRange(scopedPerspectives),
    formMatchCount: matchCount,
  };
}

export function parseFormMatchCount(value: string | number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_FORM_MATCH_COUNT;
  return Math.min(Math.floor(parsed), 50);
}

export function isPresetFormMatchCount(value: number): value is (typeof FORM_MATCH_COUNT_PRESETS)[number] {
  return (FORM_MATCH_COUNT_PRESETS as readonly number[]).includes(value);
}
