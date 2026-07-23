import {
  flattenRecentFormMatches,
  formatFormDateRange,
  recentFormMatchesByTeam,
} from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import { filterByKickoffRange } from "./rugby-table-metrics-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import {
  parseTriesMatchRangeCount,
  parseTriesScoredPeriod,
  triesScoredPeriodLabel,
  type TriesMatchRangePreset,
  type TriesScoredPeriod,
} from "./tries-scored-table-service";
import {
  parseTriesConcededSortBy,
  type TriesConcededSortBy,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type TriesConcededPeriod = TriesScoredPeriod;

export type { TriesConcededSortBy };
export { parseTriesConcededSortBy };

export function parseTriesConcededPeriod(value: string | null | undefined): TriesConcededPeriod {
  return parseTriesScoredPeriod(value);
}

export function triesConcededForPeriod(
  row: TeamFixturePerspective,
  period: TriesConcededPeriod,
): number | null {
  if (period === "first_half") return row.firstHalfTriesAgainst ?? null;
  if (period === "second_half") return row.secondHalfTriesAgainst ?? null;
  if (period === "final_20") return row.finalTwentyTriesAgainst ?? null;
  return row.triesAgainst ?? null;
}

export function perspectiveHasTriesConcededDataForPeriod(
  row: TeamFixturePerspective,
  period: TriesConcededPeriod,
): boolean {
  return triesConcededForPeriod(row, period) != null;
}

export function buildTriesConcededFilterSummary(input: {
  tableView: RugbyTableView;
  period: TriesConcededPeriod;
  matchRangePreset: TriesMatchRangePreset;
  matchRangeCount: number | null;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  const range =
    input.matchRangeCount != null
      ? `last ${input.matchRangeCount} completed ${venue}matches`
      : `completed ${venue}matches`;
  return `This table ranks teams by tries conceded in ${triesScoredPeriodLabel(input.period).toLowerCase()} across ${range}.`;
}

type TriesConcededAccumulator = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  totalTriesConceded: number;
  matchesConcedingTry: number;
  matchesConceding2Plus: number;
  matchesConceding3Plus: number;
  matchesConceding4Plus: number;
  matchesConceding5Plus: number;
  firstHalfTriesConceded: number;
  secondHalfTriesConceded: number;
  finalTwentyTriesConceded: number;
  matchesRequested: number | null;
  matchesUsed: number;
};

function createTriesConcededAccumulator(
  teamId: string,
  teamName: string,
  matchesRequested: number | null,
): TriesConcededAccumulator {
  return {
    teamId,
    teamName,
    matchesPlayed: 0,
    totalTriesConceded: 0,
    matchesConcedingTry: 0,
    matchesConceding2Plus: 0,
    matchesConceding3Plus: 0,
    matchesConceding4Plus: 0,
    matchesConceding5Plus: 0,
    firstHalfTriesConceded: 0,
    secondHalfTriesConceded: 0,
    finalTwentyTriesConceded: 0,
    matchesRequested,
    matchesUsed: 0,
  };
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function sortTriesConcededRows(
  rows: RugbyTableStandingRow[],
  sortBy: TriesConcededSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "lowest_tries_conceded_per_match") {
      const av = Number(a.extra?.triesConcededPerMatch ?? 0);
      const bv = Number(b.extra?.triesConcededPerMatch ?? 0);
      if (av !== bv) return av - bv;
    } else if (sortBy === "lowest_try_conceding_rate_pct") {
      const av = Number(a.extra?.tryConcedingRatePct ?? 0);
      const bv = Number(b.extra?.tryConcedingRatePct ?? 0);
      if (av !== bv) return av - bv;
    } else if (sortBy === "two_plus_conceded_pct") {
      const av = Number(a.extra?.twoPlusConcededPct ?? 0);
      const bv = Number(b.extra?.twoPlusConcededPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "three_plus_conceded_pct") {
      const av = Number(a.extra?.threePlusConcededPct ?? 0);
      const bv = Number(b.extra?.threePlusConcededPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "four_plus_conceded_pct") {
      const av = Number(a.extra?.fourPlusConcededPct ?? 0);
      const bv = Number(b.extra?.fourPlusConcededPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "five_plus_conceded_pct") {
      const av = Number(a.extra?.fivePlusConcededPct ?? 0);
      const bv = Number(b.extra?.fivePlusConcededPct ?? 0);
      if (bv !== av) return bv - av;
    } else {
      const av = Number(a.extra?.triesConceded ?? a.leaguePoints ?? 0);
      const bv = Number(b.extra?.triesConceded ?? b.leaguePoints ?? 0);
      if (av !== bv) return av - bv;
    }

    const aConceded = Number(a.extra?.triesConceded ?? a.leaguePoints ?? 0);
    const bConceded = Number(b.extra?.triesConceded ?? b.leaguePoints ?? 0);
    if (aConceded !== bConceded) return aConceded - bConceded;
    const aAvg = Number(a.extra?.triesConcededPerMatch ?? 0);
    const bAvg = Number(b.extra?.triesConcededPerMatch ?? 0);
    if (aAvg !== bAvg) return aAvg - bAvg;
    const aRate = Number(a.extra?.tryConcedingRatePct ?? 0);
    const bRate = Number(b.extra?.tryConcedingRatePct ?? 0);
    if (aRate !== bRate) return aRate - bRate;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildTriesConcededTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  period?: TriesConcededPeriod;
  matchRangeCount?: number | null;
  matchRangePreset?: TriesMatchRangePreset;
  minMatchesPlayed?: number;
  sortBy?: TriesConcededSortBy;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  qualifyingMatchCount: number;
  completedMatchCount: number;
  triesCoveragePct: number;
  filterSummary: string;
  dateRangeLabel: string | null;
  period: TriesConcededPeriod;
  matchRangeCount: number | null;
} {
  const period = input.period ?? "full_match";
  const matchRangePreset = input.matchRangePreset ?? "all";
  const matchRangeCount = input.matchRangeCount ?? null;

  let scopedSeason = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scopedSeason = filterByKickoffRange(scopedSeason, input.dateFrom, input.dateTo);
  }

  const completedMatchCount = uniqueFixtureCount(scopedSeason);

  let selectedPerspectives = scopedSeason;
  if (matchRangeCount != null) {
    const matchesByTeam = recentFormMatchesByTeam(
      scopedSeason,
      matchRangeCount,
      input.tableView,
    );
    selectedPerspectives = flattenRecentFormMatches(matchesByTeam);
  } else if (input.tableView === "home") {
    selectedPerspectives = scopedSeason.filter((row) => row.side === "home");
  } else if (input.tableView === "away") {
    selectedPerspectives = scopedSeason.filter((row) => row.side === "away");
  }

  const scoringPerspectives = selectedPerspectives.filter((row) =>
    perspectiveHasTriesConcededDataForPeriod(row, period),
  );

  const accumulators = new Map<string, TriesConcededAccumulator>();
  for (const row of scoringPerspectives) {
    const tries = triesConcededForPeriod(row, period);
    if (tries == null) continue;

    const acc =
      accumulators.get(row.teamId) ??
      createTriesConcededAccumulator(row.teamId, row.teamName, matchRangeCount);

    acc.matchesPlayed += 1;
    acc.matchesUsed += 1;
    acc.totalTriesConceded += tries;
    if (tries >= 1) acc.matchesConcedingTry += 1;
    if (tries >= 2) acc.matchesConceding2Plus += 1;
    if (tries >= 3) acc.matchesConceding3Plus += 1;
    if (tries >= 4) acc.matchesConceding4Plus += 1;
    if (tries >= 5) acc.matchesConceding5Plus += 1;

    if (row.firstHalfTriesAgainst != null) {
      acc.firstHalfTriesConceded += row.firstHalfTriesAgainst;
    }
    if (row.secondHalfTriesAgainst != null) {
      acc.secondHalfTriesConceded += row.secondHalfTriesAgainst;
    }
    if (row.finalTwentyTriesAgainst != null) {
      acc.finalTwentyTriesConceded += row.finalTwentyTriesAgainst;
    }

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const triesConcededPerMatch =
      acc.matchesPlayed > 0
        ? Math.round((acc.totalTriesConceded / acc.matchesPlayed) * 100) / 100
        : null;

    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.matchesPlayed,
      won: 0,
      drawn: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: 0,
      leaguePoints: acc.totalTriesConceded,
      triesAgainst: acc.totalTriesConceded,
      matchesRequested: acc.matchesRequested ?? undefined,
      matchesUsed: acc.matchesUsed,
      extra: {
        triesConceded: acc.totalTriesConceded,
        triesConcededPerMatch,
        matchesConcedingTry: acc.matchesConcedingTry,
        tryConcedingRatePct: pct(acc.matchesConcedingTry, acc.matchesPlayed),
        matchesConceding2Plus: acc.matchesConceding2Plus,
        matchesConceding3Plus: acc.matchesConceding3Plus,
        matchesConceding4Plus: acc.matchesConceding4Plus,
        matchesConceding5Plus: acc.matchesConceding5Plus,
        twoPlusConcededPct: pct(acc.matchesConceding2Plus, acc.matchesPlayed),
        threePlusConcededPct: pct(acc.matchesConceding3Plus, acc.matchesPlayed),
        fourPlusConcededPct: pct(acc.matchesConceding4Plus, acc.matchesPlayed),
        fivePlusConcededPct: pct(acc.matchesConceding5Plus, acc.matchesPlayed),
        firstHalfTriesConceded:
          acc.firstHalfTriesConceded > 0 ? acc.firstHalfTriesConceded : null,
        secondHalfTriesConceded:
          acc.secondHalfTriesConceded > 0 ? acc.secondHalfTriesConceded : null,
        finalTwentyTriesConceded:
          acc.finalTwentyTriesConceded > 0 ? acc.finalTwentyTriesConceded : null,
      },
    };
  });

  rows = sortTriesConcededRows(rows, input.sortBy ?? "fewest_tries_conceded");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithTryData = new Set(
    scopedSeason
      .filter((row) => perspectiveHasTriesConcededDataForPeriod(row, period))
      .map((row) => row.fixtureId),
  );
  const qualifyingFixtures = new Set(scoringPerspectives.map((row) => row.fixtureId));

  return {
    rows,
    scoringPerspectives,
    qualifyingMatchCount: qualifyingFixtures.size,
    completedMatchCount,
    triesCoveragePct:
      completedMatchCount > 0
        ? Math.round((fixturesWithTryData.size / completedMatchCount) * 100)
        : 0,
    filterSummary: buildTriesConcededFilterSummary({
      tableView: input.tableView,
      period,
      matchRangePreset,
      matchRangeCount,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    period,
    matchRangeCount,
  };
}
