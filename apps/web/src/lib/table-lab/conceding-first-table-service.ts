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
import { countTeamMatches, uniqueFixtureCount } from "./scoring-first-table-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type ConcedingFirstSortBy =
  | "league_points"
  | "comeback_wins"
  | "comeback_win_pct"
  | "points_gained_after_conceding_first";

export function parseConcedingFirstSortBy(
  value: string | null | undefined,
): ConcedingFirstSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "comeback_wins" || normalized === "comeback_wins_count") {
    return "comeback_wins";
  }
  if (normalized === "comeback_win_pct" || normalized === "comeback%") {
    return "comeback_win_pct";
  }
  if (
    normalized === "points_gained_after_conceding_first" ||
    normalized === "points_gained"
  ) {
    return "points_gained_after_conceding_first";
  }
  return "league_points";
}

export function concedingFirstSortByLabel(sortBy: ConcedingFirstSortBy): string {
  if (sortBy === "comeback_wins") return "Comeback wins";
  if (sortBy === "comeback_win_pct") return "Comeback win %";
  if (sortBy === "points_gained_after_conceding_first") {
    return "Points gained after conceding first";
  }
  return "Table points";
}

type ConcedingFirstAccumulator = StandingsAccumulator & {
  firstConcededMinutes: number[];
  comebackWins: number;
  firstConcededTryCount: number;
  firstConcededPenaltyCount: number;
  firstConcededDropGoalCount: number;
};

function createConcedingFirstAccumulator(
  teamId: string,
  teamName: string,
): ConcedingFirstAccumulator {
  return {
    ...createStandingsAccumulator(teamId, teamName),
    firstConcededMinutes: [],
    comebackWins: 0,
    firstConcededTryCount: 0,
    firstConcededPenaltyCount: 0,
    firstConcededDropGoalCount: 0,
  };
}

function trackFirstConcededType(
  acc: ConcedingFirstAccumulator,
  eventType: FirstScoreEventType | null | undefined,
) {
  if (eventType === "try" || eventType === "penalty_try") {
    acc.firstConcededTryCount += 1;
  } else if (eventType === "penalty") {
    acc.firstConcededPenaltyCount += 1;
  } else if (eventType === "drop_goal") {
    acc.firstConcededDropGoalCount += 1;
  }
}

export function filterConcedingFirstPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  firstScoreConcededType: FirstScoreTypeFilter;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((row) => {
    if (row.concededFirst !== true) return false;
    if (row.firstScoreVerified === false) return false;
    if (!matchesFirstScoreTypeFilter(row.firstScoreEventType, input.firstScoreConcededType)) {
      return false;
    }
    if (input.tableView === "home" && row.side !== "home") return false;
    if (input.tableView === "away" && row.side !== "away") return false;
    return true;
  });
}

export function enrichConcedingFirstRows(
  rows: RugbyTableStandingRow[],
  totalMatchesByTeam: Map<string, number>,
): RugbyTableStandingRow[] {
  return rows.map((row) => {
    const totalMatches = totalMatchesByTeam.get(row.teamId) ?? 0;
    const matchesConcedingFirstPct =
      totalMatches > 0 ? Math.round((row.played / totalMatches) * 1000) / 10 : undefined;

    return {
      ...row,
      winPct: row.played > 0 ? venueWinPct(row.won, row.played) : undefined,
      extra: {
        ...row.extra,
        matchesConcedingFirstPct,
        comebackWinPct: row.extra?.comebackWinPct,
        pointsGainedAfterConcedingFirst: row.leaguePoints,
        avgFirstConcededMinute: row.extra?.avgFirstConcededMinute,
        comebackWins: row.extra?.comebackWins,
      },
    };
  });
}

export function sortConcedingFirstRows(
  rows: RugbyTableStandingRow[],
  sortBy: ConcedingFirstSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "comeback_wins") {
      const av = Number(a.extra?.comebackWins ?? 0);
      const bv = Number(b.extra?.comebackWins ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "comeback_win_pct") {
      const av = Number(a.extra?.comebackWinPct ?? 0);
      const bv = Number(b.extra?.comebackWinPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "points_gained_after_conceding_first") {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    }

    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    const aComeback = Number(a.extra?.comebackWinPct ?? 0);
    const bComeback = Number(b.extra?.comebackWinPct ?? 0);
    if (bComeback !== aComeback) return bComeback - aComeback;
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildConcedingFirstFilterSummary(input: {
  tableView: RugbyTableView;
  firstScoreConcededType: FirstScoreTypeFilter;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  const scoreType =
    input.firstScoreConcededType === "any"
      ? "the first points"
      : `the first ${firstScoreTypeFilterLabel(input.firstScoreConcededType).toLowerCase()}`;
  return `This table shows results only from ${venue}matches where each team conceded ${scoreType}.`;
}

export function buildConcedingFirstTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  firstScoreConcededType?: FirstScoreTypeFilter;
  minMatchesPlayed?: number;
  sortBy?: ConcedingFirstSortBy;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  totalMatchesByTeam: Map<string, number>;
  concedingFirstMatchCount: number;
  completedMatchCount: number;
  firstScoreCoveragePct: number;
  ambiguousFixtureCount: number;
  filterSummary: string;
  dateRangeLabel: string | null;
} {
  const firstScoreConcededType = input.firstScoreConcededType ?? "any";
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

  const scoringPerspectives = filterConcedingFirstPerspectives({
    perspectives: scopedSeason,
    tableView: input.tableView,
    firstScoreConcededType,
  });

  const accumulators = new Map<string, ConcedingFirstAccumulator>();
  for (const row of scoringPerspectives) {
    const acc =
      accumulators.get(row.teamId) ??
      createConcedingFirstAccumulator(row.teamId, row.teamName);
    addMatchToAccumulator(acc, row, input.rules);
    if (row.firstScoreMinute != null) {
      acc.firstConcededMinutes.push(row.firstScoreMinute);
    }
    if (row.pointsFor > row.pointsAgainst) {
      acc.comebackWins += 1;
    }
    trackFirstConcededType(acc, row.firstScoreEventType);
    accumulators.set(row.teamId, acc);
  }

  let rows = finalizeStandingsRows(accumulators, {
    sortLeagueTable: false,
    scoringRules: input.rules,
  }).map((row) => {
    const acc = accumulators.get(row.teamId);
    if (!acc) return row;

    const avgFirstConcededMinute =
      acc.firstConcededMinutes.length > 0
        ? Math.round(
            (acc.firstConcededMinutes.reduce((sum, minute) => sum + minute, 0) /
              acc.firstConcededMinutes.length) *
              10,
          ) / 10
        : null;
    const comebackWinPct =
      row.played > 0 ? Math.round((acc.comebackWins / row.played) * 1000) / 10 : undefined;

    return {
      ...row,
      extra: {
        ...row.extra,
        avgFirstConcededMinute,
        comebackWinPct,
        comebackWins: acc.comebackWins,
        pointsGainedAfterConcedingFirst: row.leaguePoints,
        firstConcededWasTry: acc.firstConcededTryCount > 0 ? acc.firstConcededTryCount : null,
        firstConcededWasPenalty:
          acc.firstConcededPenaltyCount > 0 ? acc.firstConcededPenaltyCount : null,
        firstConcededWasDropGoal:
          acc.firstConcededDropGoalCount > 0 ? acc.firstConcededDropGoalCount : null,
      },
    };
  });

  rows = enrichConcedingFirstRows(rows, totalMatchesByTeam);
  rows = sortConcedingFirstRows(rows, input.sortBy ?? "league_points");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithFirstScoreData = new Set(
    scopedSeason
      .filter((row) => row.firstScoreVerified !== false)
      .map((row) => row.fixtureId),
  );
  const fixturesWithVerifiedConcedingFirst = new Set(
    scoringPerspectives.map((row) => row.fixtureId),
  );

  return {
    rows,
    scoringPerspectives,
    totalMatchesByTeam,
    concedingFirstMatchCount: fixturesWithVerifiedConcedingFirst.size,
    completedMatchCount,
    firstScoreCoveragePct:
      completedMatchCount > 0
        ? Math.round((fixturesWithFirstScoreData.size / completedMatchCount) * 100)
        : 0,
    ambiguousFixtureCount,
    filterSummary: buildConcedingFirstFilterSummary({
      tableView: input.tableView,
      firstScoreConcededType,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
  };
}

export {
  parseFirstScoreTypeFilter,
  firstScoreTypeFilterLabel,
  type FirstScoreTypeFilter,
};
