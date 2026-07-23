import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import {
  filterByKickoffRange,
  matchLeaguePoints,
} from "./rugby-table-metrics-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import {
  parseWinningPositionFilter,
  parsePointsLostWinningSortBy,
  winningPositionFilterLabel,
  type WinningPositionFilter,
  type PointsLostWinningSortBy,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { WinningPositionFilter, PointsLostWinningSortBy };
export {
  parseWinningPositionFilter,
  parsePointsLostWinningSortBy,
  winningPositionFilterLabel,
};

export function pointsLostFromWinningPosition(
  pointsFor: number,
  pointsAgainst: number,
  triesFor: number | null,
  rules: RugbyScoringRules,
): number {
  const outcome = matchLeaguePoints(pointsFor, pointsAgainst, triesFor, rules);
  if (outcome.result === "won") return 0;
  return rules.winPoints - outcome.leaguePoints;
}

export function perspectiveQualifiesForWinningPositionFilter(
  row: TeamFixturePerspective,
  filter: WinningPositionFilter,
): boolean {
  if (filter === "half_time") {
    if (row.halfTimeScoreVerified === false) return false;
    return row.aheadAtHalfTime === true;
  }
  if (filter === "after_sixty") {
    if (row.sixtyMinuteScoreVerified === false) return false;
    return row.aheadAfterSixty === true;
  }
  if (row.scoreTimelineVerified === false) return false;
  return row.everLeading === true;
}

export function filterPointsLostWinningPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  winningPositionFilter: WinningPositionFilter;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((row) => {
    if (!perspectiveQualifiesForWinningPositionFilter(row, input.winningPositionFilter)) {
      return false;
    }
    if (input.tableView === "home" && row.side !== "home") return false;
    if (input.tableView === "away" && row.side !== "away") return false;
    return true;
  });
}

export function buildPointsLostWinningFilterSummary(input: {
  tableView: RugbyTableView;
  winningPositionFilter: WinningPositionFilter;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  return `This table ranks teams by table points lost after holding a lead while ${winningPositionFilterLabel(input.winningPositionFilter).toLowerCase()} in ${venue}matches.`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

type PointsLostWinningAccumulator = {
  teamId: string;
  teamName: string;
  matchesLed: number;
  winsAfterLeading: number;
  drawsAfterLeading: number;
  lossesAfterLeading: number;
  pointsLost: number;
  losingBonusRecovered: number;
  minuteFirstAhead: number[];
  minuteLeadLost: number[];
  largestLeadLost: number;
  latestLeadLost: number | null;
};

function createAccumulator(teamId: string, teamName: string): PointsLostWinningAccumulator {
  return {
    teamId,
    teamName,
    matchesLed: 0,
    winsAfterLeading: 0,
    drawsAfterLeading: 0,
    lossesAfterLeading: 0,
    pointsLost: 0,
    losingBonusRecovered: 0,
    minuteFirstAhead: [],
    minuteLeadLost: [],
    largestLeadLost: 0,
    latestLeadLost: null,
  };
}

export function sortPointsLostWinningRows(
  rows: RugbyTableStandingRow[],
  sortBy: PointsLostWinningSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "fewest_points_lost") {
      const av = Number(a.extra?.pointsLost ?? 0);
      const bv = Number(b.extra?.pointsLost ?? 0);
      if (av !== bv) return av - bv;
    } else if (sortBy === "losses_after_leading") {
      if (b.lost !== a.lost) return b.lost - a.lost;
    } else if (sortBy === "draws_after_leading") {
      if (b.drawn !== a.drawn) return b.drawn - a.drawn;
    } else if (sortBy === "lead_protection_pct") {
      const av = Number(a.extra?.leadProtectionPct ?? 0);
      const bv = Number(b.extra?.leadProtectionPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "most_wins_after_leading") {
      if (b.won !== a.won) return b.won - a.won;
    } else {
      const av = Number(a.extra?.pointsLost ?? 0);
      const bv = Number(b.extra?.pointsLost ?? 0);
      if (bv !== av) return bv - av;
    }

    const aLost = Number(a.extra?.pointsLost ?? 0);
    const bLost = Number(b.extra?.pointsLost ?? 0);
    if (bLost !== aLost) return bLost - aLost;
    if (b.lost !== a.lost) return b.lost - a.lost;
    if (b.drawn !== a.drawn) return b.drawn - a.drawn;
    const aProtection = Number(a.extra?.leadProtectionPct ?? 0);
    const bProtection = Number(b.extra?.leadProtectionPct ?? 0);
    if (aProtection !== bProtection) return aProtection - bProtection;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildPointsLostWinningTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  winningPositionFilter?: WinningPositionFilter;
  minMatchesPlayed?: number;
  sortBy?: PointsLostWinningSortBy;
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
  const winningPositionFilter = input.winningPositionFilter ?? "any_time";
  let scopedSeason = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scopedSeason = filterByKickoffRange(scopedSeason, input.dateFrom, input.dateTo);
  }

  const completedMatchCount = uniqueFixtureCount(scopedSeason);
  const scoringPerspectives = filterPointsLostWinningPerspectives({
    perspectives: scopedSeason,
    tableView: input.tableView,
    winningPositionFilter,
  });

  const accumulators = new Map<string, PointsLostWinningAccumulator>();
  for (const row of scoringPerspectives) {
    const acc =
      accumulators.get(row.teamId) ?? createAccumulator(row.teamId, row.teamName);
    const outcome = matchLeaguePoints(
      row.pointsFor,
      row.pointsAgainst,
      row.triesFor,
      input.rules,
    );
    const matchPointsLost = pointsLostFromWinningPosition(
      row.pointsFor,
      row.pointsAgainst,
      row.triesFor,
      input.rules,
    );

    acc.matchesLed += 1;
    acc.pointsLost += matchPointsLost;
    if (outcome.losingBonusPoints > 0) {
      acc.losingBonusRecovered += outcome.losingBonusPoints;
    }

    if (outcome.result === "won") {
      acc.winsAfterLeading += 1;
    } else if (outcome.result === "drawn") {
      acc.drawsAfterLeading += 1;
    } else {
      acc.lossesAfterLeading += 1;
    }

    if (row.minuteFirstAhead != null) {
      acc.minuteFirstAhead.push(row.minuteFirstAhead);
    }
    if (row.latestLeadLostMinute != null) {
      acc.minuteLeadLost.push(row.latestLeadLostMinute);
      acc.latestLeadLost =
        acc.latestLeadLost == null
          ? row.latestLeadLostMinute
          : Math.max(acc.latestLeadLost, row.latestLeadLostMinute);
    }
    if (row.maxLeadMargin != null && row.maxLeadMargin > acc.largestLeadLost) {
      acc.largestLeadLost = row.maxLeadMargin;
    }

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const leadProtectionPct =
      acc.matchesLed > 0
        ? Math.round((acc.winsAfterLeading / acc.matchesLed) * 1000) / 10
        : null;
    const avgPointsLostPerMatch =
      acc.matchesLed > 0
        ? Math.round((acc.pointsLost / acc.matchesLed) * 100) / 100
        : null;

    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.matchesLed,
      won: acc.winsAfterLeading,
      drawn: acc.drawsAfterLeading,
      lost: acc.lossesAfterLeading,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: acc.losingBonusRecovered,
      leaguePoints: acc.pointsLost,
      losingBonusPoints: acc.losingBonusRecovered > 0 ? acc.losingBonusRecovered : null,
      extra: {
        pointsLost: acc.pointsLost,
        avgPointsLostPerMatch,
        leadProtectionPct,
        wonAfterLeadingPct: leadProtectionPct,
        losingBonusRecovered: acc.losingBonusRecovered,
        avgMinuteFirstAhead: average(acc.minuteFirstAhead),
        avgMinuteLeadLost: average(acc.minuteLeadLost),
        latestLeadLost: acc.latestLeadLost,
        largestLeadLost: acc.largestLeadLost > 0 ? acc.largestLeadLost : null,
      },
    };
  });

  rows = sortPointsLostWinningRows(rows, input.sortBy ?? "points_lost");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithCoverageData = new Set(
    scopedSeason
      .filter((row) => {
        if (winningPositionFilter === "half_time") {
          return row.halfTimeScoreVerified !== false;
        }
        if (winningPositionFilter === "after_sixty") {
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
    filterSummary: buildPointsLostWinningFilterSummary({
      tableView: input.tableView,
      winningPositionFilter,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
  };
}
