/**
 * CoachPowerIndexEngine (coach-power-v1)
 *
 * Headline 0–100 score derived ONLY from CoachIntelligenceEngine metrics.
 * Never independently recalculates Attack/Defence/etc.
 */

import type {
  CoachIntelligenceMetric,
  CoachMetricKey,
} from "./coach-intelligence-engine";

export const COACH_POWER_VERSION = "coach-power-v1";

/**
 * Weighted headline inputs (sum = 100). Central source of truth.
 * Heavy on Results, Current Form, Attack, Defence, Opponent Strength,
 * Selection, Game Management — current strength, not career fame.
 *
 * opponent_strength is taken from Results Intelligence components
 * (not independently recalculated).
 */
export const POWER_INDEX_WEIGHTS_V1: Record<string, number> = {
  results: 18,
  opponent_strength: 10,
  attack: 10,
  defence: 10,
  current_form: 14,
  selection: 8,
  game_management: 8,
  set_piece: 6,
  breakdown: 5,
  kicking: 4,
  discipline: 3,
  player_development: 2,
  experience: 2,
};

/** Display order for public Power Index card (design columns). */
export const POWER_INDEX_DISPLAY_LEFT: CoachMetricKey[] = [
  "results",
  "attack",
  "defence",
  "set_piece",
  "breakdown",
  "kicking",
];

export const POWER_INDEX_DISPLAY_RIGHT: CoachMetricKey[] = [
  "discipline",
  "selection",
  "game_management",
  "player_development",
  "experience",
  "current_form",
];

/** Game Management is a weighted input — modifiers must not double-count it. */
const MODIFIER_CAPS = {
  big_match_performance: 1.5,
  bench_depth: 0.75,
  total: 3,
} as const;

const MIN_WEIGHTED_COVERAGE = 60;

export type PowerIndexContribution = {
  key: string;
  label: string;
  score: number;
  /** Effective weight after renormalisation (0–100). */
  weight: number;
  /** Nominal weight from model before renormalisation. */
  nominalWeight: number;
  contribution: number;
  confidence: number;
  trend: number | null;
};

export type PowerIndexModifier = {
  key: string;
  label: string;
  sourceScore: number | null;
  effect: number;
  cap: number;
};

export type PowerIndexMismatch = {
  key: string;
  intelligenceScore: number;
  powerIndexScore: number;
};

export type CoachPowerIndexResult = {
  score: number | null;
  baseScore: number | null;
  modifierTotal: number;
  contributions: PowerIndexContribution[];
  modifiers: PowerIndexModifier[];
  /** Scores shown on the public card — MUST equal Intelligence scores. */
  displayScores: Record<string, number | null>;
  mismatches: PowerIndexMismatch[];
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
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function metricMap(intelligence: CoachIntelligenceMetric[]): Map<string, CoachIntelligenceMetric> {
  return new Map(intelligence.map((m) => [m.key, m]));
}

function modifierFromScore(score: number | null, cap: number): number {
  if (score == null) return 0;
  // Map 0–100 → −cap…+cap around 70 neutral
  const delta = (score - 70) / 30; // ~−2.3…+1 at extremes
  return clamp(delta * cap, -cap, cap);
}

/**
 * Build Power Index from Coach Intelligence metrics.
 * Missing weighted metrics are excluded and weights renormalised.
 */
export function computeCoachPowerIndex(
  intelligence: CoachIntelligenceMetric[],
  options: { matchesUsed?: number } = {},
): CoachPowerIndexResult {
  const byKey = metricMap(intelligence);
  const calculatedAt = new Date().toISOString();

  const displayScores: Record<string, number | null> = {};
  for (const m of intelligence) {
    displayScores[m.key] = m.score;
  }
  displayScores.opponent_strength =
    typeof byKey.get("results")?.components?.opponent_strength === "number"
      ? (byKey.get("results")!.components.opponent_strength as number)
      : null;

  const available: Array<{
    key: string;
    label: string;
    score: number;
    nominalWeight: number;
    confidence: number;
    trend: number | null;
  }> = [];
  const excludedKeys: string[] = [];

  /** Opponent strength from Results Intelligence components — single source. */
  const resultsMetric = byKey.get("results");
  const opponentStrengthScore =
    typeof resultsMetric?.components?.opponent_strength === "number"
      ? resultsMetric.components.opponent_strength
      : null;

  let nominalAvailable = 0;
  let nominalTotal = 0;
  for (const [key, weight] of Object.entries(POWER_INDEX_WEIGHTS_V1)) {
    nominalTotal += weight;
    if (key === "opponent_strength") {
      if (opponentStrengthScore != null) {
        available.push({
          key,
          label: "Opponent Strength",
          score: opponentStrengthScore,
          nominalWeight: weight,
          confidence: resultsMetric?.confidence ?? 70,
          trend: resultsMetric?.trend ?? null,
        });
        nominalAvailable += weight;
      } else {
        excludedKeys.push(key);
      }
      continue;
    }
    const m = byKey.get(key);
    if (m?.score != null) {
      available.push({
        key,
        label: m.label,
        score: m.score,
        nominalWeight: weight,
        confidence: m.confidence,
        trend: m.trend,
      });
      nominalAvailable += weight;
    } else {
      excludedKeys.push(key);
    }
  }

  const weightedCoverage = nominalTotal > 0 ? (100 * nominalAvailable) / nominalTotal : 0;
  const reweighted = excludedKeys.length > 0 && available.length > 0;

  const weightSum = available.reduce((s, a) => s + a.nominalWeight, 0);
  const contributions: PowerIndexContribution[] = available.map((a) => {
    const effective = weightSum > 0 ? (a.nominalWeight / weightSum) * 100 : 0;
    return {
      key: a.key,
      label: a.label,
      score: a.score,
      weight: round1(effective),
      nominalWeight: a.nominalWeight,
      contribution: round2((a.score * effective) / 100),
      confidence: a.confidence,
      trend: a.trend,
    };
  });

  const baseScore =
    contributions.length > 0
      ? round1(contributions.reduce((s, c) => s + c.contribution, 0))
      : null;

  // Consistency: shared Intelligence metrics must equal PI inputs 1:1
  const mismatches: PowerIndexMismatch[] = [];
  for (const c of contributions) {
    if (c.key === "opponent_strength") {
      if (
        opponentStrengthScore != null &&
        Math.abs(opponentStrengthScore - c.score) > 0.05
      ) {
        mismatches.push({
          key: c.key,
          intelligenceScore: opponentStrengthScore,
          powerIndexScore: c.score,
        });
      }
      continue;
    }
    const intel = byKey.get(c.key);
    if (intel?.score != null && Math.abs(intel.score - c.score) > 0.05) {
      mismatches.push({
        key: c.key,
        intelligenceScore: intel.score,
        powerIndexScore: c.score,
      });
    }
  }

  const big = byKey.get("big_match_performance");
  const bench = byKey.get("bench_impact");
  const depth = byKey.get("squad_depth");
  const benchDepthScore =
    bench?.score != null && depth?.score != null
      ? (bench.score + depth.score) / 2
      : bench?.score ?? depth?.score ?? null;

  const modifiers: PowerIndexModifier[] = [
    {
      key: "big_match_performance",
      label: "Big Match Performance",
      sourceScore: big?.score ?? null,
      effect: round2(modifierFromScore(big?.score ?? null, MODIFIER_CAPS.big_match_performance)),
      cap: MODIFIER_CAPS.big_match_performance,
    },
    {
      key: "bench_depth",
      label: "Bench / Squad Depth",
      sourceScore: benchDepthScore,
      effect: round2(modifierFromScore(benchDepthScore, MODIFIER_CAPS.bench_depth)),
      cap: MODIFIER_CAPS.bench_depth,
    },
  ];

  let modifierTotal = modifiers.reduce((s, m) => s + m.effect, 0);
  modifierTotal = clamp(modifierTotal, -MODIFIER_CAPS.total, MODIFIER_CAPS.total);
  modifierTotal = round2(modifierTotal);

  const publishable = weightedCoverage >= MIN_WEIGHTED_COVERAGE && baseScore != null;
  const score =
    publishable && baseScore != null
      ? round1(clamp(baseScore + modifierTotal, 0, 100))
      : null;

  // Coverage / confidence blend
  const metricConfAvg =
    contributions.length > 0
      ? contributions.reduce((s, c) => s + c.confidence, 0) / contributions.length
      : 0;
  const sample = options.matchesUsed ?? Math.max(...intelligence.map((m) => m.sampleSize), 0);
  const sampleFactor = clamp((sample / 20) * 100, 0, 100);
  const confidence = Math.round(
    clamp(weightedCoverage * 0.45 + metricConfAvg * 0.4 + sampleFactor * 0.15, 0, 100),
  );

  let confidenceBand: CoachPowerIndexResult["confidenceBand"] = "INSUFFICIENT";
  if (weightedCoverage >= 90) confidenceBand = "HIGH";
  else if (weightedCoverage >= 75) confidenceBand = "GOOD";
  else if (weightedCoverage >= 60) confidenceBand = "PARTIAL";

  const dataCoverage =
    intelligence.length > 0
      ? Math.round(
          intelligence.reduce((s, m) => s + m.dataCoverage, 0) / intelligence.length,
        )
      : 0;

  return {
    score,
    baseScore,
    modifierTotal,
    contributions,
    modifiers,
    displayScores,
    mismatches,
    confidence,
    confidenceBand,
    dataCoverage,
    weightedCoverage: round1(weightedCoverage),
    matchesUsed: sample,
    reweighted,
    excludedKeys,
    modelVersion: COACH_POWER_VERSION,
    calculatedAt,
    publishable,
  };
}

/** Validate Power Index display scores match Intelligence 1:1. */
export function assertIntelligencePowerIndexConsistency(
  intelligence: CoachIntelligenceMetric[],
  power: CoachPowerIndexResult,
): PowerIndexMismatch[] {
  const mismatches: PowerIndexMismatch[] = [...power.mismatches];
  for (const m of intelligence) {
    if (!(m.key in power.displayScores)) continue;
    const shown = power.displayScores[m.key];
    if (m.score != null && shown != null && Math.abs(m.score - shown) > 0.05) {
      mismatches.push({
        key: m.key,
        intelligenceScore: m.score,
        powerIndexScore: shown,
      });
    }
  }
  return mismatches;
}
