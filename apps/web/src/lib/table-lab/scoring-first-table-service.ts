import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
  venueWinPct,
} from "./home-table-service";
import {
  firstScoreTypeFilterLabel,
  matchesFirstScoreTypeFilter,
  parseFirstScoreTypeFilter,
  type FirstScoreEventType,
  type FirstScoreTypeFilter,
} from "./first-score-utils";
import {
  addMatchToAccumulator,
  createStandingsAccumulator,
  filterByKickoffRange,
  filterBySide,
  finalizeStandingsRows,
  type StandingsAccumulator,
} from "./rugby-table-metrics-service";
import {
  parseScoringFirstSortBy,
  scoringFirstSortByLabel,
  type ScoringFirstSortBy,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { ScoringFirstSortBy };
export { parseScoringFirstSortBy, scoringFirstSortByLabel };

type ScoringFirstAccumulator = StandingsAccumulator & {
  firstScoreMinutes: number[];
  winsWhenScoringFirst: number;
  firstScoreTryCount: number;
  firstScorePenaltyCount: number;
  firstScoreDropGoalCount: number;
  winningMargins: number[];
};

function createScoringFirstAccumulator(teamId: string, teamName: string): ScoringFirstAccumulator {
  return {
    ...createStandingsAccumulator(teamId, teamName),
    firstScoreMinutes: [],
    winsWhenScoringFirst: 0,
    firstScoreTryCount: 0,
    firstScorePenaltyCount: 0,
    firstScoreDropGoalCount: 0,
    winningMargins: [],
  };
}

function trackFirstScoreType(acc: ScoringFirstAccumulator, eventType: FirstScoreEventType | null | undefined) {
  if (eventType === "try" || eventType === "penalty_try") {
    acc.firstScoreTryCount += 1;
  } else if (eventType === "penalty") {
    acc.firstScorePenaltyCount += 1;
  } else if (eventType === "drop_goal") {
    acc.firstScoreDropGoalCount += 1;
  }
}

export function filterScoringFirstPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  firstScoreType: FirstScoreTypeFilter;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((row) => {
    if (row.scoredFirst !== true) return false;
    if (row.firstScoreVerified === false) return false;
    if (!matchesFirstScoreTypeFilter(row.firstScoreEventType, input.firstScoreType)) return false;
    if (input.tableView === "home" && row.side !== "home") return false;
    if (input.tableView === "away" && row.side !== "away") return false;
    return true;
  });
}

export function countTeamMatches(
  perspectives: TeamFixturePerspective[],
  tableView: RugbyTableView,
): Map<string, number> {
  let scoped = perspectives;
  if (tableView === "home") scoped = filterBySide(scoped, "home");
  if (tableView === "away") scoped = filterBySide(scoped, "away");

  const counts = new Map<string, number>();
  for (const row of scoped) {
    counts.set(row.teamId, (counts.get(row.teamId) ?? 0) + 1);
  }
  return counts;
}

export function uniqueFixtureCount(perspectives: TeamFixturePerspective[]): number {
  return new Set(perspectives.map((row) => row.fixtureId)).size;
}

export function enrichScoringFirstRows(
  rows: RugbyTableStandingRow[],
  totalMatchesByTeam: Map<string, number>,
): RugbyTableStandingRow[] {
  return rows.map((row) => {
    const totalMatches = totalMatchesByTeam.get(row.teamId) ?? 0;
    const avgFirstScoreMinute = row.extra?.avgFirstScoreMinute ?? null;
    const leadConvertedWinPct = row.extra?.leadConvertedWinPct ?? null;
    const matchesScoringFirstPct =
      totalMatches > 0 ? Math.round((row.played / totalMatches) * 1000) / 10 : null;
    const avgWinningMargin = row.extra?.avgWinningMargin ?? null;

    return {
      ...row,
      winPct: row.played > 0 ? venueWinPct(row.won, row.played) : undefined,
      extra: {
        ...row.extra,
        matchesScoringFirstPct,
        leadConvertedWinPct,
        avgFirstScoreMinute,
        avgWinningMargin,
      },
    };
  });
}

export function sortScoringFirstRows(
  rows: RugbyTableStandingRow[],
  sortBy: ScoringFirstSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "win_pct") {
      const av = a.winPct ?? (a.played > 0 ? a.won / a.played : 0);
      const bv = b.winPct ?? (b.played > 0 ? b.won / b.played : 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "lead_converted_win_pct") {
      const av = Number(a.extra?.leadConvertedWinPct ?? 0);
      const bv = Number(b.extra?.leadConvertedWinPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "matches_scoring_first_pct") {
      const av = Number(a.extra?.matchesScoringFirstPct ?? 0);
      const bv = Number(b.extra?.matchesScoringFirstPct ?? 0);
      if (bv !== av) return bv - av;
    }

    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    const aWinPct = a.winPct ?? (a.played > 0 ? a.won / a.played : 0);
    const bWinPct = b.winPct ?? (b.played > 0 ? b.won / b.played : 0);
    if (bWinPct !== aWinPct) return bWinPct - aWinPct;
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildScoringFirstFilterSummary(input: {
  tableView: RugbyTableView;
  firstScoreType: FirstScoreTypeFilter;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  const scoreType =
    input.firstScoreType === "any"
      ? "the first points"
      : `the first ${firstScoreTypeFilterLabel(input.firstScoreType).toLowerCase()}`;
  return `This table shows results only from ${venue}matches where each team scored ${scoreType}.`;
}

export function buildScoringFirstTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  firstScoreType?: FirstScoreTypeFilter;
  minMatchesPlayed?: number;
  sortBy?: ScoringFirstSortBy;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  totalMatchesByTeam: Map<string, number>;
  firstScoreMatchCount: number;
  completedMatchCount: number;
  firstScoreCoveragePct: number;
  ambiguousFixtureCount: number;
  filterSummary: string;
  dateRangeLabel: string | null;
  hasTryFirstScoreBreakdown: boolean;
  hasPenaltyFirstScoreBreakdown: boolean;
  hasDropGoalFirstScoreBreakdown: boolean;
} {
  const firstScoreType = input.firstScoreType ?? "any";
  let scopedSeason = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scopedSeason = filterByKickoffRange(scopedSeason, input.dateFrom, input.dateTo);
  }

  const totalMatchesByTeam = countTeamMatches(scopedSeason, input.tableView);
  const completedMatchCount = uniqueFixtureCount(scopedSeason);
  const ambiguousFixtureCount = new Set(
    scopedSeason
      .filter((row) => row.firstScoreVerified === false)
      .map((row) => row.fixtureId),
  ).size;

  const scoringPerspectives = filterScoringFirstPerspectives({
    perspectives: scopedSeason,
    tableView: input.tableView,
    firstScoreType,
  });

  const accumulators = new Map<string, ScoringFirstAccumulator>();
  for (const row of scoringPerspectives) {
    const acc =
      accumulators.get(row.teamId) ??
      createScoringFirstAccumulator(row.teamId, row.teamName);
    addMatchToAccumulator(acc, row, input.rules);
    if (row.firstScoreMinute != null) {
      acc.firstScoreMinutes.push(row.firstScoreMinute);
    }
    if (row.pointsFor > row.pointsAgainst) {
      acc.winsWhenScoringFirst += 1;
      acc.winningMargins.push(row.pointsFor - row.pointsAgainst);
    }
    trackFirstScoreType(acc, row.firstScoreEventType);
    accumulators.set(row.teamId, acc);
  }

  let rows = finalizeStandingsRows(accumulators, {
    sortLeagueTable: false,
    scoringRules: input.rules,
  }).map((row) => {
    const acc = accumulators.get(row.teamId);
    if (!acc) return row;

    const avgFirstScoreMinute =
      acc.firstScoreMinutes.length > 0
        ? Math.round(
            (acc.firstScoreMinutes.reduce((sum, minute) => sum + minute, 0) /
              acc.firstScoreMinutes.length) *
              10,
          ) / 10
        : null;
    const leadConvertedWinPct =
      row.played > 0
        ? Math.round((acc.winsWhenScoringFirst / row.played) * 1000) / 10
        : null;
    const avgWinningMargin =
      acc.winningMargins.length > 0
        ? Math.round(
            (acc.winningMargins.reduce((sum, margin) => sum + margin, 0) /
              acc.winningMargins.length) *
              10,
          ) / 10
        : null;

    return {
      ...row,
      extra: {
        ...row.extra,
        avgFirstScoreMinute,
        leadConvertedWinPct,
        avgWinningMargin,
        firstScoreWasTry: acc.firstScoreTryCount > 0 ? acc.firstScoreTryCount : null,
        firstScoreWasPenalty: acc.firstScorePenaltyCount > 0 ? acc.firstScorePenaltyCount : null,
        firstScoreWasDropGoal: acc.firstScoreDropGoalCount > 0 ? acc.firstScoreDropGoalCount : null,
      },
    };
  });

  rows = enrichScoringFirstRows(rows, totalMatchesByTeam);
  rows = sortScoringFirstRows(rows, input.sortBy ?? "league_points");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithFirstScoreData = new Set(
    scopedSeason
      .filter((row) => row.firstScoreVerified !== false)
      .map((row) => row.fixtureId),
  );
  const fixturesWithVerifiedOpeningScore = new Set(scoringPerspectives.map((row) => row.fixtureId));

  const hasTryFirstScoreBreakdown = rows.some((row) => row.extra?.firstScoreWasTry != null);
  const hasPenaltyFirstScoreBreakdown = rows.some((row) => row.extra?.firstScoreWasPenalty != null);
  const hasDropGoalFirstScoreBreakdown = rows.some((row) => row.extra?.firstScoreWasDropGoal != null);

  return {
    rows,
    scoringPerspectives,
    totalMatchesByTeam,
    firstScoreMatchCount: fixturesWithVerifiedOpeningScore.size,
    completedMatchCount,
    firstScoreCoveragePct:
      completedMatchCount > 0
        ? Math.round((fixturesWithFirstScoreData.size / completedMatchCount) * 100)
        : 0,
    ambiguousFixtureCount,
    filterSummary: buildScoringFirstFilterSummary({
      tableView: input.tableView,
      firstScoreType,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    hasTryFirstScoreBreakdown,
    hasPenaltyFirstScoreBreakdown,
    hasDropGoalFirstScoreBreakdown,
  };
}

export {
  parseFirstScoreTypeFilter,
  firstScoreTypeFilterLabel,
  type FirstScoreTypeFilter,
};
