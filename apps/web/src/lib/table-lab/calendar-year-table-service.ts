import {
  buildLeagueStandingsFromPerspectives,
  filterByCalendarYear,
  filterBySide,
} from "./rugby-table-metrics-service";
import { filterByMinimumMatchesPlayed, parseMinMatchesPlayed } from "./home-table-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export function parseCalendarYear(value: string | number | null | undefined): number {
  const current = new Date().getFullYear();
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100) return current;
  return Math.floor(parsed);
}

export function calendarYearDateRangeLabel(year: number): string {
  return `1 January ${year} – 31 December ${year}`;
}

export function calendarYearCalculationNote(year: number): string {
  return `This table uses matches played between 1 January ${year} and 31 December ${year}.`;
}

export function formatSeasonLabelFromStartYear(startYear: number): string {
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}–${endShort}`;
}

export function seasonsIncludedFromPerspectives(
  perspectives: TeamFixturePerspective[],
): string | null {
  const years = [
    ...new Set(
      perspectives
        .map((row) => row.seasonStartYear)
        .filter((year): year is number => year != null),
    ),
  ].sort((a, b) => a - b);
  if (!years.length) return null;
  return years.map(formatSeasonLabelFromStartYear).join(", ");
}

export function uniqueFixtureCount(perspectives: TeamFixturePerspective[]): number {
  return new Set(perspectives.map((row) => row.fixtureId)).size;
}

export function buildCalendarYearTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  calendarYear: number;
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
} {
  let scoped = filterByCalendarYear(input.perspectives, input.calendarYear);
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
    dateRangeLabel: calendarYearDateRangeLabel(input.calendarYear),
    calculationNote: calendarYearCalculationNote(input.calendarYear),
  };
}
