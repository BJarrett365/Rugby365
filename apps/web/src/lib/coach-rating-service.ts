/**
 * Coach Rating + Power Index engines (coach-rating-v1 / coach-power-v1).
 * Intelligence metrics come from CoachIntelligenceEngine (coach-intelligence-v1).
 */

import { and, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import {
  coachHonours,
  coachImages,
  coachMatchRatings,
  coachRatingHistory,
  coachRatingSnapshots,
  coaches,
  teamCoachingStaff,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  computeCareerRecord,
  getCoachImpact,
  loadCoachEligibleMatches,
  type CoachEligibleMatch,
} from "./coach-career-record-service";
import {
  applyMetricWorldRanks,
  calculateCoachIntelligence,
  intelligenceToLegacyMetrics,
  COACH_INTELLIGENCE_METRICS,
  COACH_INTELLIGENCE_VERSION,
  type CoachIntelligenceMetric,
  type CoachMetricKey,
  type CoachMetricScore,
} from "./coach-intelligence-engine";
import {
  assertIntelligencePowerIndexConsistency,
  computeCoachPowerIndex,
  COACH_POWER_VERSION,
  POWER_INDEX_WEIGHTS_V1,
  type CoachPowerIndexResult,
} from "./coach-power-index-engine";
import {
  computeCoachRating,
  COACH_RATING_VERSION,
  COACH_RATING_WEIGHTS_V1,
  WORLD_RANK_MIN_CONFIDENCE,
  WORLD_RANK_MIN_COVERAGE,
  WORLD_RANK_MIN_MATCHES,
  type CoachRatingResult,
} from "./coach-rating-engine";
import { getCompetitionCoachRank } from "./coach-competition-rank";

export { COACH_RATING_VERSION };
export { COACH_POWER_VERSION };
export const MIN_MATCHES_FOR_RANK = WORLD_RANK_MIN_MATCHES;

export {
  COACH_INTELLIGENCE_METRICS,
  COACH_INTELLIGENCE_VERSION,
  type CoachIntelligenceMetric,
  type CoachMetricKey,
  type CoachMetricScore,
  type CoachPowerIndexResult,
  type CoachRatingResult,
  COACH_RATING_WEIGHTS_V1,
};

export type CoachPowerWeights = Record<string, number>;

/** @deprecated Use POWER_INDEX_WEIGHTS_V1 from coach-power-index-engine (canonical). */
export const POWER_INDEX_WEIGHTS: CoachPowerWeights = { ...POWER_INDEX_WEIGHTS_V1 };

export {
  POWER_INDEX_WEIGHTS_V1,
  POWER_INDEX_DISPLAY_LEFT,
  POWER_INDEX_DISPLAY_RIGHT,
  computeCoachPowerIndex,
  assertIntelligencePowerIndexConsistency,
} from "./coach-power-index-engine";

export {
  computeCoachRating,
  WORLD_RANK_MIN_MATCHES,
  WORLD_RANK_MIN_COVERAGE,
  WORLD_RANK_MIN_CONFIDENCE,
} from "./coach-rating-engine";

const LABELS: Record<CoachMetricKey, string> = {
  results: "Results",
  attack: "Attack",
  defence: "Defence",
  set_piece: "Set Piece",
  breakdown: "Breakdown",
  kicking: "Kicking",
  discipline: "Discipline",
  selection: "Selection",
  game_management: "Game Management",
  bench_impact: "Bench Impact",
  player_development: "Player Development",
  squad_depth: "Squad Depth",
  big_match_performance: "Big Match Performance",
  experience: "Experience",
  current_form: "Current Form",
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function scoreBandColor(score: number | null): string {
  if (score == null) return "muted";
  if (score >= 90) return "elite";
  if (score >= 80) return "strong";
  if (score >= 70) return "amber";
  if (score >= 60) return "orange";
  return "red";
}

export { scoreBandColor, LABELS };

/** @deprecated Prefer calculateCoachIntelligence — kept for tests/simple fallbacks. */
export function computeCoachMetrics(matches: CoachEligibleMatch[]): CoachMetricScore[] {
  const record = computeCareerRecord(matches);
  const recent = matches.slice(-8);
  const recentWr = recent.length
    ? (recent.filter((m) => m.result === "W").length / recent.length) * 100
    : null;
  const last = matches.slice(-20);
  let weightSum = 0;
  let scoreSum = 0;
  last.forEach((m, i) => {
    const age = last.length - 1 - i;
    const w = age < 5 ? 3 : age < 10 ? 2 : 1;
    weightSum += w;
    scoreSum += m.result === "W" ? w : m.result === "D" ? w * 0.35 : 0;
  });
  const weighted = weightSum > 0 ? (scoreSum / weightSum) * 100 : null;
  const pf = record.pointsForPerGame;
  const pa = record.pointsAgainstPerGame;
  const results =
    weighted != null ? clamp(50 + (weighted - 50) * 0.9) : record.winRate != null ? clamp(record.winRate) : null;
  const attack = pf != null ? clamp(40 + pf * 1.8) : null;
  const defence = pa != null ? clamp(100 - pa * 2.2) : null;
  const currentForm = recentWr != null ? clamp(recentWr) : null;
  const experience = clamp(Math.min(95, 40 + Math.log10(Math.max(1, record.played)) * 28));
  const close = matches.filter((m) => Math.abs(m.margin) <= 7);
  const closeWr = close.length
    ? (close.filter((m) => m.result === "W").length / close.length) * 100
    : null;
  const gameMgmt = closeWr != null ? clamp(closeWr) : results;
  const mk = (
    key: CoachMetricKey,
    score: number | null,
    raw: Record<string, number | string | null> = {},
  ): CoachMetricScore => ({
    key,
    label: LABELS[key],
    score: score != null ? Math.round(score * 10) / 10 : null,
    worldRank: null,
    raw,
  });
  return [
    mk("results", results, { winRate: record.winRateExact, played: record.played }),
    mk("attack", attack, { pointsPerGame: pf }),
    mk("defence", defence, { pointsAgainstPerGame: pa }),
    mk("set_piece", null, { note: "Use calculateCoachIntelligence" }),
    mk("breakdown", null),
    mk("kicking", null),
    mk("discipline", null),
    mk("selection", null),
    mk("game_management", gameMgmt, { closeMatches: close.length }),
    mk("bench_impact", null),
    mk("player_development", null),
    mk("squad_depth", null),
    mk("big_match_performance", results),
    mk("experience", experience, { matches: record.played }),
    mk("current_form", currentForm, { last8: recent.map((m) => m.result).join("") }),
  ];
}

/**
 * Legacy adapter: builds Power Index from metric scores.
 * Prefer `computeCoachPowerIndex(intelligence)` — single source of truth.
 */
export function computePowerIndex(metrics: CoachMetricScore[]): {
  score: number | null;
  contributions: Array<{ key: string; weight: number; score: number; contribution: number }>;
  reweighted: boolean;
  detail: CoachPowerIndexResult;
} {
  const minimal: CoachIntelligenceMetric[] = metrics.map((m) => ({
    key: m.key as CoachMetricKey,
    label: m.label,
    score: m.score,
    worldRank: m.worldRank,
    raw: m.raw ?? {},
    confidence: 80,
    dataCoverage: m.score != null ? 100 : 0,
    sampleSize: 12,
    status: m.score != null ? "PARTIAL" : "INSUFFICIENT",
    trend: null,
    period: "adapter",
    components: {},
    availableInputs: m.score != null ? ["legacy_metric"] : [],
    missingInputs: m.score != null ? [] : ["legacy_metric"],
    modelVersion: COACH_INTELLIGENCE_VERSION,
    calculatedAt: new Date().toISOString(),
  }));
  const detail = computeCoachPowerIndex(minimal);
  return {
    score: detail.score,
    contributions: detail.contributions.map((c) => ({
      key: c.key,
      weight: c.weight,
      score: c.score,
      contribution: c.contribution,
    })),
    reweighted: detail.reweighted,
    detail,
  };
}

/**
 * Legacy overall blend — prefer computeCoachRating (coach-rating-v1).
 * Kept for unit tests / adapters.
 */
export function computeOverallRating(
  metrics: CoachMetricScore[],
  powerIndex: number | null,
  careerWinRate: number | null,
): number | null {
  const result = computeCoachRating({
    powerIndex,
    intelligence: metrics.map((m) => ({
      key: m.key as CoachMetricKey,
      label: m.label,
      score: m.score,
      worldRank: m.worldRank,
      raw: m.raw ?? {},
      confidence: 80,
      dataCoverage: m.score != null ? 100 : 0,
      sampleSize: 12,
      status: m.score != null ? "PARTIAL" : "INSUFFICIENT",
      trend: null,
      period: "adapter",
      components: {},
      availableInputs: m.score != null ? ["legacy"] : [],
      missingInputs: m.score != null ? [] : ["legacy"],
      modelVersion: COACH_INTELLIGENCE_VERSION,
      calculatedAt: new Date().toISOString(),
    })),
    careerWinRate,
    matches: [],
    impact: null,
    honours: [],
  });
  return result.score;
}

export type CoachRatingBundle = {
  overallRating: number | null;
  previousOverallRating: number | null;
  overallRatingChange: number | null;
  /** Full Coach Rating engine output. */
  coachRatingDetail: CoachRatingResult | null;
  powerIndex: number | null;
  previousPowerIndex: number | null;
  powerIndexChange: number | null;
  /** Full Power Index engine output (weights, modifiers, coverage). */
  powerIndexDetail: CoachPowerIndexResult | null;
  /** INTELLIGENCE SCORE MISMATCH flags when PI ≠ Intelligence. */
  powerIndexMismatches: Array<{
    key: string;
    intelligenceScore: number;
    powerIndexScore: number;
  }>;
  worldRank: number | null;
  previousWorldRank: number | null;
  worldRankChange: number | null;
  rankedOutOf: number | null;
  /** Competition-scoped rank (e.g. Currie Cup Premier 2026). */
  competitionRank: number | null;
  competitionRankedOutOf: number | null;
  competitionRankLabel: string | null;
  competitionRankSub: string | null;
  /** Momentum from Power Index movement (previous snapshot → current). */
  momentum: number | null;
  metrics: CoachMetricScore[];
  /** Full Coach Intelligence engine output (confidence, coverage, components). */
  intelligence: CoachIntelligenceMetric[];
  intelligenceModelVersion: string;
  powerContributions: Array<{ key: string; weight: number; score: number; contribution: number }>;
  modelVersion: string;
  powerIndexVersion: string;
  dataConfidence: "high" | "medium" | "low" | "none";
  /** 0–100 from match / team-stat / player-rating / ranking coverage. */
  ratingConfidencePct: number;
  ratingConfidenceInputs: {
    matchCoverage: number;
    teamStatCoverage: number;
    playerRatingCoverage: number;
    historicalRankingCoverage: number;
  };
  matchCount: number;
  provisional: boolean;
};

export function emptyCoachRatingBundle(): CoachRatingBundle {
  return {
    overallRating: null,
    previousOverallRating: null,
    overallRatingChange: null,
    coachRatingDetail: null,
    powerIndex: null,
    previousPowerIndex: null,
    powerIndexChange: null,
    powerIndexDetail: null,
    powerIndexMismatches: [],
    worldRank: null,
    previousWorldRank: null,
    worldRankChange: null,
    rankedOutOf: null,
    competitionRank: null,
    competitionRankedOutOf: null,
    competitionRankLabel: null,
    competitionRankSub: null,
    momentum: null,
    metrics: [],
    intelligence: [],
    intelligenceModelVersion: "",
    powerContributions: [],
    modelVersion: "",
    powerIndexVersion: "",
    dataConfidence: "none",
    ratingConfidencePct: 0,
    ratingConfidenceInputs: {
      matchCoverage: 0,
      teamStatCoverage: 0,
      playerRatingCoverage: 0,
      historicalRankingCoverage: 0,
    },
    matchCount: 0,
    provisional: true,
  };
}

function metricsToIntelligence(metrics: CoachMetricScore[]): CoachIntelligenceMetric[] {
  const now = new Date().toISOString();
  return metrics.map((m) => ({
    ...m,
    confidence: m.score != null ? 72 : 0,
    sampleSize: Number(m.raw?.played ?? m.raw?.matches ?? 12) || 12,
    dataCoverage: m.score != null ? 65 : 0,
    period: "public-lite",
    calculatedAt: now,
    modelVersion: COACH_INTELLIGENCE_VERSION,
    trend: null,
    components: {},
    availableInputs: m.score != null ? ["career_record"] : [],
    missingInputs: m.score != null ? ["team_stats"] : ["career_record", "team_stats"],
    status: m.score != null ? "PARTIAL" : "INSUFFICIENT",
  }));
}

/** Fast public-page ratings when no snapshot exists — no peer scan, no Wikipedia. */
export function buildCoachRatingBundleFromMatches(
  matches: CoachEligibleMatch[],
): CoachRatingBundle {
  if (matches.length === 0) return emptyCoachRatingBundle();
  const record = computeCareerRecord(matches);
  const metrics = computeCoachMetrics(matches);
  const intelligence = metricsToIntelligence(metrics);
  const power = computePowerIndex(metrics);
  const coachRatingDetail = computeCoachRating({
    powerIndex: power.score,
    intelligence,
    careerWinRate: record.winRateExact,
    matches,
    impact: null,
    honours: [],
    matchesUsed: matches.length,
  });
  const coverage = Math.min(100, Math.round((matches.length / 20) * 100));
  let dataConfidence: CoachRatingBundle["dataConfidence"] = "none";
  if (matches.length >= 20) dataConfidence = "high";
  else if (matches.length >= 10) dataConfidence = "medium";
  else if (matches.length > 0) dataConfidence = "low";
  return {
    overallRating: coachRatingDetail.score,
    previousOverallRating: null,
    overallRatingChange: null,
    coachRatingDetail,
    powerIndex: power.score,
    previousPowerIndex: null,
    powerIndexChange: null,
    powerIndexDetail: power.detail,
    powerIndexMismatches: [],
    worldRank: null,
    previousWorldRank: null,
    worldRankChange: null,
    rankedOutOf: null,
    competitionRank: null,
    competitionRankedOutOf: null,
    competitionRankLabel: null,
    competitionRankSub: null,
    momentum: null,
    metrics,
    intelligence,
    intelligenceModelVersion: COACH_INTELLIGENCE_VERSION,
    powerContributions: power.contributions,
    modelVersion: COACH_RATING_VERSION,
    powerIndexVersion: COACH_POWER_VERSION,
    dataConfidence,
    ratingConfidencePct: coverage,
    ratingConfidenceInputs: {
      matchCoverage: coverage,
      teamStatCoverage: 0,
      playerRatingCoverage: 0,
      historicalRankingCoverage: 0,
    },
    matchCount: matches.length,
    provisional: !coachRatingDetail.eligibleForWorldRank,
  };
}

export function displayCoachTeamName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const t = name.trim();
  if (/^unknown(\s+team)?(\s+[0-9a-f-]*)?$/i.test(t)) return null;
  if (/unknown team/i.test(t)) return null;
  return t;
}

function asDataConfidence(value: string | null | undefined): CoachRatingBundle["dataConfidence"] {
  if (value === "high" || value === "medium" || value === "low" || value === "none") return value;
  return "none";
}

type StoredCoachRatingPayload = {
  metrics?: CoachMetricScore[];
  intelligence?: CoachIntelligenceMetric[];
  intelligenceModelVersion?: string;
  contributions?: CoachRatingBundle["powerContributions"];
  powerIndex?: CoachPowerIndexResult;
  previousPowerIndex?: number | null;
  powerIndexChange?: number | null;
  powerIndexMismatches?: CoachRatingBundle["powerIndexMismatches"];
  coachRating?: CoachRatingResult;
  previousOverallRating?: number | null;
  overallRatingChange?: number | null;
  previousWorldRank?: number | null;
  worldRankChange?: number | null;
  competitionRank?: number | null;
  competitionRankedOutOf?: number | null;
  competitionRankLabel?: string | null;
  competitionRankSub?: string | null;
  ratingConfidencePct?: number;
  ratingConfidenceInputs?: CoachRatingBundle["ratingConfidenceInputs"];
};

export function coachRatingBundleFromSnapshot(row: {
  overallRating: number | null;
  powerIndex: number | null;
  worldRank: number | null;
  momentum: number | null;
  metrics: unknown;
  modelVersion: string | null;
  powerIndexVersion: string | null;
  dataConfidence: string | null;
}): CoachRatingBundle {
  const payload = (row.metrics ?? {}) as StoredCoachRatingPayload;
  const coachRating = payload.coachRating ?? null;
  const intelligence = payload.intelligence ?? [];
  const metrics = payload.metrics ?? [];
  return {
    overallRating: row.overallRating,
    previousOverallRating: payload.previousOverallRating ?? null,
    overallRatingChange: payload.overallRatingChange ?? null,
    coachRatingDetail: coachRating,
    powerIndex: row.powerIndex,
    previousPowerIndex: payload.previousPowerIndex ?? null,
    powerIndexChange: payload.powerIndexChange ?? null,
    powerIndexDetail: payload.powerIndex ?? null,
    powerIndexMismatches: payload.powerIndexMismatches ?? [],
    worldRank: row.worldRank,
    previousWorldRank: payload.previousWorldRank ?? null,
    worldRankChange: payload.worldRankChange ?? null,
    rankedOutOf: null,
    competitionRank: payload.competitionRank ?? null,
    competitionRankedOutOf: payload.competitionRankedOutOf ?? null,
    competitionRankLabel: payload.competitionRankLabel ?? null,
    competitionRankSub: payload.competitionRankSub ?? null,
    momentum: row.momentum,
    metrics,
    intelligence,
    intelligenceModelVersion: payload.intelligenceModelVersion ?? "",
    powerContributions: payload.contributions ?? [],
    modelVersion: row.modelVersion ?? "",
    powerIndexVersion: row.powerIndexVersion ?? "",
    dataConfidence: asDataConfidence(row.dataConfidence),
    ratingConfidencePct: payload.ratingConfidencePct ?? 0,
    ratingConfidenceInputs: payload.ratingConfidenceInputs ?? {
      matchCoverage: 0,
      teamStatCoverage: 0,
      playerRatingCoverage: 0,
      historicalRankingCoverage: 0,
    },
    matchCount: coachRating?.matchesUsed ?? 0,
    provisional: coachRating ? !coachRating.eligibleForWorldRank : true,
  };
}

/** Public pages must not recalc the full rating engine on every request (Netlify timeout). */
export async function readLatestCoachRatingBundle(
  coachId: string,
): Promise<CoachRatingBundle | null> {
  const db = getDb();
  const [row] = await db
    .select({
      overallRating: coachRatingSnapshots.overallRating,
      powerIndex: coachRatingSnapshots.powerIndex,
      worldRank: coachRatingSnapshots.worldRank,
      momentum: coachRatingSnapshots.momentum,
      metrics: coachRatingSnapshots.metrics,
      modelVersion: coachRatingSnapshots.modelVersion,
      powerIndexVersion: coachRatingSnapshots.powerIndexVersion,
      dataConfidence: coachRatingSnapshots.dataConfidence,
    })
    .from(coachRatingSnapshots)
    .where(eq(coachRatingSnapshots.coachId, coachId))
    .orderBy(desc(coachRatingSnapshots.calculatedAt))
    .limit(1);
  if (!row) return null;
  return coachRatingBundleFromSnapshot(row);
}

export async function calculateCoachRatingBundle(
  coachId: string,
  options: { asOfDate?: Date | null } = {},
): Promise<CoachRatingBundle> {
  const matches = await loadCoachEligibleMatches(coachId, {
    primaryOnly: true,
    asOfDate: options.asOfDate ?? null,
  });
  const record = computeCareerRecord(matches);

  const intelligenceBundle = await calculateCoachIntelligence(coachId, {
    asOfDate: options.asOfDate ?? null,
  });

  const db = getDb();
  const peerSnapshots = await db
    .select({
      coachId: coachRatingSnapshots.coachId,
      overallRating: coachRatingSnapshots.overallRating,
      metrics: coachRatingSnapshots.metrics,
    })
    .from(coachRatingSnapshots)
    .orderBy(desc(coachRatingSnapshots.calculatedAt))
    .limit(800);

  const peerMetricScores: Array<{
    coachId: string;
    metrics: Array<{ key: string; score: number | null; confidence?: number; sampleSize?: number }>;
  }> = [];
  const seenPeers = new Set<string>();
  for (const row of peerSnapshots) {
    if (seenPeers.has(row.coachId)) continue;
    seenPeers.add(row.coachId);
    const payload = row.metrics as {
      intelligence?: CoachIntelligenceMetric[];
      metrics?: CoachMetricScore[];
    } | null;
    const list = payload?.intelligence ?? payload?.metrics ?? [];
    peerMetricScores.push({
      coachId: row.coachId,
      metrics: list.map((m) => ({
        key: m.key,
        score: m.score,
        confidence: "confidence" in m ? (m as CoachIntelligenceMetric).confidence : 80,
        sampleSize: "sampleSize" in m ? (m as CoachIntelligenceMetric).sampleSize : 20,
      })),
    });
  }

  const intelligence = applyMetricWorldRanks(
    intelligenceBundle.metrics,
    peerMetricScores,
    coachId,
  );
  const metrics = intelligenceToLegacyMetrics(intelligence);
  const powerDetail = computeCoachPowerIndex(intelligence, {
    matchesUsed: intelligenceBundle.matchesUsed,
  });
  const powerMismatches = assertIntelligencePowerIndexConsistency(intelligence, powerDetail);
  const power = {
    score: powerDetail.score,
    contributions: powerDetail.contributions.map((c) => ({
      key: c.key,
      weight: c.weight,
      score: c.score,
      contribution: c.contribution,
    })),
    reweighted: powerDetail.reweighted,
  };

  const { getCoachDataCoverage, computeRatingConfidencePct } = await import("./coach-recalc-service");
  const coverage = await getCoachDataCoverage(coachId).catch(() => null);
  const ratingConfidenceInputs = coverage?.ratingConfidenceInputs ?? {
    matchCoverage: matches.length > 0 ? 100 : 0,
    teamStatCoverage: 0,
    playerRatingCoverage: 0,
    historicalRankingCoverage: 0,
  };
  const ratingConfidencePct =
    coverage?.ratingConfidencePct ?? computeRatingConfidencePct(ratingConfidenceInputs);

  const [impact, honourRows] = await Promise.all([
    getCoachImpact(coachId).catch(() => null),
    db
      .select({
        honourLevel: coachHonours.honourLevel,
        achievementType: coachHonours.achievementType,
        roleType: coachHonours.roleType,
        year: coachHonours.year,
      })
      .from(coachHonours)
      .where(eq(coachHonours.coachId, coachId))
      .limit(200),
  ]);

  const coachRatingDetail = computeCoachRating({
    powerIndex: power.score,
    intelligence,
    careerWinRate: record.winRateExact,
    matches,
    impact,
    honours: honourRows,
    matchesUsed: matches.length,
    ratingConfidencePct,
  });
  const overall = coachRatingDetail.score;
  const provisional = !coachRatingDetail.eligibleForWorldRank;

  let dataConfidence: CoachRatingBundle["dataConfidence"] = "none";
  if (ratingConfidencePct >= 80 && matches.length >= 20) dataConfidence = "high";
  else if (ratingConfidencePct >= 55 && matches.length >= 10) dataConfidence = "medium";
  else if (matches.length > 0) dataConfidence = "low";

  /** World Rank from Rugby365 Coach Rating — eligible peers only. */
  const eligiblePeers: Array<{ coachId: string; rating: number }> = [];
  const seenEligible = new Set<string>();
  for (const row of peerSnapshots) {
    if (row.overallRating == null || seenEligible.has(row.coachId)) continue;
    const payload = row.metrics as { coachRating?: CoachRatingResult } | null;
    const peerEligible =
      payload?.coachRating?.eligibleForWorldRank === true ||
      payload?.coachRating == null; // legacy snapshots
    if (!peerEligible) continue;
    seenEligible.add(row.coachId);
    eligiblePeers.push({ coachId: row.coachId, rating: row.overallRating });
  }
  if (overall != null && coachRatingDetail.eligibleForWorldRank) {
    const existing = eligiblePeers.find((p) => p.coachId === coachId);
    if (existing) existing.rating = overall;
    else eligiblePeers.push({ coachId, rating: overall });
  }

  const ranked = eligiblePeers.sort((a, b) => b.rating - a.rating);
  const idx = ranked.findIndex((p) => p.coachId === coachId);
  const worldRank =
    coachRatingDetail.eligibleForWorldRank && overall != null && idx >= 0 ? idx + 1 : null;

  const priorSnaps = await db
    .select({
      powerIndex: coachRatingSnapshots.powerIndex,
      overallRating: coachRatingSnapshots.overallRating,
      worldRank: coachRatingSnapshots.worldRank,
      calculatedAt: coachRatingSnapshots.calculatedAt,
    })
    .from(coachRatingSnapshots)
    .where(eq(coachRatingSnapshots.coachId, coachId))
    .orderBy(desc(coachRatingSnapshots.calculatedAt))
    .limit(1);
  const previousPowerIndex = priorSnaps[0]?.powerIndex ?? null;
  const previousOverallRating = priorSnaps[0]?.overallRating ?? null;
  const previousWorldRank = priorSnaps[0]?.worldRank ?? null;
  const powerIndexChange =
    power.score != null && previousPowerIndex != null
      ? Math.round((power.score - previousPowerIndex) * 10) / 10
      : null;
  const overallRatingChange =
    overall != null && previousOverallRating != null
      ? Math.round((overall - previousOverallRating) * 10) / 10
      : null;
  const worldRankChange =
    worldRank != null && previousWorldRank != null ? previousWorldRank - worldRank : null;
  /** Momentum is Power Index movement — not an independent rating. */
  const momentum = powerIndexChange;

  const competition = await getCompetitionCoachRank(coachId).catch(() => null);

  return {
    overallRating: overall,
    previousOverallRating,
    overallRatingChange,
    coachRatingDetail,
    powerIndex: power.score,
    previousPowerIndex,
    powerIndexChange,
    powerIndexDetail: powerDetail,
    powerIndexMismatches: powerMismatches,
    worldRank,
    previousWorldRank,
    worldRankChange,
    rankedOutOf: ranked.length || null,
    competitionRank: competition?.rank ?? null,
    competitionRankedOutOf: competition?.rankedOutOf ?? null,
    competitionRankLabel: competition?.label ?? null,
    competitionRankSub: competition?.sub ?? null,
    momentum,
    metrics,
    intelligence,
    intelligenceModelVersion: COACH_INTELLIGENCE_VERSION,
    powerContributions: power.contributions,
    modelVersion: COACH_RATING_VERSION,
    powerIndexVersion: COACH_POWER_VERSION,
    dataConfidence,
    ratingConfidencePct,
    ratingConfidenceInputs,
    matchCount: matches.length,
    provisional,
  };
}

export type PersistCoachRatingOptions = {
  /** When set, rating is calculated as-of this match kickoff (inclusive). */
  asOfDate?: Date | null;
  fixtureId?: string | null;
  /** live | backfilled | recalculated */
  snapshotType?: "live" | "backfilled" | "recalculated";
  match?: {
    teamId?: string | null;
    opponentId?: string | null;
    competitionId?: string | null;
    matchDate?: Date | null;
    homeAwayNeutral?: "home" | "away" | "neutral" | null;
    result?: "W" | "D" | "L" | null;
    scoreFor?: number | null;
    scoreAgainst?: number | null;
    competitionName?: string | null;
    teamName?: string | null;
    opponentName?: string | null;
    fixtureSlug?: string | null;
    majorMatchLabel?: string | null;
  } | null;
  /** Skip writing coach_rating_history (snapshots only). */
  skipHistory?: boolean;
};

export function detectMajorMatchLabel(competitionName: string | null | undefined): string | null {
  if (!competitionName) return null;
  const c = competitionName.toLowerCase();
  if (c.includes("world cup") && c.includes("final")) return "Rugby World Cup Final";
  if (c.includes("world cup") && (c.includes("semi") || c.includes("sf"))) {
    return "Rugby World Cup Semi-final";
  }
  if (c.includes("world cup")) return "Rugby World Cup";
  if (c.includes("nations championship") && c.includes("final")) {
    return "Nations Championship Final";
  }
  if ((c.includes("championship") || c.includes("premiership") || c.includes("currie")) && c.includes("final")) {
    return "Final";
  }
  if (c.includes("semi") && c.includes("final")) return "Semi-final";
  return null;
}

export async function persistCoachRatingSnapshot(
  coachId: string,
  options: PersistCoachRatingOptions = {},
): Promise<CoachRatingBundle> {
  const snapshotType = options.snapshotType ?? (options.fixtureId ? "live" : "recalculated");
  const bundle = await calculateCoachRatingBundle(coachId, {
    asOfDate: options.asOfDate ?? null,
  });
  const db = getDb();
  await db.insert(coachRatingSnapshots).values({
    coachId,
    fixtureId: options.fixtureId ?? null,
    overallRating: bundle.overallRating,
    powerIndex: bundle.powerIndex,
    worldRank: bundle.worldRank,
    momentum: bundle.momentum,
    metrics: {
      metrics: bundle.metrics,
      intelligence: bundle.intelligence,
      intelligenceModelVersion: bundle.intelligenceModelVersion,
      contributions: bundle.powerContributions,
      powerIndex: bundle.powerIndexDetail,
      previousPowerIndex: bundle.previousPowerIndex,
      powerIndexChange: bundle.powerIndexChange,
      powerIndexMismatches: bundle.powerIndexMismatches,
      coachRating: bundle.coachRatingDetail,
      previousOverallRating: bundle.previousOverallRating,
      overallRatingChange: bundle.overallRatingChange,
      previousWorldRank: bundle.previousWorldRank,
      worldRankChange: bundle.worldRankChange,
      competitionRank: bundle.competitionRank,
      competitionRankedOutOf: bundle.competitionRankedOutOf,
      competitionRankLabel: bundle.competitionRankLabel,
      competitionRankSub: bundle.competitionRankSub,
      ratingConfidencePct: bundle.ratingConfidencePct,
      ratingConfidenceInputs: bundle.ratingConfidenceInputs,
      snapshotType,
    },
    modelVersion: bundle.modelVersion,
    powerIndexVersion: bundle.powerIndexVersion,
    dataConfidence: bundle.dataConfidence,
  });

  if (!options.skipHistory && bundle.overallRating != null) {
    const match = options.match ?? null;
    const fixtureId = options.fixtureId ?? null;
    const matchDate = match?.matchDate ?? options.asOfDate ?? null;

    // Match-linked history: previous point is the prior completed match, not a background recalc.
    let prev: (typeof coachRatingHistory.$inferSelect) | undefined;
    if (fixtureId && matchDate) {
      const [priorMatch] = await db
        .select()
        .from(coachRatingHistory)
        .where(
          and(
            eq(coachRatingHistory.coachId, coachId),
            isNotNull(coachRatingHistory.fixtureId),
            lt(coachRatingHistory.matchDate, matchDate),
          ),
        )
        .orderBy(desc(coachRatingHistory.matchDate), desc(coachRatingHistory.calculatedAt))
        .limit(1);
      prev = priorMatch;
    }

    const previousRating = prev?.rating ?? null;
    const previousPowerIndex = prev?.powerIndex ?? null;
    const change =
      previousRating != null
        ? Math.round((bundle.overallRating - previousRating) * 10) / 10
        : null;
    const powerIndexChange =
      bundle.powerIndex != null && previousPowerIndex != null
        ? Math.round((bundle.powerIndex - previousPowerIndex) * 10) / 10
        : null;

    const prevCoachRating = (
      prev?.metrics as { coachRating?: CoachRatingResult } | null | undefined
    )?.coachRating;
    const prevContribs = prevCoachRating?.contributions ?? [];
    const currContribs = bundle.coachRatingDetail?.contributions ?? [];
    const contributionDeltas = currContribs.map((c) => {
      const prior = prevContribs.find((x) => x.key === c.key);
      const delta =
        prior != null
          ? Math.round((c.contribution - prior.contribution) * 100) / 100
          : c.contribution;
      return {
        key: c.key,
        label: c.label,
        weight: c.weight,
        score: c.score,
        contribution: delta,
      };
    });

    const prevIntel = Array.isArray(prev?.intelligence)
      ? (prev!.intelligence as Array<{ key: string; score: number | null }>)
      : [];
    const intelligenceRows = bundle.intelligence.map((m) => {
      const prior = prevIntel.find((x) => x.key === m.key);
      return {
        key: m.key,
        label: m.label,
        score: m.score,
        previousScore: prior?.score ?? null,
        confidence: m.confidence,
        dataCoverage: m.dataCoverage,
      };
    });

    const row = {
      coachId,
      fixtureId,
      snapshotType,
      rating: bundle.overallRating,
      previousRating,
      change,
      worldRank: bundle.worldRank,
      teamId: match?.teamId ?? null,
      opponentId: match?.opponentId ?? null,
      competitionId: match?.competitionId ?? null,
      matchDate: matchDate ?? new Date(),
      homeAwayNeutral: match?.homeAwayNeutral ?? null,
      result: match?.result ?? null,
      scoreFor: match?.scoreFor ?? null,
      scoreAgainst: match?.scoreAgainst ?? null,
      powerIndex: bundle.powerIndex,
      powerIndexChange,
      opponentRating: null as number | null,
      opponentRank: null as number | null,
      confidence: bundle.ratingConfidencePct,
      coverage: bundle.matchCount,
      dataConfidence: bundle.dataConfidence,
      modelVersion: bundle.modelVersion,
      powerIndexVersion: bundle.powerIndexVersion,
      intelligenceModelVersion: bundle.intelligenceModelVersion,
      contributions: contributionDeltas,
      intelligence: intelligenceRows,
      metrics: {
        ratingConfidenceInputs: bundle.ratingConfidenceInputs,
        coachRating: bundle.coachRatingDetail,
      },
      majorMatchLabel:
        match?.majorMatchLabel ?? detectMajorMatchLabel(match?.competitionName) ?? null,
      competitionName: match?.competitionName ?? null,
      teamName: match?.teamName ?? null,
      opponentName: match?.opponentName ?? null,
      fixtureSlug: match?.fixtureSlug ?? null,
      calculatedAt: new Date(),
    };

    if (fixtureId) {
      const [existing] = await db
        .select({ id: coachRatingHistory.id })
        .from(coachRatingHistory)
        .where(
          and(eq(coachRatingHistory.coachId, coachId), eq(coachRatingHistory.fixtureId, fixtureId)),
        )
        .limit(1);
      if (existing) {
        await db
          .update(coachRatingHistory)
          .set(row)
          .where(eq(coachRatingHistory.id, existing.id));
      } else {
        await db.insert(coachRatingHistory).values(row);
      }
    } else {
      // Background recalcs — keep an audit trail but mark as recalculated
      await db.insert(coachRatingHistory).values({
        ...row,
        snapshotType: "recalculated",
        matchDate: null,
      });
    }
  }

  return bundle;
}

export async function listCoachWorldRankings(limit = 5): Promise<
  Array<{
    rank: number;
    coachId: string;
    name: string;
    slug: string;
    /** @deprecated Prefer currentTeamName — nationality is not the ranking display field. */
    nationality: string | null;
    currentTeamName: string | null;
    imageUrl: string | null;
    rating: number;
    powerIndex: number | null;
    winRate: number | null;
    bigMatch: number | null;
    playerDevelopment: number | null;
    /** Rank positions gained (positive) / lost (negative) vs previous ranking snapshot. */
    rankChange: number | null;
    previousRank: number | null;
    /** @deprecated Use rankChange — previously incorrectly mapped Power Index momentum. */
    movement: number | null;
    confidence: number | null;
    coverage: number | null;
    matchesUsed: number | null;
  }>
> {
  const rows = await listLatestEligibleCoachSnapshots();
  const eligible = rows
    .filter(isEligibleForWorldRank)
    .sort((a, b) => {
      const diff = (b.overallRating ?? 0) - (a.overallRating ?? 0);
      if (diff !== 0) return diff;
      return a.coachId.localeCompare(b.coachId);
    });
  const previousRanks = previousCoachRanksByRating(
    eligible.map((row) => ({
      coachId: row.coachId,
      rating: row.previousOverallRating ?? row.overallRating!,
    })),
  );
  return eligible.slice(0, limit).map((s, i) => {
    const rank = i + 1;
    // Prefer a reconstructed board from stored previous ratings, then a stored
    // previous worldRank. If we have no earlier snapshot, WAS = current rank
    // (no invented place-jumps).
    const previousRank = previousRanks.get(s.coachId) ?? s.previousWorldRank ?? rank;
    return toLeaderboardRow(s, rank, previousRank);
  });
}

/**
 * Active coaches ordered by current Power Index (current strength).
 * Separate from World Rankings (overall Coach Rating quality).
 */
export async function listCoachPowerIndexRankings(limit = 100): Promise<
  Array<{
    rank: number;
    coachId: string;
    name: string;
    slug: string;
    nationality: string | null;
    currentTeamName: string | null;
    imageUrl: string | null;
    powerIndex: number;
    powerIndexChange: number | null;
    rating: number | null;
    results: number | null;
    attack: number | null;
    defence: number | null;
    setPiece: number | null;
    selection: number | null;
    currentForm: number | null;
    confidence: number | null;
    matchesUsed: number | null;
  }>
> {
  const rows = await listLatestEligibleCoachSnapshots();
  const withPi = rows
    .filter((s) => s.powerIndex != null)
    .sort((a, b) => {
      const diff = (b.powerIndex ?? 0) - (a.powerIndex ?? 0);
      if (diff !== 0) return diff;
      return a.coachId.localeCompare(b.coachId);
    })
    .slice(0, limit);

  return withPi.map((s, i) => {
    const payload = s.metrics as {
      powerIndex?: CoachPowerIndexResult;
      powerIndexChange?: number | null;
      intelligence?: Array<{ key: string; score: number | null }>;
      coachRating?: CoachRatingResult;
      ratingConfidencePct?: number;
    } | null;
    const intel = payload?.intelligence ?? [];
    const scoreOf = (key: string) => {
      const m = intel.find((x) => x.key === key);
      return m?.score != null ? Math.round(m.score) : null;
    };
    const piDetail = payload?.powerIndex;
    return {
      rank: i + 1,
      coachId: s.coachId,
      name: s.name,
      slug: s.slug,
      nationality: s.nationality,
      currentTeamName: displayCoachTeamName(s.currentTeamName),
      imageUrl: s.imageUrl,
      powerIndex: Math.round(s.powerIndex!),
      powerIndexChange:
        typeof payload?.powerIndexChange === "number" ? payload.powerIndexChange : s.momentum,
      rating: s.overallRating,
      results: scoreOf("results"),
      attack: scoreOf("attack"),
      defence: scoreOf("defence"),
      setPiece: scoreOf("set_piece"),
      selection: scoreOf("selection"),
      currentForm: scoreOf("current_form"),
      confidence: piDetail?.confidence ?? payload?.coachRating?.confidence ?? payload?.ratingConfidencePct ?? null,
      matchesUsed: piDetail?.matchesUsed ?? payload?.coachRating?.matchesUsed ?? null,
    };
  });
}

type SnapshotRow = {
  coachId: string;
  overallRating: number | null;
  powerIndex: number | null;
  worldRank: number | null;
  momentum: number | null;
  metrics: unknown;
  calculatedAt: Date;
  name: string;
  slug: string;
  nationality: string | null;
  imageUrl: string | null;
  currentTeamName: string | null;
  previousWorldRank: number | null;
  previousOverallRating: number | null;
};

/** Rank coaches by a previous rating snapshot so Move uses stored scores, not a blank cell. */
export function previousCoachRanksByRating(
  previousRatings: Array<{ coachId: string; rating: number }>,
): Map<string, number> {
  const sorted = [...previousRatings].sort((a, b) => b.rating - a.rating || a.coachId.localeCompare(b.coachId));
  return new Map(sorted.map((row, index) => [row.coachId, index + 1]));
}

async function listLatestEligibleCoachSnapshots(): Promise<SnapshotRow[]> {
  const db = getDb();
  const snaps = await db
    .select({
      coachId: coachRatingSnapshots.coachId,
      overallRating: coachRatingSnapshots.overallRating,
      powerIndex: coachRatingSnapshots.powerIndex,
      worldRank: coachRatingSnapshots.worldRank,
      momentum: coachRatingSnapshots.momentum,
      metrics: coachRatingSnapshots.metrics,
      calculatedAt: coachRatingSnapshots.calculatedAt,
      name: coaches.name,
      slug: coaches.slug,
      nationality: coaches.nationality,
      imageUrl: coaches.imageUrl,
    })
    .from(coachRatingSnapshots)
    .innerJoin(coaches, eq(coachRatingSnapshots.coachId, coaches.id))
    .orderBy(desc(coachRatingSnapshots.calculatedAt));

  const best = new Map<string, (typeof snaps)[number]>();
  const previousByCoach = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) {
    if (s.overallRating == null && s.powerIndex == null) continue;
    if (!best.has(s.coachId)) {
      best.set(s.coachId, s);
      continue;
    }
    if (!previousByCoach.has(s.coachId)) previousByCoach.set(s.coachId, s);
  }

  const activeRows = await db
    .select({
      coachId: teamCoachingStaff.coachId,
      teamName: teams.name,
      teamDisplayName: teamCoachingStaff.teamDisplayName,
      isPrimary: teamCoachingStaff.isPrimaryCoach,
      role: teamCoachingStaff.role,
    })
    .from(teamCoachingStaff)
    .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
    .where(eq(teamCoachingStaff.isCurrent, true));

  const teamByCoach = new Map<string, string>();
  const preferred = [...activeRows].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.role === "head_coach" && b.role !== "head_coach") return -1;
    if (b.role === "head_coach" && a.role !== "head_coach") return 1;
    return 0;
  });
  for (const r of preferred) {
    const label = displayCoachTeamName(r.teamDisplayName || r.teamName);
    if (label && !teamByCoach.has(r.coachId)) teamByCoach.set(r.coachId, label);
  }
  for (const r of preferred) {
    if (!teamByCoach.has(r.coachId)) teamByCoach.set(r.coachId, "");
  }

  const coachIds = [...best.keys()];
  const gallery =
    coachIds.length > 0
      ? await db
          .select({
            coachId: coachImages.coachId,
            imageUrl: coachImages.imageUrl,
            role: coachImages.role,
            status: coachImages.status,
            isPublic: coachImages.isPublic,
          })
          .from(coachImages)
          .where(inArray(coachImages.coachId, coachIds))
      : [];
  const galleryByCoach = new Map<string, string>();
  const gallerySorted = [...gallery].sort((a, b) => {
    const score = (g: (typeof gallery)[number]) =>
      (g.status === "approved" ? 4 : g.status === "candidate" ? 1 : 0) +
      (g.role === "primary" || g.role === "profile" ? 2 : 0) +
      (g.isPublic ? 1 : 0);
    return score(b) - score(a);
  });
  for (const g of gallerySorted) {
    if (!galleryByCoach.has(g.coachId)) galleryByCoach.set(g.coachId, g.imageUrl);
  }

  return [...best.values()]
    .filter((s) => teamByCoach.has(s.coachId))
    .map((s) => {
      const prevSnap = previousByCoach.get(s.coachId);
      return {
        ...s,
        imageUrl: s.imageUrl || galleryByCoach.get(s.coachId) || null,
        currentTeamName: displayCoachTeamName(teamByCoach.get(s.coachId) ?? null),
        previousWorldRank:
          prevSnap?.worldRank != null && prevSnap.worldRank > 0 ? prevSnap.worldRank : null,
        previousOverallRating: prevSnap?.overallRating ?? null,
      };
    });
}

function isEligibleForWorldRank(s: SnapshotRow): boolean {
  if (s.overallRating == null) return false;
  const payload = s.metrics as { coachRating?: CoachRatingResult } | null;
  const cr = payload?.coachRating;
  if (cr?.eligibleForWorldRank) return true;
  if ((cr?.matchesUsed ?? 0) >= WORLD_RANK_MIN_MATCHES) return true;
  return !cr;
}

export async function applyPublicCoachMetricWorldRanks(
  coachId: string,
  intelligence: CoachIntelligenceMetric[],
): Promise<CoachIntelligenceMetric[]> {
  if (intelligence.length === 0) return intelligence;
  const snaps = await listLatestEligibleCoachSnapshots();
  const peers = snaps.map((s) => {
    const payload = s.metrics as { intelligence?: Array<{ key: string; score: number | null; confidence?: number; sampleSize?: number }> } | null;
    return {
      coachId: s.coachId,
      metrics: payload?.intelligence ?? [],
    };
  });
  return applyMetricWorldRanks(intelligence, peers, coachId);
}

/**
 * Persist a rating snapshot from eligible matches (no peer scan, no Wikipedia).
 * Safe for scripts and public backfill — does not call calculateCoachRatingBundle.
 */
export async function persistLiteCoachRatingSnapshot(
  coachId: string,
  options: { skipHistory?: boolean; skipIntelligence?: boolean; bundle?: CoachRatingBundle } = {},
): Promise<CoachRatingBundle> {
  const matches = await loadCoachEligibleMatches(coachId, { primaryOnly: true });
  let bundle = options.bundle ?? buildCoachRatingBundleFromMatches(matches);
  const sparseMissing = ["set_piece", "breakdown", "kicking", "discipline", "selection"].some(
    (key) => bundle.intelligence.find((m) => m.key === key)?.score == null,
  );
  if (!options.skipIntelligence && sparseMissing && matches.length >= 5) {
    try {
      const intel = await calculateCoachIntelligence(coachId);
      if (intel.metrics.some((m) => m.score != null)) {
        const power = computeCoachPowerIndex(intel.metrics);
        bundle = {
          ...bundle,
          intelligence: intel.metrics,
          intelligenceModelVersion: intel.modelVersion,
          metrics: intelligenceToLegacyMetrics(intel.metrics),
          powerIndex: power.score,
          powerIndexDetail: power,
          powerContributions: power.contributions.map((c) => ({
            key: c.key,
            weight: c.weight,
            score: c.score,
            contribution: c.contribution,
          })),
        };
      }
    } catch {
      // Keep the lite bundle if full intelligence inputs are missing.
    }
  }

  const db = getDb();
  await db.insert(coachRatingSnapshots).values({
    coachId,
    fixtureId: null,
    overallRating: bundle.overallRating,
    powerIndex: bundle.powerIndex,
    worldRank: bundle.worldRank,
    momentum: bundle.momentum,
    metrics: {
      metrics: bundle.metrics,
      intelligence: bundle.intelligence,
      intelligenceModelVersion: bundle.intelligenceModelVersion,
      contributions: bundle.powerContributions,
      powerIndex: bundle.powerIndexDetail,
      previousPowerIndex: bundle.previousPowerIndex,
      powerIndexChange: bundle.powerIndexChange,
      powerIndexMismatches: bundle.powerIndexMismatches,
      coachRating: bundle.coachRatingDetail,
      previousOverallRating: bundle.previousOverallRating,
      overallRatingChange: bundle.overallRatingChange,
      previousWorldRank: bundle.previousWorldRank,
      worldRankChange: bundle.worldRankChange,
      competitionRank: bundle.competitionRank,
      competitionRankedOutOf: bundle.competitionRankedOutOf,
      competitionRankLabel: bundle.competitionRankLabel,
      competitionRankSub: bundle.competitionRankSub,
      ratingConfidencePct: bundle.ratingConfidencePct,
      ratingConfidenceInputs: bundle.ratingConfidenceInputs,
      snapshotType: "recalculated",
    },
    modelVersion: bundle.modelVersion,
    powerIndexVersion: bundle.powerIndexVersion,
    dataConfidence: bundle.dataConfidence,
  });

  if (options.skipHistory !== true && bundle.overallRating != null) {
    await db.insert(coachRatingHistory).values({
      coachId,
      fixtureId: null,
      snapshotType: "recalculated",
      rating: bundle.overallRating,
      previousRating: null,
      change: null,
      worldRank: bundle.worldRank,
      matchDate: new Date(),
      powerIndex: bundle.powerIndex,
      confidence: bundle.ratingConfidencePct,
      coverage: bundle.matchCount,
      dataConfidence: bundle.dataConfidence,
      modelVersion: bundle.modelVersion,
      powerIndexVersion: bundle.powerIndexVersion,
      intelligenceModelVersion: bundle.intelligenceModelVersion,
      contributions: bundle.coachRatingDetail?.contributions ?? [],
      intelligence: bundle.intelligence.map((m) => ({
        key: m.key,
        label: m.label,
        score: m.score,
        confidence: m.confidence,
        dataCoverage: m.dataCoverage,
      })),
      metrics: { coachRating: bundle.coachRatingDetail },
      calculatedAt: new Date(),
    });
  }

  return bundle;
}

function toLeaderboardRow(s: SnapshotRow, rank: number, previousRankOverride?: number | null) {
  const payload = s.metrics as {
    coachRating?: CoachRatingResult;
    powerIndex?: CoachPowerIndexResult;
    intelligence?: Array<{ key: string; score: number | null }>;
    ratingConfidencePct?: number;
  } | null;
  const cr = payload?.coachRating;
  const intel = payload?.intelligence ?? [];
  const scoreOf = (key: string) => {
    const m = intel.find((x) => x.key === key);
    return m?.score != null ? Math.round(m.score) : null;
  };
  const contribScore = (key: string) => {
    const c = cr?.contributions?.find((x) => x.key === key);
    return c != null ? Math.round(c.score) : null;
  };
  const previousRank = previousRankOverride ?? s.previousWorldRank;
  const rankChange = previousRank != null ? previousRank - rank : null;

  return {
    rank,
    coachId: s.coachId,
    name: s.name,
    slug: s.slug,
    nationality: s.nationality,
    currentTeamName: displayCoachTeamName(s.currentTeamName),
    imageUrl: s.imageUrl,
    rating: s.overallRating!,
    powerIndex: s.powerIndex != null ? Math.round(s.powerIndex) : null,
    winRate: contribScore("career_results") ?? scoreOf("results"),
    bigMatch: contribScore("big_match_performance") ?? scoreOf("big_match_performance"),
    playerDevelopment: contribScore("player_development") ?? scoreOf("player_development"),
    rankChange,
    previousRank,
    movement: rankChange,
    confidence: cr?.confidence ?? payload?.ratingConfidencePct ?? null,
    coverage: cr?.weightedCoverage ?? null,
    matchesUsed: cr?.matchesUsed ?? null,
  };
}

/** Average of stored match ratings when present — feeds experience/results. */
export async function getCoachMatchRatingAverage(coachId: string): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ rating: coachMatchRatings.rating })
    .from(coachMatchRatings)
    .where(eq(coachMatchRatings.coachId, coachId))
    .limit(200);
  const vals = rows.map((r) => r.rating).filter((r): r is number => r != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
