import { kickoffInSeason } from "../season-label-utils";
import { formatSeasonRangeLabel } from "../season-label-utils";
import {
  addMatchToAccumulator,
  createStandingsAccumulator,
  filterBySide,
  matchLeaguePoints,
  standingOptionalFieldsFromAccumulator,
  type StandingsAccumulator,
} from "./rugby-table-metrics-service";
import {
  deductionsForTeamSeason,
  historicScoringRuleNotice,
  scoringRulesForPremiershipSeason,
} from "./premiership-season-scoring";
import {
  mergeIdentityWarnings,
  resolvePremiershipCanonicalIdentity,
} from "./premiership-team-identity";
import type {
  AllTimePremiershipSortBy,
  AllTimeSeasonRangeMode,
  AllTimeTeamStatus,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type {
  AllTimePremiershipCoverage,
  AllTimePremiershipSortBy,
  AllTimeSeasonRangeMode,
  AllTimeTeamStatus,
} from "./table-types";

export type AllTimePremiershipBuildResult = {
  rows: RugbyTableStandingRow[];
  warnings: string[];
  coverage: AllTimePremiershipCoverage;
  seasonsIncludedLabel: string;
  seasonYears: number[];
  teamCount: number;
  matchCount: number;
  identityReviewCount: number;
  historicScoringNotice: string;
};

type AllTimeAccumulator = StandingsAccumulator & {
  seasonYears: Set<number>;
  tryMatchCount: number;
  bonusMatchCount: number;
  deductionPoints: number;
};

function createAllTimeAccumulator(teamId: string, teamName: string): AllTimeAccumulator {
  return {
    ...createStandingsAccumulator(teamId, teamName),
    seasonYears: new Set<number>(),
    tryMatchCount: 0,
    bonusMatchCount: 0,
    deductionPoints: 0,
  };
}

export function resolveSeasonStartYearFromKickoff(
  kickoffAt: Date | null,
  seasonYearsCatalog?: number[],
): number | null {
  if (!kickoffAt || Number.isNaN(kickoffAt.getTime())) return null;
  if (seasonYearsCatalog?.length) {
    for (const year of seasonYearsCatalog) {
      if (kickoffInSeason(kickoffAt, year)) return year;
    }
  }
  const month = kickoffAt.getMonth();
  const year = kickoffAt.getFullYear();
  return month >= 6 ? year : year - 1;
}

export function parseAllTimeSeasonRangeMode(
  value: string | null | undefined,
): AllTimeSeasonRangeMode {
  if (value === "from" || value === "to" || value === "custom") return value;
  return "all";
}

export function parseAllTimeTeamStatus(value: string | null | undefined): AllTimeTeamStatus {
  if (value === "current" || value === "former") return value;
  return "all";
}

export function parseAllTimeSortBy(value: string | null | undefined): AllTimePremiershipSortBy {
  const allowed: AllTimePremiershipSortBy[] = [
    "league_points",
    "seasons",
    "played",
    "won",
    "win_pct",
    "points_for",
    "tries_for",
    "team_name",
  ];
  return allowed.includes(value as AllTimePremiershipSortBy)
    ? (value as AllTimePremiershipSortBy)
    : "league_points";
}

export function parseSeasonYearParam(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1987) return null;
  return Math.floor(parsed);
}

export function filterPerspectivesBySeasonRange(
  perspectives: TeamFixturePerspective[],
  input: {
    mode: AllTimeSeasonRangeMode;
    fromYear?: number | null;
    toYear?: number | null;
  },
): TeamFixturePerspective[] {
  if (input.mode === "all") return perspectives;
  return perspectives.filter((row) => {
    const year = row.seasonStartYear;
    if (year == null) return false;
    if (input.mode === "from" && input.fromYear != null) return year >= input.fromYear;
    if (input.mode === "to" && input.toYear != null) return year <= input.toYear;
    if (input.mode === "custom") {
      if (input.fromYear != null && year < input.fromYear) return false;
      if (input.toYear != null && year > input.toYear) return false;
    }
    return true;
  });
}

function winPct(won: number, played: number): number {
  if (played <= 0) return 0;
  return Math.round((won / played) * 1000) / 10;
}

function finalizeAllTimeRow(acc: AllTimeAccumulator, rank: number): RugbyTableStandingRow {
  const pointsDiff = acc.pointsFor - acc.pointsAgainst;
  const hasTryStats = acc.tryStatsMatches > 0;
  const rules = scoringRulesForPremiershipSeason(
    acc.seasonYears.size ? Math.max(...acc.seasonYears) : 2001,
  );
  const optionalFields = standingOptionalFieldsFromAccumulator(acc, rules);
  return {
    rank,
    teamId: acc.teamId,
    teamName: acc.teamName,
    played: acc.played,
    won: acc.won,
    drawn: acc.drawn,
    lost: acc.lost,
    pointsFor: acc.pointsFor,
    pointsAgainst: acc.pointsAgainst,
    pointsDiff,
    triesFor: hasTryStats ? acc.triesFor : null,
    triesAgainst: hasTryStats ? acc.triesAgainst : null,
    tryBonusPoints: hasTryStats && rules.tryBonusPoints > 0 ? acc.tryBonusPoints : null,
    losingBonusPoints: rules.losingBonusPoints > 0 ? acc.losingBonusPoints : null,
    bonusPoints: acc.bonusPoints,
    leaguePoints: Math.max(0, acc.leaguePoints - acc.deductionPoints),
    winPct: winPct(acc.won, acc.played),
    seasonsPlayed: acc.seasonYears.size,
    extra:
      acc.deductionPoints > 0
        ? { pointsDeducted: acc.deductionPoints }
        : undefined,
  };
}

export function sortAllTimePremiershipRows(
  rows: RugbyTableStandingRow[],
  sortBy: AllTimePremiershipSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    switch (sortBy) {
      case "seasons":
        return (b.seasonsPlayed ?? 0) - (a.seasonsPlayed ?? 0) || b.leaguePoints - a.leaguePoints;
      case "played":
        return b.played - a.played || b.leaguePoints - a.leaguePoints;
      case "won":
        return b.won - a.won || b.leaguePoints - a.leaguePoints;
      case "win_pct":
        return (b.winPct ?? 0) - (a.winPct ?? 0) || b.leaguePoints - a.leaguePoints;
      case "points_for":
        return b.pointsFor - a.pointsFor || b.leaguePoints - a.leaguePoints;
      case "tries_for":
        return (b.triesFor ?? 0) - (a.triesFor ?? 0) || b.leaguePoints - a.leaguePoints;
      case "team_name":
        return a.teamName.localeCompare(b.teamName);
      case "league_points":
      default:
        if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
        if (b.won !== a.won) return b.won - a.won;
        if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        if ((b.winPct ?? 0) !== (a.winPct ?? 0)) return (b.winPct ?? 0) - (a.winPct ?? 0);
        return a.teamName.localeCompare(b.teamName);
    }
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildAllTimePremiershipTable(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  seasonRangeMode: AllTimeSeasonRangeMode;
  seasonFromYear?: number | null;
  seasonToYear?: number | null;
  teamStatus: AllTimeTeamStatus;
  currentTeamCanonicalKeys: Set<string>;
  sortBy: AllTimePremiershipSortBy;
}): AllTimePremiershipBuildResult {
  const warnings: string[] = [];
  let scoped = filterPerspectivesBySeasonRange(input.perspectives, {
    mode: input.seasonRangeMode,
    fromYear: input.seasonFromYear,
    toYear: input.seasonToYear,
  });

  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const identities = scoped.map((row) =>
    resolvePremiershipCanonicalIdentity({
      teamId: row.teamId,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
    }),
  );
  warnings.push(...mergeIdentityWarnings(identities));

  const canonicalPerspectives = scoped.map((row, index) => {
    const identity = identities[index]!;
    return {
      ...row,
      teamId: identity.canonicalKey,
      teamName: identity.canonicalName,
    };
  });

  if (input.teamStatus === "current") {
    scoped = canonicalPerspectives.filter((row) => input.currentTeamCanonicalKeys.has(row.teamId));
  } else if (input.teamStatus === "former") {
    scoped = canonicalPerspectives.filter((row) => !input.currentTeamCanonicalKeys.has(row.teamId));
  } else {
    scoped = canonicalPerspectives;
  }

  const accumulators = new Map<string, AllTimeAccumulator>();
  let triesEligible = 0;
  let triesPresent = 0;
  let bonusEligible = 0;
  let bonusPresent = 0;

  for (const row of scoped) {
    const seasonYear = row.seasonStartYear;
    const rules =
      seasonYear != null ? scoringRulesForPremiershipSeason(seasonYear) : scoringRulesForPremiershipSeason(2001);
    const acc = accumulators.get(row.teamId) ?? createAllTimeAccumulator(row.teamId, row.teamName);
    addMatchToAccumulator(acc, row, rules);
    if (seasonYear != null) {
      acc.seasonYears.add(seasonYear);
      const deduction = deductionsForTeamSeason(row.teamId, seasonYear);
      if (deduction > 0) acc.deductionPoints += deduction;
    }
    triesEligible += 1;
    if (row.triesFor != null || row.triesAgainst != null) triesPresent += 1;

    if (rules.tryBonusPoints > 0 || rules.losingBonusPoints > 0) {
      bonusEligible += 1;
      const { tryBonusPoints, losingBonusPoints } = matchLeaguePoints(
        row.pointsFor,
        row.pointsAgainst,
        row.triesFor,
        rules,
      );
      if (tryBonusPoints > 0 || losingBonusPoints > 0) bonusPresent += 1;
    }

    accumulators.set(row.teamId, acc);
  }

  const seasonYears = [
    ...new Set(
      scoped
        .map((row) => row.seasonStartYear)
        .filter((year): year is number => year != null),
    ),
  ].sort((a, b) => a - b);

  const rows = sortAllTimePremiershipRows(
    [...accumulators.values()].map((acc, _, list) =>
      finalizeAllTimeRow(acc, 0),
    ),
    input.sortBy,
  );

  const seasonsIncludedLabel =
    seasonYears.length === 0
      ? "No seasons"
      : seasonYears.length === 1
        ? formatSeasonRangeLabel(seasonYears[0]!)
        : `${formatSeasonRangeLabel(seasonYears[0]!)} – ${formatSeasonRangeLabel(seasonYears[seasonYears.length - 1]!)}`;

  return {
    rows,
    warnings,
    coverage: {
      resultsCoveragePct: scoped.length > 0 ? 100 : 0,
      triesCoveragePct:
        triesEligible > 0 ? Math.round((triesPresent / triesEligible) * 1000) / 10 : 0,
      bonusCoveragePct:
        bonusEligible > 0 ? Math.round((bonusPresent / bonusEligible) * 1000) / 10 : 0,
    },
    seasonsIncludedLabel,
    seasonYears,
    teamCount: rows.length,
    matchCount: scoped.length,
    identityReviewCount: new Set(
      identities.filter((row) => row.uncertain).map((row) => row.canonicalKey),
    ).size,
    historicScoringNotice: historicScoringRuleNotice(seasonYears),
  };
}
