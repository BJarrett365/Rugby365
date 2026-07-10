import {
  addMetric,
  createStandingsAccumulator,
  finalizeStandingsRows,
  type StandingsAccumulator,
} from "./rugby-table-metrics-service";
import type { RugbyScoringRules, RugbyTableStandingRow, TeamFixturePerspective } from "./table-types";
import { perspectiveHasVerifiedTries } from "./table-stat-data-warnings";
import { uniqueFixtureCount } from "./scoring-first-table-service";

export function buildTryBonusPointStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
}): {
  rows: RugbyTableStandingRow[];
  seasonFixtureCount: number;
  qualifyingFixtureCount: number;
} {
  const seasonFixtureCount = uniqueFixtureCount(input.perspectives);
  const scoringPerspectives = input.perspectives.filter(perspectiveHasVerifiedTries);
  const qualifyingFixtureCount = uniqueFixtureCount(scoringPerspectives);

  const accMap = new Map<string, StandingsAccumulator>();
  for (const row of scoringPerspectives) {
    if (row.triesFor == null) continue;

    const acc = accMap.get(row.teamId) ?? createStandingsAccumulator(row.teamId, row.teamName);
    const earnedTryBonus = row.triesFor >= input.rules.tryBonusThreshold ? 1 : 0;
    addMetric(acc, earnedTryBonus);
    acc.played += 1;
    accMap.set(row.teamId, acc);
  }

  return {
    rows: finalizeStandingsRows(accMap, { sortByMetric: true }).map((row) => {
      const acc = accMap.get(row.teamId);
      const tryBonusMatches = acc?.metricTotal ?? 0;
      return {
        ...row,
        leaguePoints: tryBonusMatches,
        metricValue: tryBonusMatches,
      };
    }),
    seasonFixtureCount,
    qualifyingFixtureCount,
  };
}
