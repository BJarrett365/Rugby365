import {
  flattenRecentFormMatches,
  formatFormDateRange,
  recentFormMatchesByTeam,
} from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import { resolveScoringRulesForSeasonTable } from "./on-this-date-table-service";
import { filterByKickoffRange, matchLeaguePoints } from "./rugby-table-metrics-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import {
  parseTriesMatchRangeCount,
  type TriesMatchRangePreset,
} from "./tries-scored-table-service";
import {
  parseWinningBonusPointsSortBy,
  parseWinningBonusTypeFilter,
  type WinningBonusPointsSortBy,
  type WinningBonusTypeFilter,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { WinningBonusTypeFilter, WinningBonusPointsSortBy };
export { parseWinningBonusTypeFilter, parseWinningBonusPointsSortBy };

export function competitionHasBonusPoints(rules: RugbyScoringRules): boolean {
  return rules.tryBonusPoints > 0 || rules.losingBonusPoints > 0;
}

export function maximumWinTablePoints(rules: RugbyScoringRules): number {
  let total = rules.winPoints;
  if (rules.tryBonusPoints > 0) total += rules.tryBonusPoints;
  return total;
}

export function formatScoringRulesBonusSummary(rules: RugbyScoringRules): string {
  if (!competitionHasBonusPoints(rules)) {
    return "This competition season does not award bonus table points.";
  }
  const parts: string[] = [];
  if (rules.tryBonusPoints > 0) {
    parts.push(
      `${rules.tryBonusPoints} try bonus point${rules.tryBonusPoints === 1 ? "" : "s"} for ${rules.tryBonusThreshold} or more tries`,
    );
  }
  if (rules.losingBonusPoints > 0) {
    parts.push(
      `${rules.losingBonusPoints} losing bonus point${rules.losingBonusPoints === 1 ? "" : "s"} for a defeat by ${rules.losingBonusMargin} points or fewer`,
    );
  }
  return `This competition awards ${parts.join(" and ")}.`;
}

export type MatchBonusResolution = {
  tryBonusPoints: number;
  losingBonusPoints: number;
  totalBonusPoints: number;
  result: "won" | "drawn" | "lost";
  leaguePoints: number;
  isMaximumPointWin: boolean;
};

export function rulesForPerspective(
  row: TeamFixturePerspective,
  competitionSlug: string | null | undefined,
  competitionType: string | null | undefined,
  defaultRules: RugbyScoringRules,
): RugbyScoringRules {
  return resolveScoringRulesForSeasonTable({
    competitionSlug,
    competitionType,
    seasonStartYear: row.seasonStartYear,
  });
}

export function resolveMatchBonusPoints(
  row: TeamFixturePerspective,
  rules: RugbyScoringRules,
): MatchBonusResolution | null {
  const needsTryData = rules.tryBonusPoints > 0 && rules.tryBonusThreshold > 0;
  if (needsTryData && row.triesFor == null) return null;

  const outcome = matchLeaguePoints(row.pointsFor, row.pointsAgainst, row.triesFor, rules);
  const isMaximumPointWin =
    outcome.result === "won" && outcome.leaguePoints >= maximumWinTablePoints(rules);

  return {
    tryBonusPoints: outcome.tryBonusPoints,
    losingBonusPoints: outcome.losingBonusPoints,
    totalBonusPoints: outcome.bonusPoints,
    result: outcome.result,
    leaguePoints: outcome.leaguePoints,
    isMaximumPointWin,
  };
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function bonusPointMatchForFilter(
  resolution: MatchBonusResolution,
  bonusType: WinningBonusTypeFilter,
): boolean {
  if (bonusType === "try_bonus") return resolution.tryBonusPoints > 0;
  if (bonusType === "losing_bonus") return resolution.losingBonusPoints > 0;
  if (bonusType === "maximum_point_wins") return resolution.isMaximumPointWin;
  return resolution.totalBonusPoints > 0;
}

type WinningBonusAccumulator = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  tryBonusPoints: number;
  losingBonusPoints: number;
  totalBonusPoints: number;
  maximumPointWins: number;
  bonusPointMatches: number;
  homeBonusPoints: number;
  awayBonusPoints: number;
  bonusMatchFlags: boolean[];
  matchesRequested: number | null;
  matchesUsed: number;
};

function createWinningBonusAccumulator(
  teamId: string,
  teamName: string,
  matchesRequested: number | null,
): WinningBonusAccumulator {
  return {
    teamId,
    teamName,
    matchesPlayed: 0,
    wins: 0,
    tryBonusPoints: 0,
    losingBonusPoints: 0,
    totalBonusPoints: 0,
    maximumPointWins: 0,
    bonusPointMatches: 0,
    homeBonusPoints: 0,
    awayBonusPoints: 0,
    bonusMatchFlags: [],
    matchesRequested,
    matchesUsed: 0,
  };
}

function computeBonusStreaks(flags: boolean[]): {
  currentBonusStreak: number;
  longestBonusStreak: number;
} {
  let longest = 0;
  let current = 0;
  let running = 0;

  for (const flag of flags) {
    if (flag) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  for (let index = flags.length - 1; index >= 0; index -= 1) {
    if (flags[index]) current += 1;
    else break;
  }

  return { currentBonusStreak: current, longestBonusStreak: longest };
}

export function sortWinningBonusPointsRows(
  rows: RugbyTableStandingRow[],
  sortBy: WinningBonusPointsSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "try_bonus_points") {
      const av = Number(a.extra?.tryBonusPointsTotal ?? a.tryBonusPoints ?? 0);
      const bv = Number(b.extra?.tryBonusPointsTotal ?? b.tryBonusPoints ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "losing_bonus_points") {
      const av = Number(a.extra?.losingBonusPointsTotal ?? a.losingBonusPoints ?? 0);
      const bv = Number(b.extra?.losingBonusPointsTotal ?? b.losingBonusPoints ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "maximum_point_wins") {
      const av = Number(a.extra?.maximumPointWins ?? 0);
      const bv = Number(b.extra?.maximumPointWins ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "bonus_point_rate_pct") {
      const av = Number(a.extra?.bonusPointRatePct ?? 0);
      const bv = Number(b.extra?.bonusPointRatePct ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "bonus_points_per_match") {
      const av = Number(a.extra?.bonusPointsPerMatch ?? 0);
      const bv = Number(b.extra?.bonusPointsPerMatch ?? 0);
      if (bv !== av) return bv - av;
    } else {
      const av = Number(a.extra?.totalBonusPoints ?? a.bonusPoints ?? 0);
      const bv = Number(b.extra?.totalBonusPoints ?? b.bonusPoints ?? 0);
      if (bv !== av) return bv - av;
    }

    const aTry = Number(a.extra?.tryBonusPointsTotal ?? a.tryBonusPoints ?? 0);
    const bTry = Number(b.extra?.tryBonusPointsTotal ?? b.tryBonusPoints ?? 0);
    if (bTry !== aTry) return bTry - aTry;
    const aMax = Number(a.extra?.maximumPointWins ?? 0);
    const bMax = Number(b.extra?.maximumPointWins ?? 0);
    if (bMax !== aMax) return bMax - aMax;
    const aRate = Number(a.extra?.bonusPointRatePct ?? 0);
    const bRate = Number(b.extra?.bonusPointRatePct ?? 0);
    if (bRate !== aRate) return bRate - aRate;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildWinningBonusPointsFilterSummary(input: {
  tableView: RugbyTableView;
  matchRangePreset: TriesMatchRangePreset;
  matchRangeCount: number | null;
  bonusType: WinningBonusTypeFilter;
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
  const focus =
    input.bonusType === "try_bonus"
      ? "try bonus points"
      : input.bonusType === "losing_bonus"
        ? "losing bonus points"
        : input.bonusType === "maximum_point_wins"
          ? "maximum-point wins"
          : "try and losing bonus points";
  return `This table ranks teams by ${focus} across ${range} using competition scoring rules.`;
}

export function buildWinningBonusPointsTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  competitionSlug?: string | null;
  competitionType?: string | null;
  tableView: RugbyTableView;
  matchRangeCount?: number | null;
  matchRangePreset?: TriesMatchRangePreset;
  bonusType?: WinningBonusTypeFilter;
  minMatchesPlayed?: number;
  sortBy?: WinningBonusPointsSortBy;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  qualifyingMatchCount: number;
  completedMatchCount: number;
  bonusCoveragePct: number;
  filterSummary: string;
  dateRangeLabel: string | null;
  matchRangeCount: number | null;
  bonusNotApplicable: boolean;
  scoringRulesSummary: string;
  maximumTablePoints: number;
} {
  const matchRangePreset = input.matchRangePreset ?? "all";
  const matchRangeCount = input.matchRangeCount ?? null;
  const bonusType = input.bonusType ?? "all";

  const seasonRules = resolveScoringRulesForSeasonTable({
    competitionSlug: input.competitionSlug,
    competitionType: input.competitionType,
    seasonStartYear: input.seasonPerspectives.find((row) => row.seasonStartYear != null)
      ?.seasonStartYear,
  });
  const effectiveRules = competitionHasBonusPoints(seasonRules) ? seasonRules : input.rules;
  const bonusNotApplicable = !competitionHasBonusPoints(effectiveRules);

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

  const accumulators = new Map<string, WinningBonusAccumulator>();
  const chronologicalByTeam = new Map<string, TeamFixturePerspective[]>();

  for (const row of selectedPerspectives) {
    const rules = rulesForPerspective(
      row,
      input.competitionSlug,
      input.competitionType,
      effectiveRules,
    );
    if (!competitionHasBonusPoints(rules)) continue;

    const resolution = resolveMatchBonusPoints(row, rules);
    if (!resolution) continue;

    const acc =
      accumulators.get(row.teamId) ??
      createWinningBonusAccumulator(row.teamId, row.teamName, matchRangeCount);

    acc.matchesPlayed += 1;
    acc.matchesUsed += 1;
    if (resolution.result === "won") acc.wins += 1;
    acc.tryBonusPoints += resolution.tryBonusPoints;
    acc.losingBonusPoints += resolution.losingBonusPoints;
    acc.totalBonusPoints += resolution.totalBonusPoints;
    if (resolution.isMaximumPointWin) acc.maximumPointWins += 1;
    if (bonusPointMatchForFilter(resolution, bonusType)) acc.bonusPointMatches += 1;
    if (row.side === "home") acc.homeBonusPoints += resolution.totalBonusPoints;
    if (row.side === "away") acc.awayBonusPoints += resolution.totalBonusPoints;
    acc.bonusMatchFlags.push(resolution.totalBonusPoints > 0);

    accumulators.set(row.teamId, acc);

    const chronological = chronologicalByTeam.get(row.teamId) ?? [];
    chronological.push(row);
    chronologicalByTeam.set(row.teamId, chronological);
  }

  for (const [teamId, matches] of chronologicalByTeam) {
    const acc = accumulators.get(teamId);
    if (!acc) continue;
    const sorted = [...matches].sort((a, b) => {
      const at = a.kickoffAt?.getTime() ?? 0;
      const bt = b.kickoffAt?.getTime() ?? 0;
      return at - bt;
    });
    const flags: boolean[] = [];
    for (const row of sorted) {
      const rules = rulesForPerspective(
        row,
        input.competitionSlug,
        input.competitionType,
        effectiveRules,
      );
      const resolution = resolveMatchBonusPoints(row, rules);
      flags.push((resolution?.totalBonusPoints ?? 0) > 0);
    }
    acc.bonusMatchFlags = flags;
  }

  const scoringPerspectives = selectedPerspectives.filter((row) => {
    const rules = rulesForPerspective(
      row,
      input.competitionSlug,
      input.competitionType,
      effectiveRules,
    );
    return competitionHasBonusPoints(rules) && resolveMatchBonusPoints(row, rules) != null;
  });

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const streaks = computeBonusStreaks(acc.bonusMatchFlags);
    const bonusPointsPerMatch =
      acc.matchesPlayed > 0
        ? Math.round((acc.totalBonusPoints / acc.matchesPlayed) * 100) / 100
        : null;
    const tryBonusPerMatch =
      acc.matchesPlayed > 0
        ? Math.round((acc.tryBonusPoints / acc.matchesPlayed) * 100) / 100
        : null;

    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.matchesPlayed,
      won: acc.wins,
      drawn: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      tryBonusPoints: acc.tryBonusPoints,
      losingBonusPoints: acc.losingBonusPoints,
      bonusPoints: acc.totalBonusPoints,
      leaguePoints: acc.totalBonusPoints,
      matchesRequested: acc.matchesRequested ?? undefined,
      matchesUsed: acc.matchesUsed,
      extra: {
        tryBonusPointsTotal: acc.tryBonusPoints,
        losingBonusPointsTotal: acc.losingBonusPoints,
        totalBonusPoints: acc.totalBonusPoints,
        maximumPointWins: acc.maximumPointWins,
        maximumPointWinPct: pct(acc.maximumPointWins, acc.wins),
        bonusPointMatches: acc.bonusPointMatches,
        bonusPointRatePct: pct(acc.bonusPointMatches, acc.matchesPlayed),
        bonusPointsPerMatch,
        tryBonusPointsPerMatch: tryBonusPerMatch,
        homeBonusPoints: acc.homeBonusPoints > 0 ? acc.homeBonusPoints : null,
        awayBonusPoints: acc.awayBonusPoints > 0 ? acc.awayBonusPoints : null,
        currentBonusStreak: streaks.currentBonusStreak > 0 ? streaks.currentBonusStreak : null,
        longestBonusStreak: streaks.longestBonusStreak > 0 ? streaks.longestBonusStreak : null,
      },
    };
  });

  rows = sortWinningBonusPointsRows(rows, input.sortBy ?? "total_bonus_points");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithBonusData = new Set(scoringPerspectives.map((row) => row.fixtureId));
  const qualifyingFixtures = new Set(scoringPerspectives.map((row) => row.fixtureId));

  return {
    rows: bonusNotApplicable ? [] : rows,
    scoringPerspectives,
    qualifyingMatchCount: qualifyingFixtures.size,
    completedMatchCount,
    bonusCoveragePct:
      completedMatchCount > 0
        ? Math.round((fixturesWithBonusData.size / completedMatchCount) * 100)
        : 0,
    filterSummary: buildWinningBonusPointsFilterSummary({
      tableView: input.tableView,
      matchRangePreset,
      matchRangeCount,
      bonusType,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    matchRangeCount,
    bonusNotApplicable,
    scoringRulesSummary: formatScoringRulesBonusSummary(effectiveRules),
    maximumTablePoints: maximumWinTablePoints(effectiveRules),
  };
}
