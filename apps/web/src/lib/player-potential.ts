/**
 * Potential ceiling — age-aware, not "current + arbitrary points".
 * Established internationals sit near current/peak ability.
 *
 * Value Score calculation lives in player-value-score-engine.ts (player-value-score-v1).
 * This module keeps potential + thin compatibility re-exports for trend/demand helpers.
 */

import {
  classifyOverallRating,
  resolveRatingPublicState,
} from "./player-rating-presentation";
import {
  classifyValueTrend,
  computePlayerValueScore,
  scoreMarketDemand,
  VALUE_SCORE_MODEL,
  VALUE_TREND_THRESHOLDS,
  type DemandClass,
  type ValueTrendClass,
} from "./player-value-score-engine";

export type PotentialResult = {
  potential: number | null;
  confidence: number;
  note: string;
};

export function computePlayerPotential(input: {
  overallRating: number | null;
  age: number | null;
  verifiedCaps: number | null;
  careerHigh: number | null;
}): PotentialResult {
  const ovr = input.overallRating;
  if (ovr == null || !Number.isFinite(ovr)) {
    return { potential: null, confidence: 0, note: "No overall rating" };
  }

  const age = input.age;
  const caps = input.verifiedCaps ?? 0;
  const peak = input.careerHigh != null ? Math.max(input.careerHigh, ovr) : ovr;

  // Peak age for fly-half / backs roughly 27–31; Pollard-class veterans near ceiling.
  if (age == null) {
    return {
      potential: Math.round(Math.min(99, ovr + 2) * 10) / 10,
      confidence: 40,
      note: "Age unknown — low confidence",
    };
  }

  if (age >= 30 || caps >= 50) {
    const pot = Math.round(Math.max(ovr, Math.min(peak + 1, ovr + 2)) * 10) / 10;
    return {
      potential: pot,
      confidence: 75,
      note: "Established senior — potential near current/peak ability",
    };
  }

  if (age <= 23) {
    const headroom = Math.max(4, 14 - (age - 18) * 1.5);
    return {
      potential: Math.round(Math.min(95, ovr + headroom) * 10) / 10,
      confidence: 55,
      note: "Youth development headroom",
    };
  }

  const headroom = Math.max(1, (30 - age) * 0.6);
  return {
    potential: Math.round(Math.min(92, ovr + headroom) * 10) / 10,
    confidence: 65,
    note: "Mid-career trajectory",
  };
}

/** User-facing Rugby365 classification from overall rating. */
export function rugby365RatingClassification(rating: number | null): {
  label: string;
  stars: number;
} {
  const state = resolveRatingPublicState({
    overall: rating,
    confidence: 100,
    coverage: 100,
    dataPoints: 99,
    modelVersion: null,
  });
  const c = classifyOverallRating(rating, state);
  return { label: c.label, stars: c.stars };
}

export {
  VALUE_SCORE_MODEL,
  VALUE_TREND_THRESHOLDS,
  classifyValueTrend,
  type ValueTrendClass,
  type DemandClass,
};

/**
 * Proxy market-demand classification — only returned when signals are strong enough.
 * Weak / incomplete inputs → null (UI shows "—").
 * @deprecated Prefer scoreMarketDemand / computePlayerValueScore from player-value-score-engine.
 */
export function classifyMarketDemand(input: {
  overallRating: number | null;
  verifiedCaps: number | null;
  competitionKey: string | null;
  positionScarcityStrong: boolean;
  confidence: number;
}): DemandClass {
  if (input.confidence < 40) return null;
  const scarcity = input.positionScarcityStrong ? 90 : null;
  const result = scoreMarketDemand({
    overallRating: input.overallRating,
    verifiedCaps: input.verifiedCaps,
    competitionKey: input.competitionKey,
    positionScarcityScore: scarcity,
  });
  // Preserve legacy labels without Very Low when score is weak-but-present.
  if (result.classification === "Very Low") return "Low";
  return result.classification;
}

/**
 * Compatibility wrapper around PlayerValueScoreEngine.
 * Prefer computePlayerValueScore for new call sites.
 */
export function computeValueScore(input: {
  overallRating: number | null;
  age: number | null;
  formScore: number | null;
  marketValueGbp: number | null;
  contractMonthsRemaining: number | null;
  verifiedCaps: number | null;
  valueOutlier: boolean;
  /** Recent value change % when history exists — null = unknown. */
  valueChangePct?: number | null;
  competitionKey?: string | null;
  positionName?: string | null;
}): {
  score: number | null;
  confidence: number;
  modelVersion: string;
  valueTrend: ValueTrendClass;
  marketDemand: DemandClass;
  transferInterest: DemandClass;
} {
  void input.age;
  void input.marketValueGbp;

  // Outliers suppress published Market Value trust — Value Score still uses coverage rules.
  // Keep transfer interest unknown (no evidence) so UI shows "—".
  const result = computePlayerValueScore({
    overallRating: input.overallRating,
    potential: null,
    valueChangePct90d: input.valueChangePct ?? null,
    formScore: input.formScore,
    contractMonthsRemaining: input.contractMonthsRemaining,
    verifiedCaps: input.verifiedCaps,
    competitionKey: input.competitionKey ?? null,
    positionName: input.positionName ?? null,
    availabilityScore: null,
    commercialScore: null,
    transferInterestEvidence: false,
  });

  // Legacy callers treated outliers as score=null; keep that for market-value path safety.
  if (input.valueOutlier) {
    return {
      score: null,
      confidence: Math.min(25, result.confidence),
      modelVersion: VALUE_SCORE_MODEL,
      valueTrend: result.valueTrend,
      marketDemand: null,
      transferInterest: null,
    };
  }

  return {
    score: result.valueScore,
    confidence: result.confidence,
    modelVersion: VALUE_SCORE_MODEL,
    valueTrend: result.valueTrend,
    marketDemand: result.marketDemand,
    transferInterest: result.transferInterest,
  };
}
