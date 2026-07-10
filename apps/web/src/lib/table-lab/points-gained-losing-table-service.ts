import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import { matchLeaguePoints } from "./rugby-table-metrics-service";
import {
  filterByKickoffRange,
} from "./rugby-table-metrics-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type LosingPositionFilter = "any_time" | "half_time" | "after_sixty";

export type PointsGainedLosingSortBy =
  | "points_gained"
  | "comeback_wins"
  | "comeback_win_pct"
  | "avg_points_gained";

export function parseLosingPositionFilter(
  value: string | null | undefined,
): LosingPositionFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "half_time" || normalized === "behind_at_half_time" || normalized === "ht") {
    return "half_time";
  }
  if (
    normalized === "after_sixty" ||
    normalized === "behind_after_60" ||
    normalized === "sixty" ||
    normalized === "60"
  ) {
    return "after_sixty";
  }
  return "any_time";
}

export function parsePointsGainedLosingSortBy(
  value: string | null | undefined,
): PointsGainedLosingSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "comeback_wins" || normalized === "comeback_wins_count") {
    return "comeback_wins";
  }
  if (normalized === "comeback_win_pct" || normalized === "comeback%") {
    return "comeback_win_pct";
  }
  if (normalized === "avg_points_gained" || normalized === "avg_points") {
    return "avg_points_gained";
  }
  return "points_gained";
}

export function losingPositionFilterLabel(filter: LosingPositionFilter): string {
  if (filter === "half_time") return "Behind at half-time";
  if (filter === "after_sixty") return "Behind after 60 minutes";
  return "Behind at any time";
}

type PointsGainedLosingAccumulator = {
  teamId: string;
  teamName: string;
  matchesBehind: number;
  comebackWins: number;
  comebackDraws: number;
  comebackLossesWithBonus: number;
  pointsGained: number;
  tryBonusPointsGained: number;
  losingBonusPointsGained: number;
  minuteFirstBehind: number[];
  bestComebackMargin: number;
};

function createAccumulator(teamId: string, teamName: string): PointsGainedLosingAccumulator {
  return {
    teamId,
    teamName,
    matchesBehind: 0,
    comebackWins: 0,
    comebackDraws: 0,
    comebackLossesWithBonus: 0,
    pointsGained: 0,
    tryBonusPointsGained: 0,
    losingBonusPointsGained: 0,
    minuteFirstBehind: [],
    bestComebackMargin: 0,
  };
}

export function perspectiveQualifiesForLosingPositionFilter(
  row: TeamFixturePerspective,
  filter: LosingPositionFilter,
): boolean {
  if (filter === "half_time") {
    if (row.halfTimeScoreVerified === false) return false;
    return row.behindAtHalfTime === true;
  }
  if (filter === "after_sixty") {
    if (row.sixtyMinuteScoreVerified === false) return false;
    return row.behindAfterSixty === true;
  }
  if (row.scoreTimelineVerified === false) return false;
  return row.everTrailing === true;
}

export function filterPointsGainedLosingPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  losingPositionFilter: LosingPositionFilter;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((row) => {
    if (!perspectiveQualifiesForLosingPositionFilter(row, input.losingPositionFilter)) {
      return false;
    }
    if (input.tableView === "home" && row.side !== "home") return false;
    if (input.tableView === "away" && row.side !== "away") return false;
    return true;
  });
}

export function buildPointsGainedLosingFilterSummary(input: {
  tableView: RugbyTableView;
  losingPositionFilter: LosingPositionFilter;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  return `This table ranks teams by competition points earned after being ${losingPositionFilterLabel(input.losingPositionFilter).toLowerCase()} in ${venue}matches.`;
}

export function sortPointsGainedLosingRows(
  rows: RugbyTableStandingRow[],
  sortBy: PointsGainedLosingSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "comeback_wins") {
      if (b.won !== a.won) return b.won - a.won;
    } else if (sortBy === "comeback_win_pct") {
      const av = Number(a.extra?.comebackWinPct ?? 0);
      const bv = Number(b.extra?.comebackWinPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "avg_points_gained") {
      const av = Number(a.extra?.avgPointsGainedPerMatch ?? 0);
      const bv = Number(b.extra?.avgPointsGainedPerMatch ?? 0);
      if (bv !== av) return bv - av;
    }

    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.won !== a.won) return b.won - a.won;
    const aComeback = Number(a.extra?.comebackWinPct ?? 0);
    const bComeback = Number(b.extra?.comebackWinPct ?? 0);
    if (bComeback !== aComeback) return bComeback - aComeback;
    const aAvg = Number(a.extra?.avgPointsGainedPerMatch ?? 0);
    const bAvg = Number(b.extra?.avgPointsGainedPerMatch ?? 0);
    if (bAvg !== aAvg) return bAvg - aAvg;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildPointsGainedLosingTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  losingPositionFilter?: LosingPositionFilter;
  minMatchesPlayed?: number;
  sortBy?: PointsGainedLosingSortBy;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  qualifyingMatchCount: number;
  completedMatchCount: number;
  timelineCoveragePct: number;
  filterSummary: string;
  dateRangeLabel: string | null;
} {
  const losingPositionFilter = input.losingPositionFilter ?? "any_time";
  let scopedSeason = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scopedSeason = filterByKickoffRange(scopedSeason, input.dateFrom, input.dateTo);
  }

  const completedMatchCount = uniqueFixtureCount(scopedSeason);
  const scoringPerspectives = filterPointsGainedLosingPerspectives({
    perspectives: scopedSeason,
    tableView: input.tableView,
    losingPositionFilter,
  });

  const accumulators = new Map<string, PointsGainedLosingAccumulator>();
  for (const row of scoringPerspectives) {
    const acc =
      accumulators.get(row.teamId) ?? createAccumulator(row.teamId, row.teamName);
    const outcome = matchLeaguePoints(
      row.pointsFor,
      row.pointsAgainst,
      row.triesFor,
      input.rules,
    );

    acc.matchesBehind += 1;
    acc.pointsGained += outcome.leaguePoints;
    acc.tryBonusPointsGained += outcome.tryBonusPoints;
    acc.losingBonusPointsGained += outcome.losingBonusPoints;

    if (outcome.result === "won") {
      acc.comebackWins += 1;
      const margin = row.maxDeficitWhileTrailing ?? 0;
      if (margin > acc.bestComebackMargin) acc.bestComebackMargin = margin;
    } else if (outcome.result === "drawn") {
      acc.comebackDraws += 1;
    } else if (outcome.leaguePoints > 0) {
      acc.comebackLossesWithBonus += 1;
    }

    if (row.minuteFirstBehind != null) {
      acc.minuteFirstBehind.push(row.minuteFirstBehind);
    }

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const lossesNoBonus =
      acc.matchesBehind - acc.comebackWins - acc.comebackDraws - acc.comebackLossesWithBonus;
    const comebackWinPct =
      acc.matchesBehind > 0
        ? Math.round((acc.comebackWins / acc.matchesBehind) * 1000) / 10
        : undefined;
    const avgPointsGainedPerMatch =
      acc.matchesBehind > 0
        ? Math.round((acc.pointsGained / acc.matchesBehind) * 100) / 100
        : undefined;
    const avgMinuteFirstBehind =
      acc.minuteFirstBehind.length > 0
        ? Math.round(
            (acc.minuteFirstBehind.reduce((sum, minute) => sum + minute, 0) /
              acc.minuteFirstBehind.length) *
              10,
          ) / 10
        : null;

    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.matchesBehind,
      won: acc.comebackWins,
      drawn: acc.comebackDraws,
      lost: lossesNoBonus,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: acc.tryBonusPointsGained + acc.losingBonusPointsGained,
      leaguePoints: acc.pointsGained,
      tryBonusPoints: acc.tryBonusPointsGained > 0 ? acc.tryBonusPointsGained : null,
      losingBonusPoints: acc.losingBonusPointsGained > 0 ? acc.losingBonusPointsGained : null,
      extra: {
        comebackLossesWithBonus: acc.comebackLossesWithBonus,
        comebackWinPct,
        bestComebackMargin: acc.bestComebackMargin > 0 ? acc.bestComebackMargin : null,
        pointsGained: acc.pointsGained,
        avgPointsGainedPerMatch,
        tryBonusPointsGained: acc.tryBonusPointsGained,
        losingBonusPointsGained: acc.losingBonusPointsGained,
        avgMinuteFirstBehind,
      },
    };
  });

  rows = sortPointsGainedLosingRows(rows, input.sortBy ?? "points_gained");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithCoverageData = new Set(
    scopedSeason
      .filter((row) => {
        if (losingPositionFilter === "half_time") {
          return row.halfTimeScoreVerified !== false;
        }
        if (losingPositionFilter === "after_sixty") {
          return row.sixtyMinuteScoreVerified !== false;
        }
        return row.scoreTimelineVerified !== false;
      })
      .map((row) => row.fixtureId),
  );
  const qualifyingFixtures = new Set(scoringPerspectives.map((row) => row.fixtureId));

  return {
    rows,
    scoringPerspectives,
    qualifyingMatchCount: qualifyingFixtures.size,
    completedMatchCount,
    timelineCoveragePct:
      completedMatchCount > 0
        ? Math.round((fixturesWithCoverageData.size / completedMatchCount) * 100)
        : 0,
    filterSummary: buildPointsGainedLosingFilterSummary({
      tableView: input.tableView,
      losingPositionFilter,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
  };
}
