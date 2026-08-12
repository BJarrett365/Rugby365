/**
 * Rugby365 Coach Rating Engine (coach-rating-v1)
 *
 * Broader overall coach quality — separate from Power Index (current strength).
 * Power Index is an INPUT (40%), not a duplicate calculation.
 */

import type { CoachIntelligenceMetric } from "./coach-intelligence-engine";
import type { CoachEligibleMatch } from "./coach-career-record-service";
import type { CoachImpactResult } from "./coach-career-record-service";

export const COACH_RATING_VERSION = "coach-rating-v1";

/** Central Coach Rating weights (sum = 100). */
export const COACH_RATING_WEIGHTS_V1: Record<string, number> = {
  power_index: 40,
  career_results: 15,
  big_match_performance: 10,
  team_improvement: 10,
  player_development: 8,
  experience: 7,
  career_consistency: 5,
  major_honours: 5,
};

export const WORLD_RANK_MIN_MATCHES = 10;
export const WORLD_RANK_MIN_COVERAGE = 60;
export const WORLD_RANK_MIN_CONFIDENCE = 55;

const MIN_WEIGHTED_COVERAGE = 50;

export type CoachRatingContribution = {
  key: string;
  label: string;
  score: number;
  weight: number;
  nominalWeight: number;
  contribution: number;
  source: string;
};

export type CoachRatingResult = {
  score: number | null;
  contributions: CoachRatingContribution[];
  confidence: number;
  confidenceBand: "HIGH" | "GOOD" | "PARTIAL" | "INSUFFICIENT";
  dataCoverage: number;
  weightedCoverage: number;
  matchesUsed: number;
  reweighted: boolean;
  excludedKeys: string[];
  modelVersion: string;
  calculatedAt: string;
  publishable: boolean;
  eligibleForWorldRank: boolean;
  componentScores: {
    powerIndex: number | null;
    careerResults: number | null;
    bigMatchPerformance: number | null;
    teamImprovement: number | null;
    playerDevelopment: number | null;
    experience: number | null;
    careerConsistency: number | null;
    majorHonours: number | null;
  };
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const LABELS: Record<string, string> = {
  power_index: "Power Index",
  career_results: "Career Results",
  big_match_performance: "Big Match Performance",
  team_improvement: "Team Improvement",
  player_development: "Player Development",
  experience: "Experience",
  career_consistency: "Career Consistency",
  major_honours: "Major Honours",
};

/** Map career win rate to 0–100 (already roughly %). */
export function scoreCareerResults(winRateExact: number | null): number | null {
  if (winRateExact == null) return null;
  return round1(clamp(winRateExact));
}

/**
 * Team improvement from before/under appointment impact.
 * Win-rate swing maps around 50 at no change.
 */
export function scoreTeamImprovement(impact: CoachImpactResult | null): number | null {
  if (!impact?.enoughData) return null;
  const wr = impact.rows.find((r) => r.metric === "Win Rate" || r.metric.toLowerCase().includes("win"));
  const change =
    typeof wr?.change === "number"
      ? wr.change
      : wr?.change != null && !Number.isNaN(Number(wr.change))
        ? Number(wr.change)
        : null;
  if (change == null) {
    // Fallback: points for / against deltas
    const pf = impact.rows.find((r) => r.metric.startsWith("Points /"));
    const pa = impact.rows.find((r) => r.metric.startsWith("Points Against"));
    const pfCh = typeof pf?.change === "number" ? pf.change : null;
    const paCh = typeof pa?.change === "number" ? pa.change : null;
    if (pfCh == null && paCh == null) return null;
    const blended = (pfCh ?? 0) * 1.5 - (paCh ?? 0) * 1.5;
    return round1(clamp(50 + blended));
  }
  return round1(clamp(50 + change * 1.8));
}

/**
 * Consistency from rolling win-rate stability across career halves / form.
 * High = stable performance; low = boom/bust.
 */
export function scoreCareerConsistency(matches: CoachEligibleMatch[]): number | null {
  if (matches.length < 8) return null;
  const chrono = [...matches].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );
  const mid = Math.floor(chrono.length / 2);
  const first = chrono.slice(0, mid);
  const second = chrono.slice(mid);
  const wr = (ms: CoachEligibleMatch[]) =>
    ms.length ? (ms.filter((m) => m.result === "W").length / ms.length) * 100 : null;
  const a = wr(first);
  const b = wr(second);
  if (a == null || b == null) return null;
  const swing = Math.abs(a - b);
  // 0 swing → ~92; 40pt swing → ~52
  const stability = clamp(92 - swing * 1.0);

  // Penalise wild recent form variance (last 12)
  const recent = chrono.slice(-12);
  const windows: number[] = [];
  for (let i = 0; i + 4 <= recent.length; i += 2) {
    const chunk = recent.slice(i, i + 4);
    windows.push((chunk.filter((m) => m.result === "W").length / chunk.length) * 100);
  }
  if (windows.length >= 2) {
    const mean = windows.reduce((s, v) => s + v, 0) / windows.length;
    const variance =
      windows.reduce((s, v) => s + (v - mean) ** 2, 0) / windows.length;
    const std = Math.sqrt(variance);
    return round1(clamp(stability - std * 0.35));
  }
  return round1(stability);
}

export type HonourLike = {
  honourLevel?: string | null;
  achievementType?: string | null;
  roleType?: string | null;
  year?: number | null;
};

/**
 * Major honours score — helpful but capped so legacy trophies cannot dominate.
 * Recent winners get a mild boost; very old-only tallies stay moderate.
 */
export function scoreMajorHonours(honours: HonourLike[]): number | null {
  const coachHonours = honours.filter((h) => (h.roleType ?? "coach") === "coach");
  if (!coachHonours.length) return 0;

  let points = 0;
  let recentBonus = 0;
  const thisYear = new Date().getFullYear();
  for (const h of coachHonours) {
    const winner = (h.achievementType ?? "winner") === "winner" || h.achievementType === "champion";
    if (!winner) {
      points += h.honourLevel === "major" ? 4 : 1;
      continue;
    }
    if (h.honourLevel === "major") points += 22;
    else if (h.honourLevel === "domestic_major") points += 12;
    else if (h.honourLevel === "series") points += 6;
    else points += 3;

    if (h.year != null && thisYear - h.year <= 4) recentBonus += 4;
    else if (h.year != null && thisYear - h.year <= 8) recentBonus += 2;
  }

  return round1(clamp(points + recentBonus, 0, 100));
}

function intelScore(
  intelligence: CoachIntelligenceMetric[],
  key: string,
): number | null {
  return intelligence.find((m) => m.key === key)?.score ?? null;
}

/**
 * Compute Rugby365 Coach Rating from Power Index + longer-term signals.
 */
export function computeCoachRating(input: {
  powerIndex: number | null;
  intelligence: CoachIntelligenceMetric[];
  careerWinRate: number | null;
  matches: CoachEligibleMatch[];
  impact: CoachImpactResult | null;
  honours: HonourLike[];
  matchesUsed?: number;
  ratingConfidencePct?: number;
}): CoachRatingResult {
  const calculatedAt = new Date().toISOString();
  const matchesUsed = input.matchesUsed ?? input.matches.length;

  const componentScores = {
    powerIndex: input.powerIndex,
    careerResults: scoreCareerResults(input.careerWinRate),
    bigMatchPerformance: intelScore(input.intelligence, "big_match_performance"),
    teamImprovement: scoreTeamImprovement(input.impact),
    playerDevelopment: intelScore(input.intelligence, "player_development"),
    experience: intelScore(input.intelligence, "experience"),
    careerConsistency: scoreCareerConsistency(input.matches),
    majorHonours: scoreMajorHonours(input.honours),
  };

  const scoreByKey: Record<string, number | null> = {
    power_index: componentScores.powerIndex,
    career_results: componentScores.careerResults,
    big_match_performance: componentScores.bigMatchPerformance,
    team_improvement: componentScores.teamImprovement,
    player_development: componentScores.playerDevelopment,
    experience: componentScores.experience,
    career_consistency: componentScores.careerConsistency,
    major_honours: componentScores.majorHonours,
  };

  const sourceByKey: Record<string, string> = {
    power_index: "CoachPowerIndexEngine",
    career_results: "Career record",
    big_match_performance: "CoachIntelligenceEngine",
    team_improvement: "Coach impact (before/under)",
    player_development: "CoachIntelligenceEngine",
    experience: "CoachIntelligenceEngine",
    career_consistency: "Career form stability",
    major_honours: "Coach honours",
  };

  const available: Array<{ key: string; score: number; nominalWeight: number }> = [];
  const excludedKeys: string[] = [];
  let nominalAvailable = 0;
  let nominalTotal = 0;

  for (const [key, weight] of Object.entries(COACH_RATING_WEIGHTS_V1)) {
    nominalTotal += weight;
    const score = scoreByKey[key];
    if (score != null) {
      available.push({ key, score, nominalWeight: weight });
      nominalAvailable += weight;
    } else {
      excludedKeys.push(key);
    }
  }

  const weightedCoverage = nominalTotal > 0 ? (100 * nominalAvailable) / nominalTotal : 0;
  const reweighted = excludedKeys.length > 0 && available.length > 0;
  const weightSum = available.reduce((s, a) => s + a.nominalWeight, 0);

  const contributions: CoachRatingContribution[] = available.map((a) => {
    const effective = weightSum > 0 ? (a.nominalWeight / weightSum) * 100 : 0;
    return {
      key: a.key,
      label: LABELS[a.key] ?? a.key,
      score: a.score,
      weight: round1(effective),
      nominalWeight: a.nominalWeight,
      contribution: round2((a.score * effective) / 100),
      source: sourceByKey[a.key] ?? "model",
    };
  });

  const publishable = weightedCoverage >= MIN_WEIGHTED_COVERAGE && contributions.length > 0;
  const score = publishable
    ? round1(clamp(contributions.reduce((s, c) => s + c.contribution, 0)))
    : null;

  const intelCov =
    input.intelligence.length > 0
      ? input.intelligence.reduce((s, m) => s + m.dataCoverage, 0) / input.intelligence.length
      : 0;
  const dataCoverage = round1(intelCov);
  const sampleFactor = clamp((matchesUsed / 20) * 100);
  const confBase = input.ratingConfidencePct ?? dataCoverage;
  const confidence = Math.round(
    clamp(weightedCoverage * 0.4 + confBase * 0.4 + sampleFactor * 0.2),
  );

  let confidenceBand: CoachRatingResult["confidenceBand"] = "INSUFFICIENT";
  if (weightedCoverage >= 90 && confidence >= 80) confidenceBand = "HIGH";
  else if (weightedCoverage >= 75) confidenceBand = "GOOD";
  else if (weightedCoverage >= 50) confidenceBand = "PARTIAL";

  const eligibleForWorldRank =
    score != null &&
    matchesUsed >= WORLD_RANK_MIN_MATCHES &&
    weightedCoverage >= WORLD_RANK_MIN_COVERAGE &&
    confidence >= WORLD_RANK_MIN_CONFIDENCE;

  return {
    score,
    contributions,
    confidence,
    confidenceBand,
    dataCoverage,
    weightedCoverage: round1(weightedCoverage),
    matchesUsed,
    reweighted,
    excludedKeys,
    modelVersion: COACH_RATING_VERSION,
    calculatedAt,
    publishable,
    eligibleForWorldRank,
    componentScores,
  };
}
