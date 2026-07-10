import type { RugbyScoringRules, RugbyTableStandingRow, TeamFixturePerspective } from "./table-types";
import { DEFAULT_PREMIERSHIP_SCORING_RULES as RULES } from "./table-types";

export type StandingsAccumulator = {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  triesAgainst: number;
  tryStatsMatches: number;
  tryBonusPoints: number;
  losingBonusPoints: number;
  bonusPoints: number;
  leaguePoints: number;
  metricTotal: number;
  metricCount: number;
  extra: Record<string, number>;
};

export function createStandingsAccumulator(teamId: string, teamName: string): StandingsAccumulator {
  return {
    teamId,
    teamName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    triesFor: 0,
    triesAgainst: 0,
    tryStatsMatches: 0,
    tryBonusPoints: 0,
    losingBonusPoints: 0,
    bonusPoints: 0,
    leaguePoints: 0,
    metricTotal: 0,
    metricCount: 0,
    extra: {},
  };
}

export function matchLeaguePoints(
  pointsFor: number,
  pointsAgainst: number,
  triesFor: number | null,
  rules: RugbyScoringRules = RULES,
): {
  leaguePoints: number;
  bonusPoints: number;
  tryBonusPoints: number;
  losingBonusPoints: number;
  result: "won" | "drawn" | "lost";
} {
  let result: "won" | "drawn" | "lost" = "lost";
  let basePoints = rules.lossPoints;
  if (pointsFor > pointsAgainst) {
    result = "won";
    basePoints = rules.winPoints;
  } else if (pointsFor === pointsAgainst) {
    result = "drawn";
    basePoints = rules.drawPoints;
  }

  let tryBonusPoints = 0;
  if (triesFor != null && triesFor >= rules.tryBonusThreshold) {
    tryBonusPoints = rules.tryBonusPoints;
  }
  let losingBonusPoints = 0;
  if (result === "lost" && pointsAgainst - pointsFor <= rules.losingBonusMargin) {
    losingBonusPoints = rules.losingBonusPoints;
  }
  const bonusPoints = tryBonusPoints + losingBonusPoints;

  return {
    leaguePoints: basePoints + bonusPoints,
    bonusPoints,
    tryBonusPoints,
    losingBonusPoints,
    result,
  };
}

export function addMatchToAccumulator(
  acc: StandingsAccumulator,
  row: TeamFixturePerspective,
  rules: RugbyScoringRules = RULES,
) {
  const { leaguePoints, bonusPoints, tryBonusPoints, losingBonusPoints, result } = matchLeaguePoints(
    row.pointsFor,
    row.pointsAgainst,
    row.triesFor,
    rules,
  );
  acc.played += 1;
  acc.pointsFor += row.pointsFor;
  acc.pointsAgainst += row.pointsAgainst;
  if (row.triesFor != null || row.triesAgainst != null) {
    acc.tryStatsMatches += 1;
  }
  acc.triesFor += row.triesFor ?? 0;
  acc.triesAgainst += row.triesAgainst ?? 0;
  acc.tryBonusPoints += tryBonusPoints;
  acc.losingBonusPoints += losingBonusPoints;
  acc.bonusPoints += bonusPoints;
  acc.leaguePoints += leaguePoints;
  if (result === "won") acc.won += 1;
  else if (result === "drawn") acc.drawn += 1;
  else acc.lost += 1;
}

export function addMetric(acc: StandingsAccumulator, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return;
  acc.metricTotal += value;
  acc.metricCount += 1;
}

export function averageMetric(acc: StandingsAccumulator): number | null {
  if (acc.metricCount === 0) return null;
  return Math.round((acc.metricTotal / acc.metricCount) * 100) / 100;
}

export function standingOptionalFieldsFromAccumulator(
  acc: StandingsAccumulator,
  scoringRules?: RugbyScoringRules | null,
): Pick<
  RugbyTableStandingRow,
  "triesFor" | "triesAgainst" | "tryBonusPoints" | "losingBonusPoints"
> {
  const hasTryStats = acc.tryStatsMatches > 0;
  const hasTryBonusRules =
    scoringRules != null &&
    scoringRules.tryBonusPoints > 0 &&
    scoringRules.tryBonusThreshold > 0;
  const hasLosingBonusRules =
    scoringRules != null && scoringRules.losingBonusPoints > 0;

  return {
    triesFor: hasTryStats ? acc.triesFor : null,
    triesAgainst: hasTryStats ? acc.triesAgainst : null,
    tryBonusPoints: hasTryStats && hasTryBonusRules ? acc.tryBonusPoints : null,
    losingBonusPoints:
      hasLosingBonusRules && acc.played > 0 ? acc.losingBonusPoints : null,
  };
}

export function finalizeStandingsRows(
  accumulators: Map<string, StandingsAccumulator>,
  options?: {
    metricLabel?: string;
    sortAscending?: boolean;
    sortByMetric?: boolean;
    sortLeagueTable?: boolean;
    scoringRules?: RugbyScoringRules | null;
  },
): RugbyTableStandingRow[] {
  const rows = [...accumulators.values()].map((acc) => {
    const pointsDiff = acc.pointsFor - acc.pointsAgainst;
    const metricValue = acc.metricCount > 0 ? averageMetric(acc) : null;
    const optionalFields = standingOptionalFieldsFromAccumulator(acc, options?.scoringRules);
    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.played,
      won: acc.won,
      drawn: acc.drawn,
      lost: acc.lost,
      pointsFor: acc.pointsFor,
      pointsAgainst: acc.pointsAgainst,
      pointsDiff,
      ...optionalFields,
      bonusPoints: acc.bonusPoints,
      leaguePoints: acc.leaguePoints,
      metricValue: options?.sortByMetric ? metricValue : undefined,
      extra: Object.fromEntries(
        Object.entries(acc.extra).map(([key, value]) => [key, value]),
      ),
    };
  });

  rows.sort((a, b) => {
    if (options?.sortByMetric) {
      const av = Number(a.metricValue ?? 0);
      const bv = Number(b.metricValue ?? 0);
      if (av !== bv) return options.sortAscending ? av - bv : bv - av;
    }
    if (options?.sortLeagueTable) {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
      if (b.won !== a.won) return b.won - a.won;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      const aTries = a.triesFor ?? 0;
      const bTries = b.triesFor ?? 0;
      if (bTries !== aTries) return bTries - aTries;
      return a.teamName.localeCompare(b.teamName);
    }
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return b.pointsFor - a.pointsFor;
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildLeagueStandingsFromPerspectives(
  perspectives: TeamFixturePerspective[],
  rules: RugbyScoringRules = RULES,
): RugbyTableStandingRow[] {
  const accumulators = new Map<string, StandingsAccumulator>();
  for (const row of perspectives) {
    const acc = accumulators.get(row.teamId) ?? createStandingsAccumulator(row.teamId, row.teamName);
    addMatchToAccumulator(acc, row, rules);
    accumulators.set(row.teamId, acc);
  }
  return finalizeStandingsRows(accumulators, { sortLeagueTable: true, scoringRules: rules });
}

export function filterPerspectives(
  perspectives: TeamFixturePerspective[],
  predicate: (row: TeamFixturePerspective) => boolean,
) {
  return perspectives.filter(predicate);
}

export function filterBySide(perspectives: TeamFixturePerspective[], side: "home" | "away") {
  return perspectives.filter((row) => row.side === side);
}

export function filterByKickoffRange(
  perspectives: TeamFixturePerspective[],
  from?: Date,
  to?: Date,
) {
  return perspectives.filter((row) => {
    if (!row.kickoffAt) return false;
    if (from && row.kickoffAt < from) return false;
    if (to && row.kickoffAt > to) return false;
    return true;
  });
}

export function filterByCalendarYear(perspectives: TeamFixturePerspective[], year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return filterByKickoffRange(perspectives, from, to);
}

export function recentFormPerspectives(
  perspectives: TeamFixturePerspective[],
  matchCount = 5,
): TeamFixturePerspective[] {
  const byTeam = new Map<string, TeamFixturePerspective[]>();
  for (const row of perspectives) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push(row);
    byTeam.set(row.teamId, list);
  }

  const out: TeamFixturePerspective[] = [];
  for (const rows of byTeam.values()) {
    const sorted = [...rows].sort((a, b) => {
      const at = a.kickoffAt?.getTime() ?? 0;
      const bt = b.kickoffAt?.getTime() ?? 0;
      return bt - at;
    });
    out.push(...sorted.slice(0, matchCount));
  }
  return out;
}

export function sectionNumber(
  sections: Record<string, Record<string, number>> | undefined,
  section: string,
  key: string,
): number | null {
  const value = sections?.[section]?.[key];
  return value == null || !Number.isFinite(value) ? null : value;
}

export function lineoutSuccessPct(won: number | null, lost: number | null): number | null {
  if (won == null || lost == null) return null;
  const total = won + lost;
  if (total <= 0) return null;
  return Math.round((won / total) * 1000) / 10;
}

export function ratioPct(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildMetricStandings(
  perspectives: TeamFixturePerspective[],
  metricFor: (row: TeamFixturePerspective) => number | null,
  options?: { sortAscending?: boolean },
): RugbyTableStandingRow[] {
  const accumulators = new Map<string, StandingsAccumulator>();
  for (const row of perspectives) {
    const acc =
      accumulators.get(row.teamId) ?? createStandingsAccumulator(row.teamId, row.teamName);
    addMetric(acc, metricFor(row));
    acc.played += 1;
    accumulators.set(row.teamId, acc);
  }

  return finalizeStandingsRows(accumulators, {
    sortByMetric: true,
    sortAscending: options?.sortAscending,
  });
}

export type { RugbyScoringRules };
export { RULES as DEFAULT_PREMIERSHIP_SCORING_RULES };
