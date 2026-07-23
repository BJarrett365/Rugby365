import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import {
  filterByKickoffRange,
  matchLeaguePoints,
} from "./rugby-table-metrics-service";
import { perspectiveQualifiesForLosingPositionFilter } from "./points-gained-losing-table-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import {
  parseComebackFromFilter,
  parseComebackSortBy,
  parseMinimumDeficitPoints,
  parseMinimumDeficitPreset,
  comebackFromFilterLabel,
  minimumDeficitLabel,
  type ComebackFromFilter,
  type ComebackSortBy,
  type MinimumDeficitPreset,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { ComebackFromFilter, ComebackSortBy, MinimumDeficitPreset };
export {
  parseComebackFromFilter,
  parseComebackSortBy,
  parseMinimumDeficitPoints,
  parseMinimumDeficitPreset,
  comebackFromFilterLabel,
  minimumDeficitLabel,
};

export function perspectiveQualifiesForComebackTable(
  row: TeamFixturePerspective,
  comebackFrom: ComebackFromFilter,
  minimumDeficit: number,
): boolean {
  if (!perspectiveQualifiesForLosingPositionFilter(row, comebackFrom)) {
    return false;
  }
  if (minimumDeficit > 0 && (row.maxDeficitWhileTrailing ?? 0) < minimumDeficit) {
    return false;
  }
  return true;
}

export function isSuccessfulComeback(row: TeamFixturePerspective): boolean {
  return row.pointsFor >= row.pointsAgainst;
}

export function filterComebackPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  comebackFrom: ComebackFromFilter;
  minimumDeficit: number;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((row) => {
    if (!perspectiveQualifiesForComebackTable(row, input.comebackFrom, input.minimumDeficit)) {
      return false;
    }
    if (input.tableView === "home" && row.side !== "home") return false;
    if (input.tableView === "away" && row.side !== "away") return false;
    return true;
  });
}

export function buildComebackFilterSummary(input: {
  tableView: RugbyTableView;
  comebackFrom: ComebackFromFilter;
  minimumDeficitPreset: MinimumDeficitPreset;
  minimumDeficit: number;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  const deficit =
    input.minimumDeficit > 0
      ? ` with at least a ${input.minimumDeficit}-point deficit`
      : "";
  return `This table ranks teams by successful wins and draws after falling ${comebackFromFilterLabel(input.comebackFrom).toLowerCase()}${deficit} in ${venue}matches.`;
}

type ComebackAccumulator = {
  teamId: string;
  teamName: string;
  matchesBehind: number;
  comebackWins: number;
  comebackDraws: number;
  deficitsOvercome: number[];
  largestDeficitOvercome: number;
  tablePointsGained: number;
  comebacksFrom7Plus: number;
  comebacksFrom10Plus: number;
  comebacksFrom14Plus: number;
  secondHalfComebacks: number;
  finalTwentyComebacks: number;
  latestWinningScoreMinutes: number[];
};

function createComebackAccumulator(teamId: string, teamName: string): ComebackAccumulator {
  return {
    teamId,
    teamName,
    matchesBehind: 0,
    comebackWins: 0,
    comebackDraws: 0,
    deficitsOvercome: [],
    largestDeficitOvercome: 0,
    tablePointsGained: 0,
    comebacksFrom7Plus: 0,
    comebacksFrom10Plus: 0,
    comebacksFrom14Plus: 0,
    secondHalfComebacks: 0,
    finalTwentyComebacks: 0,
    latestWinningScoreMinutes: [],
  };
}

function trackSuccessfulComeback(acc: ComebackAccumulator, row: TeamFixturePerspective) {
  const deficit = row.maxDeficitWhileTrailing ?? 0;
  acc.deficitsOvercome.push(deficit);
  if (deficit > acc.largestDeficitOvercome) {
    acc.largestDeficitOvercome = deficit;
  }
  if (deficit >= 7) acc.comebacksFrom7Plus += 1;
  if (deficit >= 10) acc.comebacksFrom10Plus += 1;
  if (deficit >= 14) acc.comebacksFrom14Plus += 1;
  if (row.behindAtHalfTime === true) acc.secondHalfComebacks += 1;
  if (row.behindAfterSixty === true) acc.finalTwentyComebacks += 1;
  if (row.pointsFor > row.pointsAgainst && row.minuteLastTookLead != null) {
    acc.latestWinningScoreMinutes.push(row.minuteLastTookLead);
  }
}

export function sortComebackRows(
  rows: RugbyTableStandingRow[],
  sortBy: ComebackSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "total_successful_comebacks") {
      const av = Number(a.extra?.totalSuccessfulComebacks ?? 0);
      const bv = Number(b.extra?.totalSuccessfulComebacks ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "comeback_success_pct") {
      const av = Number(a.extra?.comebackSuccessPct ?? 0);
      const bv = Number(b.extra?.comebackSuccessPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "largest_deficit_overcome" || sortBy === "largest_comeback") {
      const av = Number(a.extra?.largestDeficitOvercome ?? 0);
      const bv = Number(b.extra?.largestDeficitOvercome ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "table_points_gained") {
      const av = Number(a.extra?.tablePointsGained ?? 0);
      const bv = Number(b.extra?.tablePointsGained ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "final_20_comebacks") {
      const av = Number(a.extra?.finalTwentyComebacks ?? 0);
      const bv = Number(b.extra?.finalTwentyComebacks ?? 0);
      if (bv !== av) return bv - av;
    } else if (b.won !== a.won) {
      return b.won - a.won;
    }

    const aTotal = Number(a.extra?.totalSuccessfulComebacks ?? 0);
    const bTotal = Number(b.extra?.totalSuccessfulComebacks ?? 0);
    if (bTotal !== aTotal) return bTotal - aTotal;
    const aSuccess = Number(a.extra?.comebackSuccessPct ?? 0);
    const bSuccess = Number(b.extra?.comebackSuccessPct ?? 0);
    if (bSuccess !== aSuccess) return bSuccess - aSuccess;
    const aLargest = Number(a.extra?.largestDeficitOvercome ?? 0);
    const bLargest = Number(b.extra?.largestDeficitOvercome ?? 0);
    if (bLargest !== aLargest) return bLargest - aLargest;
    const aPoints = Number(a.extra?.tablePointsGained ?? 0);
    const bPoints = Number(b.extra?.tablePointsGained ?? 0);
    if (bPoints !== aPoints) return bPoints - aPoints;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildComebackTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  comebackFrom?: ComebackFromFilter;
  minimumDeficit?: number;
  minimumDeficitPreset?: MinimumDeficitPreset;
  minMatchesPlayed?: number;
  sortBy?: ComebackSortBy;
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
  const comebackFrom = input.comebackFrom ?? "any_time";
  const minimumDeficit = input.minimumDeficit ?? 0;
  const minimumDeficitPreset = input.minimumDeficitPreset ?? "any";
  let scopedSeason = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scopedSeason = filterByKickoffRange(scopedSeason, input.dateFrom, input.dateTo);
  }

  const completedMatchCount = uniqueFixtureCount(scopedSeason);
  const scoringPerspectives = filterComebackPerspectives({
    perspectives: scopedSeason,
    tableView: input.tableView,
    comebackFrom,
    minimumDeficit,
  });

  const accumulators = new Map<string, ComebackAccumulator>();
  for (const row of scoringPerspectives) {
    const acc =
      accumulators.get(row.teamId) ?? createComebackAccumulator(row.teamId, row.teamName);
    const outcome = matchLeaguePoints(
      row.pointsFor,
      row.pointsAgainst,
      row.triesFor,
      input.rules,
    );

    acc.matchesBehind += 1;

    if (outcome.result === "won") {
      acc.comebackWins += 1;
      trackSuccessfulComeback(acc, row);
      acc.tablePointsGained += outcome.leaguePoints;
    } else if (outcome.result === "drawn") {
      acc.comebackDraws += 1;
      trackSuccessfulComeback(acc, row);
      acc.tablePointsGained += outcome.leaguePoints;
    }

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const totalSuccessfulComebacks = acc.comebackWins + acc.comebackDraws;
    const lossesAfterBehind = acc.matchesBehind - totalSuccessfulComebacks;
    const comebackSuccessPct =
      acc.matchesBehind > 0
        ? Math.round((totalSuccessfulComebacks / acc.matchesBehind) * 1000) / 10
        : null;
    const comebackWinPct =
      acc.matchesBehind > 0
        ? Math.round((acc.comebackWins / acc.matchesBehind) * 1000) / 10
        : null;
    const comebackDrawPct =
      acc.matchesBehind > 0
        ? Math.round((acc.comebackDraws / acc.matchesBehind) * 1000) / 10
        : null;
    const averageDeficitOvercome =
      acc.deficitsOvercome.length > 0
        ? Math.round(
            (acc.deficitsOvercome.reduce((sum, value) => sum + value, 0) /
              acc.deficitsOvercome.length) *
              10,
          ) / 10
        : null;
    const latestWinningScoreMinute =
      acc.latestWinningScoreMinutes.length > 0
        ? Math.max(...acc.latestWinningScoreMinutes)
        : null;

    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.matchesBehind,
      won: acc.comebackWins,
      drawn: acc.comebackDraws,
      lost: lossesAfterBehind,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: 0,
      leaguePoints: acc.tablePointsGained,
      extra: {
        totalSuccessfulComebacks,
        comebackSuccessPct,
        comebackWinPct,
        comebackDrawPct,
        largestDeficitOvercome:
          acc.largestDeficitOvercome > 0 ? acc.largestDeficitOvercome : null,
        averageDeficitOvercome,
        tablePointsGained: acc.tablePointsGained,
        comebacksFrom7Plus: acc.comebacksFrom7Plus > 0 ? acc.comebacksFrom7Plus : null,
        comebacksFrom10Plus: acc.comebacksFrom10Plus > 0 ? acc.comebacksFrom10Plus : null,
        comebacksFrom14Plus: acc.comebacksFrom14Plus > 0 ? acc.comebacksFrom14Plus : null,
        secondHalfComebacks: acc.secondHalfComebacks > 0 ? acc.secondHalfComebacks : null,
        finalTwentyComebacks: acc.finalTwentyComebacks > 0 ? acc.finalTwentyComebacks : null,
        latestWinningScoreMinute,
      },
    };
  });

  rows = sortComebackRows(rows, input.sortBy ?? "comeback_wins");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithCoverageData = new Set(
    scopedSeason
      .filter((row) => {
        if (comebackFrom === "half_time") {
          return row.halfTimeScoreVerified !== false;
        }
        if (comebackFrom === "after_sixty") {
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
    filterSummary: buildComebackFilterSummary({
      tableView: input.tableView,
      comebackFrom,
      minimumDeficitPreset,
      minimumDeficit,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
  };
}
