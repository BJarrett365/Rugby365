import { DEFAULT_PREMIERSHIP_SCORING_RULES, type RugbyScoringRules } from "./table-types";

export type PremiershipPointsDeduction = {
  canonicalKey: string;
  seasonStartYear: number;
  points: number;
  reason: string;
  /** ISO date (YYYY-MM-DD). Deduction counts from this date for historic tables. */
  effectiveFrom?: string;
  /** When true, deduction applies for the whole season regardless of as-of date. */
  retrospective?: boolean;
};

/** Official Premiership points deductions — extend as editors confirm historic rows. */
export const PREMIERSHIP_POINTS_DEDUCTIONS: PremiershipPointsDeduction[] = [
  {
    canonicalKey: "saracens",
    seasonStartYear: 2019,
    points: 105,
    reason: "Salary cap breach (2019–20 season)",
    effectiveFrom: "2019-11-05",
  },
];

export function scoringRulesForPremiershipSeason(seasonStartYear: number): RugbyScoringRules {
  if (seasonStartYear < 1997) {
    return {
      winPoints: 2,
      drawPoints: 1,
      lossPoints: 0,
      tryBonusThreshold: 99,
      tryBonusPoints: 0,
      losingBonusMargin: 7,
      losingBonusPoints: 0,
    };
  }
  if (seasonStartYear < 2001) {
    return {
      winPoints: 4,
      drawPoints: 2,
      lossPoints: 0,
      tryBonusThreshold: 99,
      tryBonusPoints: 0,
      losingBonusMargin: 7,
      losingBonusPoints: 0,
    };
  }
  return DEFAULT_PREMIERSHIP_SCORING_RULES;
}

export function deductionsForTeamSeason(canonicalKey: string, seasonStartYear: number): number {
  return deductionsForTeamSeasonAsOf(canonicalKey, seasonStartYear, new Date("9999-12-31")).points;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 23, 59, 59, 999));
}

export function deductionsForTeamSeasonAsOf(
  canonicalKey: string,
  seasonStartYear: number,
  asOf: Date,
): { points: number; reasons: string[]; hasUnknownEffectiveDates: boolean } {
  let hasUnknownEffectiveDates = false;
  const matching = PREMIERSHIP_POINTS_DEDUCTIONS.filter(
    (row) => row.canonicalKey === canonicalKey && row.seasonStartYear === seasonStartYear,
  );

  let points = 0;
  const reasons: string[] = [];

  for (const row of matching) {
    if (row.retrospective) {
      points += row.points;
      reasons.push(row.reason);
      continue;
    }
    if (!row.effectiveFrom) {
      hasUnknownEffectiveDates = true;
      points += row.points;
      reasons.push(row.reason);
      continue;
    }
    if (parseDateOnly(row.effectiveFrom) <= asOf) {
      points += row.points;
      reasons.push(row.reason);
    }
  }

  return { points, reasons, hasUnknownEffectiveDates };
}

export function historicScoringRuleNotice(seasonYears: number[]): string {
  const min = seasonYears.length ? Math.min(...seasonYears) : null;
  const max = seasonYears.length ? Math.max(...seasonYears) : null;
  if (min == null || max == null) {
    return "Historic Premiership scoring rules are applied per season when building this table.";
  }
  const parts: string[] = [];
  if (min < 1997) parts.push("pre-1997: 2 points for a win");
  if (seasonYears.some((year) => year >= 1997 && year < 2001)) {
    parts.push("1997–2000: 4 points for a win, no bonus points");
  }
  if (max >= 2001) parts.push("2001 onwards: current bonus-point rules");
  return `Scoring varies by season (${parts.join("; ")}). Deductions are applied where configured.`;
}
