/**
 * PlayerFormEngine — form score 0–10 from recent eligible appearances.
 * Team W/D/L is context only — never the sole basis of form.
 *
 * Component weights (renormalised when inputs missing):
 *   ratings 45%, position perf 25%, minutes 10%, opponent 10%, result 5%, consistency 5%
 * Recency buckets (newest → oldest): 50 / 30 / 20
 */

import { bandLabel, performanceBandFor } from "./match-rating-math";
import {
  buildRecentFormMetricDisplays,
  type RecentFormMetricDisplay,
  type RecentFormMetricTotals,
} from "./player-form-metric-config";

export const PLAYER_FORM_MODEL = "player-form-v1";

export const PLAYER_FORM_WEIGHTS = {
  ratings: 0.45,
  positionPerf: 0.25,
  minutes: 0.1,
  opponent: 0.1,
  result: 0.05,
  consistency: 0.05,
} as const;

/** Newest third / middle / oldest third of the sample. */
export const PLAYER_FORM_RECENCY = [0.5, 0.3, 0.2] as const;

export type PlayerFormMatchInput = {
  matchRating: number | null; // 0–10
  minutes: number | null;
  points: number | null;
  result: "W" | "D" | "L" | null;
  /** Optional 0–10 opponent strength; missing → weight excluded. */
  opponentStrength?: number | null;
  /** Optional 0–10 position-specific performance; derived from stats when null. */
  positionPerf?: number | null;
  conversions?: number | null;
  penalties?: number | null;
  /** Successful goal kicks when known separately from attempts. */
  goalKicksMade?: number | null;
  goalKickAttempts?: number | null;
  tryAssists?: number | null;
  kicks?: number | null;
  lineBreaks?: number | null;
  tries?: number | null;
  tackles?: number | null;
  metres?: number | null;
  carries?: number | null;
  turnovers?: number | null;
  defendersBeaten?: number | null;
};

export type PlayerFormComponentScore = {
  key: keyof typeof PLAYER_FORM_WEIGHTS;
  label: string;
  score: number | null; // 0–10
  weight: number;
  contribution: number | null;
};

export type PlayerFormResult = {
  formScore: number | null; // 0–10
  formLabel: string | null;
  confidence: number; // 0–100
  matchesUsed: number;
  appearancesEligible: number;
  avgMatchRating: number | null;
  /** @deprecated Prefer metricDisplays — kept for callers. */
  avgPoints: number | null;
  goalKickAttempts: number | null;
  goalKicksMade: number | null;
  goalKickPoints: number | null;
  tryAssists: number | null;
  kicks: number | null;
  lineBreaks: number | null;
  resultStrip: Array<"W" | "D" | "L">;
  components: PlayerFormComponentScore[];
  metricTotals: RecentFormMetricTotals;
  metricDisplays: RecentFormMetricDisplay[];
  modelVersion: string;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function avgNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Recency weight for index i in a sample of length n (0 = newest). */
export function recencyWeightForIndex(index: number, n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return PLAYER_FORM_RECENCY[0];
  const third = Math.max(1, Math.ceil(n / 3));
  if (index < third) return PLAYER_FORM_RECENCY[0];
  if (index < third * 2) return PLAYER_FORM_RECENCY[1];
  return PLAYER_FORM_RECENCY[2];
}

function normalizeMatchRating(r: number): number {
  // Accept accidental 0–100 stamps.
  if (r > 10) return clamp(r / 10, 0, 10);
  return clamp(r, 0, 10);
}

function minutesScore(minutes: number | null): number | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return clamp((minutes / 80) * 10, 0, 10);
}

function resultScore(result: "W" | "D" | "L" | null): number | null {
  if (result === "W") return 8;
  if (result === "D") return 5;
  if (result === "L") return 3;
  return null;
}

function derivePositionPerf(m: PlayerFormMatchInput): number | null {
  if (m.positionPerf != null && Number.isFinite(m.positionPerf)) {
    return clamp(m.positionPerf, 0, 10);
  }
  // Soft proxy from available contribution stats (never invent when empty).
  const signals: number[] = [];
  if (m.points != null && m.points > 0) signals.push(clamp(4 + m.points * 0.35, 0, 10));
  if (m.tryAssists != null && m.tryAssists > 0) signals.push(clamp(5 + m.tryAssists * 1.5, 0, 10));
  if (m.lineBreaks != null && m.lineBreaks > 0) signals.push(clamp(5 + m.lineBreaks * 1.2, 0, 10));
  if (m.kicks != null && m.kicks > 0) signals.push(clamp(4 + Math.min(m.kicks, 20) * 0.2, 0, 10));
  if (m.tackles != null && m.tackles > 0) signals.push(clamp(4 + m.tackles * 0.25, 0, 10));
  if (m.tries != null && m.tries > 0) signals.push(clamp(6 + m.tries * 1.5, 0, 10));
  if (!signals.length) return null;
  return clamp(signals.reduce((a, b) => a + b, 0) / signals.length, 0, 10);
}

function weightedMean(
  items: Array<{ score: number; weight: number }>,
): number | null {
  let sw = 0;
  let ss = 0;
  for (const it of items) {
    if (!Number.isFinite(it.score) || !Number.isFinite(it.weight) || it.weight <= 0) continue;
    ss += it.score * it.weight;
    sw += it.weight;
  }
  if (sw <= 0) return null;
  return ss / sw;
}

function consistencyScore(ratings: number[]): number | null {
  if (ratings.length < 2) return ratings.length === 1 ? 6 : null;
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance =
    ratings.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ratings.length;
  const std = Math.sqrt(variance);
  // Low stdev → high consistency. std 0 → 10; std ≥ 2 → ~3.
  return clamp(10 - std * 3.5, 2, 10);
}

export function formLabelForScore(score: number | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  const band = performanceBandFor(score);
  const label = bandLabel(band);
  // Design uses title case "Very Good".
  return label
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function emptyResult(
  resultStrip: Array<"W" | "D" | "L">,
  appearancesEligible: number,
  positionName: string | null | undefined,
): PlayerFormResult {
  const metricTotals: RecentFormMetricTotals = {
    points: null,
    goalKickMade: null,
    goalKickAttempts: null,
    tryAssists: null,
    kicks: null,
    lineBreaks: null,
    tries: null,
    tackles: null,
    metres: null,
    carries: null,
    turnovers: null,
    defendersBeaten: null,
    avgMatchRating: null,
  };
  return {
    formScore: null,
    formLabel: null,
    confidence: 0,
    matchesUsed: 0,
    appearancesEligible,
    avgMatchRating: null,
    avgPoints: null,
    goalKickAttempts: null,
    goalKicksMade: null,
    goalKickPoints: null,
    tryAssists: null,
    kicks: null,
    lineBreaks: null,
    resultStrip,
    components: [],
    metricTotals,
    metricDisplays: buildRecentFormMetricDisplays(positionName, metricTotals),
    modelVersion: PLAYER_FORM_MODEL,
  };
}

export function computePlayerFormScore(
  matches: PlayerFormMatchInput[],
  options: { limit?: number; positionName?: string | null } = {},
): PlayerFormResult {
  const limit = options.limit ?? 10;
  const recent = matches.slice(0, limit);
  const appearancesEligible = recent.length;

  const resultStrip = recent
    .map((m) => m.result)
    .filter((r): r is "W" | "D" | "L" => r === "W" || r === "D" || r === "L");

  // Eligible for scoring: must have a match rating. W/L alone never produces a score.
  const scored = recent
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => m.matchRating != null && Number.isFinite(m.matchRating));

  if (scored.length === 0) {
    // Still aggregate display metrics when present (honest nulls when absent).
    const totals = aggregateTotals(recent);
    const base = emptyResult(resultStrip, appearancesEligible, options.positionName);
    return {
      ...base,
      metricTotals: totals,
      metricDisplays: buildRecentFormMetricDisplays(options.positionName, totals),
      avgPoints: totals.points,
      goalKickAttempts: totals.goalKickAttempts,
      goalKicksMade: totals.goalKickMade,
      tryAssists: totals.tryAssists,
      kicks: totals.kicks,
      lineBreaks: totals.lineBreaks,
      avgMatchRating: totals.avgMatchRating,
    };
  }

  const ratingItems: Array<{ score: number; weight: number }> = [];
  const posItems: Array<{ score: number; weight: number }> = [];
  const minItems: Array<{ score: number; weight: number }> = [];
  const oppItems: Array<{ score: number; weight: number }> = [];
  const resItems: Array<{ score: number; weight: number }> = [];
  const ratingValues: number[] = [];

  for (const { m, idx } of scored) {
    const w = recencyWeightForIndex(idx, scored.length);
    const rating = normalizeMatchRating(m.matchRating!);
    ratingValues.push(rating);
    ratingItems.push({ score: rating, weight: w });

    const pos = derivePositionPerf(m);
    if (pos != null) posItems.push({ score: pos, weight: w });

    const mins = minutesScore(m.minutes);
    if (mins != null) minItems.push({ score: mins, weight: w });

    if (m.opponentStrength != null && Number.isFinite(m.opponentStrength)) {
      oppItems.push({ score: clamp(m.opponentStrength, 0, 10), weight: w });
    }

    const res = resultScore(m.result);
    if (res != null) resItems.push({ score: res, weight: w });
  }

  const componentRaw: Array<{
    key: keyof typeof PLAYER_FORM_WEIGHTS;
    label: string;
    score: number | null;
    nominal: number;
  }> = [
    {
      key: "ratings",
      label: "Match Ratings",
      score: weightedMean(ratingItems),
      nominal: PLAYER_FORM_WEIGHTS.ratings,
    },
    {
      key: "positionPerf",
      label: "Position Performance",
      score: weightedMean(posItems),
      nominal: PLAYER_FORM_WEIGHTS.positionPerf,
    },
    {
      key: "minutes",
      label: "Minutes",
      score: weightedMean(minItems),
      nominal: PLAYER_FORM_WEIGHTS.minutes,
    },
    {
      key: "opponent",
      label: "Opponent Strength",
      score: weightedMean(oppItems),
      nominal: PLAYER_FORM_WEIGHTS.opponent,
    },
    {
      key: "result",
      label: "Team Result",
      score: weightedMean(resItems),
      nominal: PLAYER_FORM_WEIGHTS.result,
    },
    {
      key: "consistency",
      label: "Consistency",
      score: consistencyScore(ratingValues),
      nominal: PLAYER_FORM_WEIGHTS.consistency,
    },
  ];

  const available = componentRaw.filter((c) => c.score != null);
  const nominalSum = available.reduce((a, c) => a + c.nominal, 0);
  const components: PlayerFormComponentScore[] = componentRaw.map((c) => {
    const weight =
      c.score != null && nominalSum > 0 ? c.nominal / nominalSum : 0;
    const contribution =
      c.score != null && weight > 0 ? round1(c.score * weight) : null;
    return {
      key: c.key,
      label: c.label,
      score: c.score != null ? round1(c.score) : null,
      weight: Math.round(weight * 1000) / 1000,
      contribution,
    };
  });

  let formScore: number | null = null;
  if (available.length && nominalSum > 0) {
    // Ratings are required — already guaranteed by scored.length.
    let sum = 0;
    for (const c of available) {
      sum += (c.score as number) * (c.nominal / nominalSum);
    }
    formScore = round1(clamp(sum, 0, 10));
  }

  const totals = aggregateTotals(recent);
  const confidence = clamp(30 + scored.length * 7 + (available.length >= 4 ? 8 : 0), 30, 95);

  return {
    formScore,
    formLabel: formLabelForScore(formScore),
    confidence,
    matchesUsed: scored.length,
    appearancesEligible,
    avgMatchRating: totals.avgMatchRating,
    avgPoints: totals.points,
    goalKickAttempts: totals.goalKickAttempts,
    goalKicksMade: totals.goalKickMade,
    goalKickPoints:
      totals.goalKickMade != null
        ? // Approximate points from boots when we only know made counts without split.
          null
        : null,
    tryAssists: totals.tryAssists,
    kicks: totals.kicks,
    lineBreaks: totals.lineBreaks,
    resultStrip,
    components,
    metricTotals: totals,
    metricDisplays: buildRecentFormMetricDisplays(options.positionName, totals),
    modelVersion: PLAYER_FORM_MODEL,
  };
}

function aggregateTotals(matches: PlayerFormMatchInput[]): RecentFormMetricTotals {
  const points = sumNullable(matches.map((m) => m.points));
  const tryAssists = sumNullable(matches.map((m) => m.tryAssists));
  const kicks = sumNullable(matches.map((m) => m.kicks));
  const lineBreaks = sumNullable(matches.map((m) => m.lineBreaks));
  const tries = sumNullable(matches.map((m) => m.tries));
  const tackles = sumNullable(matches.map((m) => m.tackles));
  const metres = sumNullable(matches.map((m) => m.metres));
  const carries = sumNullable(matches.map((m) => m.carries));
  const turnovers = sumNullable(matches.map((m) => m.turnovers));
  const defendersBeaten = sumNullable(matches.map((m) => m.defendersBeaten));

  let goalKickMade: number | null = null;
  let goalKickAttempts: number | null = null;
  let hasAttemptData = false;
  let madeSum = 0;
  let attemptSum = 0;

  for (const m of matches) {
    const made =
      m.goalKicksMade != null
        ? m.goalKicksMade
        : m.conversions != null || m.penalties != null
          ? (m.conversions ?? 0) + (m.penalties ?? 0)
          : null;
    const attempts = m.goalKickAttempts != null ? m.goalKickAttempts : null;
    if (made != null) {
      madeSum += made;
      goalKickMade = madeSum;
    }
    if (attempts != null && attempts > 0) {
      hasAttemptData = true;
      attemptSum += attempts;
    }
  }
  if (hasAttemptData) goalKickAttempts = attemptSum;
  // Without attempts, do not pretend made==attempts (would always show 100%).
  if (!hasAttemptData) {
    goalKickAttempts = null;
    // Still show made only via goal kicks display as — (needs both).
  }

  const avgMatchRating = avgNullable(
    matches.map((m) => (m.matchRating != null ? normalizeMatchRating(m.matchRating) : null)),
  );

  return {
    points,
    goalKickMade,
    goalKickAttempts,
    tryAssists,
    kicks,
    lineBreaks,
    tries,
    tackles,
    metres,
    carries,
    turnovers,
    defendersBeaten,
    avgMatchRating: avgMatchRating != null ? round1(avgMatchRating) : null,
  };
}
