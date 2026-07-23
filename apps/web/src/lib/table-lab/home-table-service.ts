import { formatFormDateRange } from "./form-table-service";
import { buildLeagueStandingsFromPerspectives, filterBySide } from "./rugby-table-metrics-service";
import { parseMinMatchesPlayed } from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  TeamFixturePerspective,
} from "./table-types";

export { parseMinMatchesPlayed };

export function homeWinPct(won: number, played: number): number {
  if (played <= 0) return 0;
  return Math.round((won / played) * 1000) / 10;
}

/** Shared win % helper for home/away venue tables. */
export const venueWinPct = homeWinPct;

export function enrichHomeTableRows(rows: RugbyTableStandingRow[]): RugbyTableStandingRow[] {
  return rows.map((row) => ({
    ...row,
    winPct: row.played > 0 ? homeWinPct(row.won, row.played) : undefined,
  }));
}

export function filterByMinimumMatchesPlayed(
  rows: RugbyTableStandingRow[],
  minimum: number,
): RugbyTableStandingRow[] {
  if (minimum <= 1) return rows;
  const filtered = rows.filter((row) => row.played >= minimum);
  return filtered.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function applyHomeTablePostProcessing(
  rows: RugbyTableStandingRow[],
  minMatchesPlayed?: number,
): RugbyTableStandingRow[] {
  const minimum = parseMinMatchesPlayed(minMatchesPlayed);
  let processed = enrichHomeTableRows(rows);
  if (minimum > 1) {
    processed = filterByMinimumMatchesPlayed(processed, minimum);
  }
  return processed;
}

export function buildHomeTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  minMatchesPlayed?: number;
}): {
  rows: RugbyTableStandingRow[];
  dateRangeLabel: string | null;
} {
  const homePerspectives = filterBySide(input.perspectives, "home");
  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  let rows = buildLeagueStandingsFromPerspectives(homePerspectives, input.rules);
  rows = applyHomeTablePostProcessing(rows, minimum);

  return {
    rows,
    dateRangeLabel: formatFormDateRange(homePerspectives),
  };
}
