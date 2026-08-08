/**
 * Coach Rating + Power Index engines (coach-rating-v1 / coach-power-v1).
 * Metrics are derived from eligible career matches; insufficient data yields nulls.
 */

import { desc, eq } from "drizzle-orm";
import { coachMatchRatings, coachRatingHistory, coachRatingSnapshots, coaches } from "@rugby365/db";
import { getDb } from "./db";
import {
  computeCareerRecord,
  loadCoachEligibleMatches,
  type CoachEligibleMatch,
} from "./coach-career-record-service";

export const COACH_RATING_VERSION = "coach-rating-v1";
export const COACH_POWER_VERSION = "coach-power-v1";
export const MIN_MATCHES_FOR_RANK = 10;

export const COACH_INTELLIGENCE_METRICS = [
  "results",
  "attack",
  "defence",
  "set_piece",
  "breakdown",
  "kicking",
  "discipline",
  "selection",
  "game_management",
  "bench_impact",
  "player_development",
  "squad_depth",
  "big_match_performance",
  "experience",
  "current_form",
] as const;

export type CoachMetricKey = (typeof COACH_INTELLIGENCE_METRICS)[number];

export type CoachMetricScore = {
  key: CoachMetricKey;
  label: string;
  score: number | null;
  worldRank: number | null;
  raw: Record<string, number | string | null>;
};

export type CoachPowerWeights = Record<string, number>;

/** Central Power Index weights (sum ≈ 100). Experience kept low. */
export const POWER_INDEX_WEIGHTS: CoachPowerWeights = {
  results: 18,
  opponent_strength: 10,
  attack: 8,
  defence: 8,
  set_piece: 6,
  breakdown: 5,
  kicking: 5,
  discipline: 5,
  selection: 7,
  game_management: 8,
  player_development: 5,
  big_match_performance: 5,
  experience: 3,
  current_form: 7,
};

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

export { scoreBandColor };

function recentWeightedWinRate(matches: CoachEligibleMatch[]): number | null {
  if (!matches.length) return null;
  const last = matches.slice(-20);
  let weightSum = 0;
  let scoreSum = 0;
  last.forEach((m, i) => {
    const age = last.length - 1 - i;
    const w = age < 5 ? 3 : age < 10 ? 2 : 1;
    weightSum += w;
    scoreSum += m.result === "W" ? w : m.result === "D" ? w * 0.35 : 0;
  });
  return weightSum > 0 ? (scoreSum / weightSum) * 100 : null;
}

export function computeCoachMetrics(matches: CoachEligibleMatch[]): CoachMetricScore[] {
  const record = computeCareerRecord(matches);
  const recent = matches.slice(-8);
  const recentWr = recent.length
    ? (recent.filter((m) => m.result === "W").length / recent.length) * 100
    : null;
  const weighted = recentWeightedWinRate(matches);
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
    mk("set_piece", null, { note: "Insufficient verified set-piece data" }),
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

export function computePowerIndex(metrics: CoachMetricScore[]): {
  score: number | null;
  contributions: Array<{ key: string; weight: number; score: number; contribution: number }>;
  reweighted: boolean;
} {
  const available: Array<{ key: string; weight: number; score: number }> = [];
  for (const [key, weight] of Object.entries(POWER_INDEX_WEIGHTS)) {
    const m = metrics.find((x) => x.key === key || (key === "opponent_strength" && x.key === "results"));
    if (key === "opponent_strength") {
      // fold into results until opponent rankings at match date are available
      continue;
    }
    if (m?.score != null) available.push({ key, weight, score: m.score });
  }

  // redistribute opponent_strength weight into results if present
  const results = available.find((a) => a.key === "results");
  if (results) results.weight += POWER_INDEX_WEIGHTS.opponent_strength ?? 0;

  if (!available.length) return { score: null, contributions: [], reweighted: false };

  const weightSum = available.reduce((s, a) => s + a.weight, 0);
  const reweighted = weightSum !== 100;
  const contributions = available.map((a) => {
    const w = (a.weight / weightSum) * 100;
    return {
      key: a.key,
      weight: Math.round(w * 10) / 10,
      score: a.score,
      contribution: Math.round(((a.score * w) / 100) * 100) / 100,
    };
  });
  const score = contributions.reduce((s, c) => s + c.contribution, 0);
  return { score: Math.round(score * 10) / 10, contributions, reweighted };
}

export function computeOverallRating(
  metrics: CoachMetricScore[],
  powerIndex: number | null,
  careerWinRate: number | null,
): number | null {
  const scores = metrics.map((m) => m.score).filter((s): s is number => s != null);
  if (!scores.length && powerIndex == null && careerWinRate == null) return null;
  const metricAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const parts = [
    metricAvg != null ? { v: metricAvg, w: 0.45 } : null,
    powerIndex != null ? { v: powerIndex, w: 0.35 } : null,
    careerWinRate != null ? { v: careerWinRate, w: 0.2 } : null,
  ].filter(Boolean) as Array<{ v: number; w: number }>;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  if (!wSum) return null;
  return Math.round(parts.reduce((s, p) => s + (p.v * p.w) / wSum, 0) * 10) / 10;
}

export type CoachRatingBundle = {
  overallRating: number | null;
  powerIndex: number | null;
  worldRank: number | null;
  rankedOutOf: number | null;
  momentum: number | null;
  metrics: CoachMetricScore[];
  powerContributions: Array<{ key: string; weight: number; score: number; contribution: number }>;
  modelVersion: string;
  powerIndexVersion: string;
  dataConfidence: "high" | "medium" | "low" | "none";
  matchCount: number;
  provisional: boolean;
};

export async function calculateCoachRatingBundle(coachId: string): Promise<CoachRatingBundle> {
  const matches = await loadCoachEligibleMatches(coachId, { primaryOnly: true });
  const record = computeCareerRecord(matches);
  const metrics = computeCoachMetrics(matches);
  const power = computePowerIndex(metrics);
  const overall = computeOverallRating(metrics, power.score, record.winRateExact);
  const provisional = matches.length < MIN_MATCHES_FOR_RANK;

  let dataConfidence: CoachRatingBundle["dataConfidence"] = "none";
  if (matches.length >= 20) dataConfidence = "high";
  else if (matches.length >= 10) dataConfidence = "medium";
  else if (matches.length > 0) dataConfidence = "low";

  // World rank among coaches with a stored snapshot or live calculation among recent raters
  const db = getDb();
  const peerSnapshots = await db
    .select({
      coachId: coachRatingSnapshots.coachId,
      overallRating: coachRatingSnapshots.overallRating,
    })
    .from(coachRatingSnapshots)
    .orderBy(desc(coachRatingSnapshots.calculatedAt))
    .limit(500);

  const bestByCoach = new Map<string, number>();
  for (const row of peerSnapshots) {
    if (row.overallRating == null) continue;
    if (!bestByCoach.has(row.coachId)) bestByCoach.set(row.coachId, row.overallRating);
  }
  if (overall != null) bestByCoach.set(coachId, overall);

  const ranked = [...bestByCoach.entries()]
    .filter(([, r]) => r != null)
    .sort((a, b) => b[1] - a[1]);
  const idx = ranked.findIndex(([id]) => id === coachId);
  const worldRank = !provisional && overall != null && idx >= 0 ? idx + 1 : null;

  // Momentum from last two history points if present
  const history = await db
    .select()
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.coachId, coachId))
    .orderBy(desc(coachRatingHistory.calculatedAt))
    .limit(2);
  let momentum: number | null = null;
  if (history.length >= 2 && history[0].rating != null && history[1].rating != null) {
    momentum = Math.round((history[0].rating - history[1].rating) * 10) / 10;
  } else if (power.score != null && overall != null) {
    // fallback: small signal from form vs career
    const form = metrics.find((m) => m.key === "current_form")?.score;
    if (form != null && record.winRateExact != null) {
      momentum = Math.round((form - record.winRateExact) / 10);
    }
  }

  return {
    overallRating: overall,
    powerIndex: power.score,
    worldRank,
    rankedOutOf: ranked.length || null,
    momentum,
    metrics,
    powerContributions: power.contributions,
    modelVersion: COACH_RATING_VERSION,
    powerIndexVersion: COACH_POWER_VERSION,
    dataConfidence,
    matchCount: matches.length,
    provisional,
  };
}

export async function persistCoachRatingSnapshot(coachId: string): Promise<CoachRatingBundle> {
  const bundle = await calculateCoachRatingBundle(coachId);
  const db = getDb();
  await db.insert(coachRatingSnapshots).values({
    coachId,
    overallRating: bundle.overallRating,
    powerIndex: bundle.powerIndex,
    worldRank: bundle.worldRank,
    momentum: bundle.momentum,
    metrics: {
      metrics: bundle.metrics,
      contributions: bundle.powerContributions,
    },
    modelVersion: bundle.modelVersion,
    powerIndexVersion: bundle.powerIndexVersion,
    dataConfidence: bundle.dataConfidence,
  });

  if (bundle.overallRating != null) {
    const [prev] = await db
      .select()
      .from(coachRatingHistory)
      .where(eq(coachRatingHistory.coachId, coachId))
      .orderBy(desc(coachRatingHistory.calculatedAt))
      .limit(1);
    await db.insert(coachRatingHistory).values({
      coachId,
      rating: bundle.overallRating,
      previousRating: prev?.rating ?? null,
      change:
        prev?.rating != null
          ? Math.round((bundle.overallRating - prev.rating) * 10) / 10
          : null,
      worldRank: bundle.worldRank,
      modelVersion: bundle.modelVersion,
    });
  }

  return bundle;
}

export async function listCoachWorldRankings(limit = 5): Promise<
  Array<{
    rank: number;
    coachId: string;
    name: string;
    slug: string;
    nationality: string | null;
    imageUrl: string | null;
    rating: number;
    movement: number | null;
  }>
> {
  const db = getDb();
  // latest snapshot per coach via distinct-on pattern
  const snaps = await db
    .select({
      coachId: coachRatingSnapshots.coachId,
      overallRating: coachRatingSnapshots.overallRating,
      momentum: coachRatingSnapshots.momentum,
      calculatedAt: coachRatingSnapshots.calculatedAt,
      name: coaches.name,
      slug: coaches.slug,
      nationality: coaches.nationality,
      imageUrl: coaches.imageUrl,
    })
    .from(coachRatingSnapshots)
    .innerJoin(coaches, eq(coachRatingSnapshots.coachId, coaches.id))
    .orderBy(desc(coachRatingSnapshots.calculatedAt))
    .limit(400);

  const best = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) {
    if (s.overallRating == null) continue;
    if (!best.has(s.coachId)) best.set(s.coachId, s);
  }

  return [...best.values()]
    .sort((a, b) => (b.overallRating ?? 0) - (a.overallRating ?? 0))
    .slice(0, limit)
    .map((s, i) => ({
      rank: i + 1,
      coachId: s.coachId,
      name: s.name,
      slug: s.slug,
      nationality: s.nationality,
      imageUrl: s.imageUrl,
      rating: s.overallRating!,
      movement: s.momentum,
    }));
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
