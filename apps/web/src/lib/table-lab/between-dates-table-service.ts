import {
  buildLeagueStandingsFromPerspectives,
  filterBySide,
} from "./rugby-table-metrics-service";
import { filterByMinimumMatchesPlayed, parseMinMatchesPlayed } from "./home-table-service";
import {
  seasonsIncludedFromPerspectives,
  uniqueFixtureCount,
} from "./calendar-year-table-service";
import {
  endOfDateUtc,
  formatAsOfDateLabel,
  formatDateOnly,
  defaultBetweenDatesRange,
  parseDateOnlyParam,
  startOfDateUtc,
} from "./table-date-utils";
import { matchCompletionInstant } from "./on-this-date-table-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export { defaultBetweenDatesRange, parseDateOnlyParam } from "./table-date-utils";

export function validateBetweenDatesRange(
  startDate: string,
  endDate: string,
): { valid: boolean; message?: string } {
  if (startDate > endDate) {
    return { valid: false, message: "Start date must not be after end date." };
  }
  return { valid: true };
}

export function filterByCompletedDateRange(
  perspectives: TeamFixturePerspective[],
  startDate: string,
  endDate: string,
): TeamFixturePerspective[] {
  const from = startOfDateUtc(startDate);
  const to = endOfDateUtc(endDate);
  return perspectives.filter((row) => {
    const completed = matchCompletionInstant(row);
    if (!completed) return false;
    return completed >= from && completed <= to;
  });
}

export function betweenDatesRangeLabel(startDate: string, endDate: string): string {
  return `${formatAsOfDateLabel(startDate)} – ${formatAsOfDateLabel(endDate)}`;
}

export function betweenDatesCalculationNote(startDate: string, endDate: string): string {
  return `Table calculated from matches played between ${formatAsOfDateLabel(startDate)} and ${formatAsOfDateLabel(endDate)}.`;
}

export function buildBetweenDatesTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  startDate: string;
  endDate: string;
  tableView: RugbyTableView;
  minMatchesPlayed?: number;
}): {
  rows: RugbyTableStandingRow[];
  seasonsIncludedLabel: string | null;
  matchCount: number;
  teamFixtureCount: number;
  scopedPerspectives: TeamFixturePerspective[];
  dateRangeLabel: string;
  calculationNote: string;
  rangeValid: boolean;
  rangeError: string | null;
} {
  const validation = validateBetweenDatesRange(input.startDate, input.endDate);
  if (!validation.valid) {
    return {
      rows: [],
      seasonsIncludedLabel: null,
      matchCount: 0,
      teamFixtureCount: 0,
      scopedPerspectives: [],
      dateRangeLabel: betweenDatesRangeLabel(input.startDate, input.endDate),
      calculationNote: betweenDatesCalculationNote(input.startDate, input.endDate),
      rangeValid: false,
      rangeError: validation.message ?? "Invalid date range.",
    };
  }

  let scoped = filterByCompletedDateRange(input.perspectives, input.startDate, input.endDate);
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  let rows = buildLeagueStandingsFromPerspectives(scoped, input.rules);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  return {
    rows,
    seasonsIncludedLabel: seasonsIncludedFromPerspectives(scoped),
    matchCount: uniqueFixtureCount(scoped),
    teamFixtureCount: scoped.length,
    scopedPerspectives: scoped,
    dateRangeLabel: betweenDatesRangeLabel(input.startDate, input.endDate),
    calculationNote: betweenDatesCalculationNote(input.startDate, input.endDate),
    rangeValid: true,
    rangeError: null,
  };
}
