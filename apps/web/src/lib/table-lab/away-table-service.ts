import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
  venueWinPct,
} from "./home-table-service";
import { buildLeagueStandingsFromPerspectives, filterBySide } from "./rugby-table-metrics-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  TeamFixturePerspective,
} from "./table-types";

export { parseMinMatchesPlayed };

export function awayWinPct(won: number, played: number): number {
  return venueWinPct(won, played);
}

export function filterAwayTablePerspectives(
  perspectives: TeamFixturePerspective[],
  includeNeutralVenue = false,
): TeamFixturePerspective[] {
  const awayPerspectives = filterBySide(perspectives, "away");
  if (includeNeutralVenue) return awayPerspectives;
  return awayPerspectives.filter((row) => row.isNeutralVenue !== true);
}

export function enrichAwayTableRows(rows: RugbyTableStandingRow[]): RugbyTableStandingRow[] {
  return rows.map((row) => ({
    ...row,
    winPct: row.played > 0 ? awayWinPct(row.won, row.played) : undefined,
  }));
}

export function applyAwayTablePostProcessing(
  rows: RugbyTableStandingRow[],
  minMatchesPlayed?: number,
): RugbyTableStandingRow[] {
  const minimum = parseMinMatchesPlayed(minMatchesPlayed);
  let processed = enrichAwayTableRows(rows);
  if (minimum > 1) {
    processed = filterByMinimumMatchesPlayed(processed, minimum);
  }
  return processed;
}

export function buildAwayTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  minMatchesPlayed?: number;
  includeNeutralVenue?: boolean;
}): {
  rows: RugbyTableStandingRow[];
  dateRangeLabel: string | null;
  excludedNeutralMatchCount: number;
} {
  const awayAll = filterBySide(input.perspectives, "away");
  const awayPerspectives = filterAwayTablePerspectives(
    input.perspectives,
    input.includeNeutralVenue === true,
  );
  const excludedNeutralMatchCount = input.includeNeutralVenue
    ? 0
    : awayAll.filter((row) => row.isNeutralVenue === true).length;

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  let rows = buildLeagueStandingsFromPerspectives(awayPerspectives, input.rules);
  rows = applyAwayTablePostProcessing(rows, minimum);

  return {
    rows,
    dateRangeLabel: formatFormDateRange(awayPerspectives),
    excludedNeutralMatchCount,
  };
}
