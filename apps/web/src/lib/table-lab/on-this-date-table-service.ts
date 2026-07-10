import {
  buildLeagueStandingsFromPerspectives,
  filterByKickoffRange,
  filterBySide,
} from "./rugby-table-metrics-service";
import { canonicalKeyFromName } from "./premiership-team-identity";
import {
  deductionsForTeamSeasonAsOf,
  scoringRulesForPremiershipSeason,
} from "./premiership-season-scoring";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules-catalog";
import {
  endOfDateUtc,
  formatAsOfDateLabel,
  formatDateOnly,
  parseAsOfDateParam,
  shiftDateOnly,
  startOfDateUtc,
  tableOnDateCalculationNote,
} from "./table-date-utils";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type TableOnDateStatus = "official" | "calculated";

export {
  endOfDateUtc,
  formatAsOfDateLabel,
  formatDateOnly,
  parseAsOfDateParam,
  shiftDateOnly,
  startOfDateUtc,
  tableOnDateCalculationNote,
} from "./table-date-utils";

/** Completion date for cut-off; kickoff is used when no completion timestamp exists in SDMS. */
export function matchCompletionInstant(row: TeamFixturePerspective): Date | null {
  return row.completedAt ?? row.kickoffAt;
}

export function filterByCompletedOnOrBefore(
  perspectives: TeamFixturePerspective[],
  asOf: Date,
): TeamFixturePerspective[] {
  return perspectives.filter((row) => {
    const completed = matchCompletionInstant(row);
    if (!completed) return false;
    return completed <= asOf;
  });
}

export function uniqueFixtureCount(perspectives: TeamFixturePerspective[]): number {
  return new Set(perspectives.map((row) => row.fixtureId)).size;
}

export function resolveScoringRulesForSeasonTable(input: {
  competitionSlug?: string | null;
  competitionType?: string | null;
  seasonStartYear?: number | null;
}): RugbyScoringRules {
  if (input.competitionSlug === "premiership" && input.seasonStartYear != null) {
    return scoringRulesForPremiershipSeason(input.seasonStartYear);
  }
  return scoringRulesForCompetitionSlug(input.competitionSlug, input.competitionType);
}

export function rerankLeagueTableRows(rows: RugbyTableStandingRow[]): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    if ((b.triesFor ?? 0) !== (a.triesFor ?? 0)) return (b.triesFor ?? 0) - (a.triesFor ?? 0);
    return a.teamName.localeCompare(b.teamName);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function applySeasonDeductionsAsOf(input: {
  rows: RugbyTableStandingRow[];
  seasonStartYear: number;
  asOf: Date;
  applyPremiershipDeductions: boolean;
}): {
  rows: RugbyTableStandingRow[];
  hasUnknownDeductionDates: boolean;
  deductionNotice: string | null;
} {
  if (!input.applyPremiershipDeductions) {
    return { rows: input.rows, hasUnknownDeductionDates: false, deductionNotice: null };
  }

  let hasUnknownDeductionDates = false;
  const adjusted = input.rows.map((row) => {
    const canonicalKey = canonicalKeyFromName(row.teamName);
    const deduction = deductionsForTeamSeasonAsOf(
      canonicalKey,
      input.seasonStartYear,
      input.asOf,
    );
    if (deduction.hasUnknownEffectiveDates) hasUnknownDeductionDates = true;
    if (deduction.points <= 0) return row;
    return {
      ...row,
      leaguePoints: Math.max(0, row.leaguePoints - deduction.points),
      extra: {
        ...row.extra,
        pointsDeducted: deduction.points,
        deductionReason: deduction.reasons.join("; "),
      },
    };
  });

  return {
    rows: rerankLeagueTableRows(adjusted),
    hasUnknownDeductionDates,
    deductionNotice: hasUnknownDeductionDates
      ? "Some configured points deductions have no confirmed effective date and are included in this calculated table."
      : null,
  };
}

export function buildOnThisDateTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  asOfDateOnly: string;
  tableView: RugbyTableView;
  seasonStartYear?: number | null;
  applyPremiershipDeductions?: boolean;
}): {
  rows: RugbyTableStandingRow[];
  matchCount: number;
  teamFixtureCount: number;
  scopedPerspectives: TeamFixturePerspective[];
  asOfDateLabel: string;
  calculationNote: string;
  tableStatus: TableOnDateStatus;
  hasUnknownDeductionDates: boolean;
  deductionNotice: string | null;
} {
  const asOf = endOfDateUtc(input.asOfDateOnly);
  let scoped = filterByCompletedOnOrBefore(input.perspectives, asOf);
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  let rows = buildLeagueStandingsFromPerspectives(scoped, input.rules);

  let hasUnknownDeductionDates = false;
  let deductionNotice: string | null = null;
  if (input.seasonStartYear != null && input.applyPremiershipDeductions) {
    const deducted = applySeasonDeductionsAsOf({
      rows,
      seasonStartYear: input.seasonStartYear,
      asOf,
      applyPremiershipDeductions: true,
    });
    rows = deducted.rows;
    hasUnknownDeductionDates = deducted.hasUnknownDeductionDates;
    deductionNotice = deducted.deductionNotice;
  }

  return {
    rows,
    matchCount: uniqueFixtureCount(scoped),
    teamFixtureCount: scoped.length,
    scopedPerspectives: scoped,
    asOfDateLabel: formatAsOfDateLabel(input.asOfDateOnly),
    calculationNote: tableOnDateCalculationNote(input.asOfDateOnly),
    tableStatus: "calculated",
    hasUnknownDeductionDates,
    deductionNotice,
  };
}

/** @deprecated Use filterByCompletedOnOrBefore — kept for generic as-of kickoff filtering elsewhere. */
export function filterPerspectivesToAsOfKickoff(
  perspectives: TeamFixturePerspective[],
  asOf: Date,
): TeamFixturePerspective[] {
  return filterByKickoffRange(perspectives, undefined, asOf);
}
