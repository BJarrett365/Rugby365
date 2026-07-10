import {
  flattenRecentFormMatches,
  formatFormDateRange,
  recentFormMatchesByTeam,
} from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import { filterByKickoffRange, matchLeaguePoints } from "./rugby-table-metrics-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type TriesScoredPeriod = "full_match" | "first_half" | "second_half" | "final_20";

export type TriesMatchRangePreset = "all" | "3" | "5" | "10" | "custom";

export type TriesScoredSortBy =
  | "tries_scored"
  | "tries_per_match"
  | "try_scoring_rate_pct"
  | "two_plus_tries_pct"
  | "three_plus_tries_pct"
  | "four_plus_tries_pct"
  | "five_plus_tries_pct";

export function parseTriesScoredPeriod(value: string | null | undefined): TriesScoredPeriod {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "first_half" || normalized === "first-half" || normalized === "1h") {
    return "first_half";
  }
  if (normalized === "second_half" || normalized === "second-half" || normalized === "2h") {
    return "second_half";
  }
  if (
    normalized === "final_20" ||
    normalized === "final-20" ||
    normalized === "final_20_minutes" ||
    normalized === "f20"
  ) {
    return "final_20";
  }
  return "full_match";
}

export function parseTriesMatchRangePreset(
  value: string | null | undefined,
): TriesMatchRangePreset {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "3" || normalized === "last_3") return "3";
  if (normalized === "5" || normalized === "last_5") return "5";
  if (normalized === "10" || normalized === "last_10") return "10";
  if (normalized === "custom") return "custom";
  return "all";
}

export function parseTriesMatchRangeCount(
  preset: TriesMatchRangePreset,
  customValue: string | number | null | undefined,
): number | null {
  if (preset === "all") return null;
  if (preset === "custom") {
    const parsed = Number(customValue);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50) : null;
  }
  return Number(preset);
}

export function parseTriesScoredSortBy(value: string | null | undefined): TriesScoredSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "tries_per_match" || normalized === "avg_tries") {
    return "tries_per_match";
  }
  if (normalized === "try_scoring_rate_pct" || normalized === "try_scoring_rate") {
    return "try_scoring_rate_pct";
  }
  if (normalized === "two_plus_tries_pct" || normalized === "2_plus_pct") {
    return "two_plus_tries_pct";
  }
  if (normalized === "three_plus_tries_pct" || normalized === "3_plus_pct") {
    return "three_plus_tries_pct";
  }
  if (normalized === "four_plus_tries_pct" || normalized === "4_plus_pct") {
    return "four_plus_tries_pct";
  }
  if (normalized === "five_plus_tries_pct" || normalized === "5_plus_pct") {
    return "five_plus_tries_pct";
  }
  return "tries_scored";
}

export function triesScoredPeriodLabel(period: TriesScoredPeriod): string {
  if (period === "first_half") return "First half";
  if (period === "second_half") return "Second half";
  if (period === "final_20") return "Final 20 minutes";
  return "Full match";
}

export function triesMatchRangeLabel(
  preset: TriesMatchRangePreset,
  count: number | null,
): string {
  if (preset === "all") return "All matches";
  if (preset === "custom" && count) return `Last ${count} matches`;
  if (count) return `Last ${count} matches`;
  return "All matches";
}

export function triesForPeriod(
  row: TeamFixturePerspective,
  period: TriesScoredPeriod,
): number | null {
  if (period === "first_half") return row.firstHalfTriesFor ?? null;
  if (period === "second_half") return row.secondHalfTriesFor ?? null;
  if (period === "final_20") return row.finalTwentyTriesFor ?? null;
  return row.triesFor ?? null;
}

export function perspectiveHasTriesDataForPeriod(
  row: TeamFixturePerspective,
  period: TriesScoredPeriod,
): boolean {
  return triesForPeriod(row, period) != null;
}

export function buildTriesScoredFilterSummary(input: {
  tableView: RugbyTableView;
  period: TriesScoredPeriod;
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
  return `This table ranks teams by tries scored in ${triesScoredPeriodLabel(input.period).toLowerCase()} across ${range}.`;
}

type TriesScoredAccumulator = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  totalTries: number;
  matchesWithTry: number;
  matchesWith2Plus: number;
  matchesWith3Plus: number;
  matchesWith4Plus: number;
  matchesWith5Plus: number;
  firstHalfTries: number;
  secondHalfTries: number;
  finalTwentyTries: number;
  tryBonusPoints: number;
  matchesRequested: number | null;
  matchesUsed: number;
};

function createTriesScoredAccumulator(
  teamId: string,
  teamName: string,
  matchesRequested: number | null,
): TriesScoredAccumulator {
  return {
    teamId,
    teamName,
    matchesPlayed: 0,
    totalTries: 0,
    matchesWithTry: 0,
    matchesWith2Plus: 0,
    matchesWith3Plus: 0,
    matchesWith4Plus: 0,
    matchesWith5Plus: 0,
    firstHalfTries: 0,
    secondHalfTries: 0,
    finalTwentyTries: 0,
    tryBonusPoints: 0,
    matchesRequested,
    matchesUsed: 0,
  };
}

function pct(numerator: number, denominator: number): number | undefined {
  if (denominator <= 0) return undefined;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function sortTriesScoredRows(
  rows: RugbyTableStandingRow[],
  sortBy: TriesScoredSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "tries_per_match") {
      const av = Number(a.extra?.triesPerMatch ?? 0);
      const bv = Number(b.extra?.triesPerMatch ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "try_scoring_rate_pct") {
      const av = Number(a.extra?.tryScoringRatePct ?? 0);
      const bv = Number(b.extra?.tryScoringRatePct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "two_plus_tries_pct") {
      const av = Number(a.extra?.twoPlusTriesPct ?? 0);
      const bv = Number(b.extra?.twoPlusTriesPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "three_plus_tries_pct") {
      const av = Number(a.extra?.threePlusTriesPct ?? 0);
      const bv = Number(b.extra?.threePlusTriesPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "four_plus_tries_pct") {
      const av = Number(a.extra?.fourPlusTriesPct ?? 0);
      const bv = Number(b.extra?.fourPlusTriesPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "five_plus_tries_pct") {
      const av = Number(a.extra?.fivePlusTriesPct ?? 0);
      const bv = Number(b.extra?.fivePlusTriesPct ?? 0);
      if (bv !== av) return bv - av;
    } else {
      const av = Number(a.extra?.triesScored ?? a.leaguePoints ?? 0);
      const bv = Number(b.extra?.triesScored ?? b.leaguePoints ?? 0);
      if (bv !== av) return bv - av;
    }

    const aTries = Number(a.extra?.triesScored ?? a.leaguePoints ?? 0);
    const bTries = Number(b.extra?.triesScored ?? b.leaguePoints ?? 0);
    if (bTries !== aTries) return bTries - aTries;
    const aAvg = Number(a.extra?.triesPerMatch ?? 0);
    const bAvg = Number(b.extra?.triesPerMatch ?? 0);
    if (bAvg !== aAvg) return bAvg - aAvg;
    const aRate = Number(a.extra?.tryScoringRatePct ?? 0);
    const bRate = Number(b.extra?.tryScoringRatePct ?? 0);
    if (bRate !== aRate) return bRate - aRate;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildTriesScoredTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  period?: TriesScoredPeriod;
  matchRangeCount?: number | null;
  matchRangePreset?: TriesMatchRangePreset;
  minMatchesPlayed?: number;
  sortBy?: TriesScoredSortBy;
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
  period: TriesScoredPeriod;
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
    perspectiveHasTriesDataForPeriod(row, period),
  );

  const accumulators = new Map<string, TriesScoredAccumulator>();
  for (const row of scoringPerspectives) {
    const tries = triesForPeriod(row, period);
    if (tries == null) continue;

    const acc =
      accumulators.get(row.teamId) ??
      createTriesScoredAccumulator(row.teamId, row.teamName, matchRangeCount);

    acc.matchesPlayed += 1;
    acc.matchesUsed += 1;
    acc.totalTries += tries;
    if (tries >= 1) acc.matchesWithTry += 1;
    if (tries >= 2) acc.matchesWith2Plus += 1;
    if (tries >= 3) acc.matchesWith3Plus += 1;
    if (tries >= 4) acc.matchesWith4Plus += 1;
    if (tries >= 5) acc.matchesWith5Plus += 1;

    if (period === "full_match" && row.triesFor != null) {
      const outcome = matchLeaguePoints(
        row.pointsFor,
        row.pointsAgainst,
        row.triesFor,
        input.rules,
      );
      acc.tryBonusPoints += outcome.tryBonusPoints;
    }

    if (row.firstHalfTriesFor != null) acc.firstHalfTries += row.firstHalfTriesFor;
    if (row.secondHalfTriesFor != null) acc.secondHalfTries += row.secondHalfTriesFor;
    if (row.finalTwentyTriesFor != null) acc.finalTwentyTries += row.finalTwentyTriesFor;

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const triesPerMatch =
      acc.matchesPlayed > 0
        ? Math.round((acc.totalTries / acc.matchesPlayed) * 100) / 100
        : undefined;

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
      bonusPoints: acc.tryBonusPoints,
      leaguePoints: acc.totalTries,
      triesFor: acc.totalTries,
      tryBonusPoints: acc.tryBonusPoints > 0 ? acc.tryBonusPoints : null,
      matchesRequested: acc.matchesRequested ?? undefined,
      matchesUsed: acc.matchesUsed,
      extra: {
        triesScored: acc.totalTries,
        triesPerMatch,
        matchesWithTry: acc.matchesWithTry,
        tryScoringRatePct: pct(acc.matchesWithTry, acc.matchesPlayed),
        matchesWith2Plus: acc.matchesWith2Plus,
        matchesWith3Plus: acc.matchesWith3Plus,
        matchesWith4Plus: acc.matchesWith4Plus,
        matchesWith5Plus: acc.matchesWith5Plus,
        twoPlusTriesPct: pct(acc.matchesWith2Plus, acc.matchesPlayed),
        threePlusTriesPct: pct(acc.matchesWith3Plus, acc.matchesPlayed),
        fourPlusTriesPct: pct(acc.matchesWith4Plus, acc.matchesPlayed),
        fivePlusTriesPct: pct(acc.matchesWith5Plus, acc.matchesPlayed),
        firstHalfTries: acc.firstHalfTries > 0 ? acc.firstHalfTries : null,
        secondHalfTries: acc.secondHalfTries > 0 ? acc.secondHalfTries : null,
        finalTwentyTries: acc.finalTwentyTries > 0 ? acc.finalTwentyTries : null,
        tryBonusPointsTotal: acc.tryBonusPoints > 0 ? acc.tryBonusPoints : null,
      },
    };
  });

  rows = sortTriesScoredRows(rows, input.sortBy ?? "tries_scored");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithTryData = new Set(
    scopedSeason
      .filter((row) => perspectiveHasTriesDataForPeriod(row, period))
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
    filterSummary: buildTriesScoredFilterSummary({
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
