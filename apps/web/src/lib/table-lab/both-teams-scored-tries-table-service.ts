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
  type TriesMatchRangePreset,
} from "./tries-scored-table-service";
import {
  parseBothTeamsScoredTriesSortBy,
  type BothTeamsScoredTriesSortBy,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { BothTeamsScoredTriesSortBy };
export { parseBothTeamsScoredTriesSortBy };

export function perspectiveHasVerifiedTryTotals(row: TeamFixturePerspective): boolean {
  return row.triesFor != null && row.triesAgainst != null;
}

export function bothTeamsScoredAtLeastOneTry(row: TeamFixturePerspective): boolean {
  if (!perspectiveHasVerifiedTryTotals(row)) return false;
  return row.triesFor! >= 1 && row.triesAgainst! >= 1;
}

export function bothTeamsScoredAtLeastTries(
  row: TeamFixturePerspective,
  threshold: number,
): boolean {
  if (!perspectiveHasVerifiedTryTotals(row)) return false;
  return row.triesFor! >= threshold && row.triesAgainst! >= threshold;
}

export function buildBothTeamsScoredTriesFilterSummary(input: {
  tableView: RugbyTableView;
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
  return `This table shows how often both teams score at least one try across ${range}.`;
}

type BothTeamsScoredTriesAccumulator = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  yesMatches: number;
  noMatches: number;
  bothTeams2Plus: number;
  bothTeams3Plus: number;
  bothTeams4Plus: number;
  matchesRequested: number | null;
  matchesUsed: number;
};

function createBothTeamsScoredTriesAccumulator(
  teamId: string,
  teamName: string,
  matchesRequested: number | null,
): BothTeamsScoredTriesAccumulator {
  return {
    teamId,
    teamName,
    matchesPlayed: 0,
    yesMatches: 0,
    noMatches: 0,
    bothTeams2Plus: 0,
    bothTeams3Plus: 0,
    bothTeams4Plus: 0,
    matchesRequested,
    matchesUsed: 0,
  };
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function sortBothTeamsScoredTriesRows(
  rows: RugbyTableStandingRow[],
  sortBy: BothTeamsScoredTriesSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "no_pct") {
      const av = Number(a.extra?.bothTeamsScoredNoPct ?? 0);
      const bv = Number(b.extra?.bothTeamsScoredNoPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "both_teams_2_plus_pct") {
      const av = Number(a.extra?.bothTeams2PlusPct ?? 0);
      const bv = Number(b.extra?.bothTeams2PlusPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "both_teams_3_plus_pct") {
      const av = Number(a.extra?.bothTeams3PlusPct ?? 0);
      const bv = Number(b.extra?.bothTeams3PlusPct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "both_teams_4_plus_pct") {
      const av = Number(a.extra?.bothTeams4PlusPct ?? 0);
      const bv = Number(b.extra?.bothTeams4PlusPct ?? 0);
      if (bv !== av) return bv - av;
    } else {
      const av = Number(a.extra?.bothTeamsScoredYesPct ?? 0);
      const bv = Number(b.extra?.bothTeamsScoredYesPct ?? 0);
      if (bv !== av) return bv - av;
    }

    const aYes = Number(a.extra?.bothTeamsScoredYes ?? a.leaguePoints ?? 0);
    const bYes = Number(b.extra?.bothTeamsScoredYes ?? b.leaguePoints ?? 0);
    if (bYes !== aYes) return bYes - aYes;
    const a2Plus = Number(a.extra?.bothTeams2PlusPct ?? 0);
    const b2Plus = Number(b.extra?.bothTeams2PlusPct ?? 0);
    if (b2Plus !== a2Plus) return b2Plus - a2Plus;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildBothTeamsScoredTriesTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  matchRangeCount?: number | null;
  matchRangePreset?: TriesMatchRangePreset;
  minMatchesPlayed?: number;
  sortBy?: BothTeamsScoredTriesSortBy;
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
  matchRangeCount: number | null;
} {
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
    perspectiveHasVerifiedTryTotals(row),
  );

  const accumulators = new Map<string, BothTeamsScoredTriesAccumulator>();
  for (const row of scoringPerspectives) {
    if (!perspectiveHasVerifiedTryTotals(row)) continue;

    const acc =
      accumulators.get(row.teamId) ??
      createBothTeamsScoredTriesAccumulator(row.teamId, row.teamName, matchRangeCount);

    acc.matchesPlayed += 1;
    acc.matchesUsed += 1;

    if (bothTeamsScoredAtLeastOneTry(row)) {
      acc.yesMatches += 1;
    } else {
      acc.noMatches += 1;
    }
    if (bothTeamsScoredAtLeastTries(row, 2)) acc.bothTeams2Plus += 1;
    if (bothTeamsScoredAtLeastTries(row, 3)) acc.bothTeams3Plus += 1;
    if (bothTeamsScoredAtLeastTries(row, 4)) acc.bothTeams4Plus += 1;

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => ({
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
    leaguePoints: acc.yesMatches,
    matchesRequested: acc.matchesRequested ?? undefined,
    matchesUsed: acc.matchesUsed,
    extra: {
      bothTeamsScoredYes: acc.yesMatches,
      bothTeamsScoredNo: acc.noMatches,
      bothTeamsScoredYesPct: pct(acc.yesMatches, acc.matchesPlayed),
      bothTeamsScoredNoPct: pct(acc.noMatches, acc.matchesPlayed),
      bothTeams2Plus: acc.bothTeams2Plus,
      bothTeams2PlusPct: pct(acc.bothTeams2Plus, acc.matchesPlayed),
      bothTeams3Plus: acc.bothTeams3Plus,
      bothTeams3PlusPct: pct(acc.bothTeams3Plus, acc.matchesPlayed),
      bothTeams4Plus: acc.bothTeams4Plus,
      bothTeams4PlusPct: pct(acc.bothTeams4Plus, acc.matchesPlayed),
    },
  }));

  rows = sortBothTeamsScoredTriesRows(rows, input.sortBy ?? "yes_pct");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithTryData = new Set(
    scopedSeason
      .filter((row) => perspectiveHasVerifiedTryTotals(row))
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
    filterSummary: buildBothTeamsScoredTriesFilterSummary({
      tableView: input.tableView,
      matchRangePreset,
      matchRangeCount,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    matchRangeCount,
  };
}
