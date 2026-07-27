/** Compute and shape match try / losing bonus points from scores + tries + rules. */

import type { RugbyScoringRules } from "./table-lab/table-types";
import { DEFAULT_PREMIERSHIP_SCORING_RULES } from "./table-lab/table-types";
import { matchLeaguePoints } from "./table-lab/rugby-table-metrics-service";

export type MatchBonusPoints = {
  homeTryBonusPoints: number;
  awayTryBonusPoints: number;
  homeLosingBonusPoints: number;
  awayLosingBonusPoints: number;
  /** Aggregate tiles for Match Details (matches PR-style Try / Losing summary). */
  tryBonusTotal: number;
  losingBonusTotal: number;
  homeTries: number | null;
  awayTries: number | null;
  rules: {
    tryBonusThreshold: number;
    losingBonusMargin: number;
  };
};

export function computeMatchBonusPoints(input: {
  homeScore: number;
  awayScore: number;
  homeTries: number | null;
  awayTries: number | null;
  rules?: RugbyScoringRules;
}): MatchBonusPoints {
  const rules = input.rules ?? DEFAULT_PREMIERSHIP_SCORING_RULES;
  const home = matchLeaguePoints(input.homeScore, input.awayScore, input.homeTries, rules);
  const away = matchLeaguePoints(input.awayScore, input.homeScore, input.awayTries, rules);

  return {
    homeTryBonusPoints: home.tryBonusPoints,
    awayTryBonusPoints: away.tryBonusPoints,
    homeLosingBonusPoints: home.losingBonusPoints,
    awayLosingBonusPoints: away.losingBonusPoints,
    tryBonusTotal: home.tryBonusPoints + away.tryBonusPoints,
    losingBonusTotal: home.losingBonusPoints + away.losingBonusPoints,
    homeTries: input.homeTries,
    awayTries: input.awayTries,
    rules: {
      tryBonusThreshold: rules.tryBonusThreshold,
      losingBonusMargin: rules.losingBonusMargin,
    },
  };
}
