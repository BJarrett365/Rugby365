/**
 * CoachIntelligenceEngine (coach-intelligence-v1)
 *
 * Deterministic 0–100 scores from Rugby365 tenure + match data.
 * Tolerates partial inputs; renormalises weights; never invents stats.
 * Design mock values (96/91/95) are NOT used — only live calculations.
 */

import { and, inArray } from "drizzle-orm";
import {
  fixturePlayers,
  matchEvents,
  playerMatchRatings,
  teamMatchStats,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  computeCareerRecord,
  loadCoachEligibleMatches,
  type CoachEligibleMatch,
} from "./coach-career-record-service";
import { getTeamRankingAtDate } from "./world-rugby-rankings-at-date";
import { getCoachPlayerDevelopmentBundle } from "./coach-player-development-service";

export const COACH_INTELLIGENCE_VERSION = "coach-intelligence-v1";
export const INTELLIGENCE_WINDOW = 20;
export const INSUFFICIENT_COVERAGE = 25;
export const MIN_RANK_MATCHES = 5;
export const MIN_RANK_CONFIDENCE = 40;

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

export type CoachIntelligenceMetric = CoachMetricScore & {
  confidence: number;
  sampleSize: number;
  dataCoverage: number;
  period: string;
  calculatedAt: string;
  modelVersion: string;
  trend: number | null;
  components: Record<string, number | null>;
  availableInputs: string[];
  missingInputs: string[];
  status: "CURRENT" | "PARTIAL" | "INSUFFICIENT";
};

export type CoachIntelligenceBundle = {
  coachId: string;
  metrics: CoachIntelligenceMetric[];
  modelVersion: string;
  period: string;
  matchWindow: number;
  matchesUsed: number;
  calculatedAt: string;
};

type MatchContext = {
  match: CoachEligibleMatch;
  weight: number;
  formWeight: number;
  stats: typeof teamMatchStats.$inferSelect | null;
  opponentRank: number | null;
  starters: string[];
  bench: string[];
  starterRatings: number[];
  benchRatings: number[];
  yellowCards: number;
  redCards: number;
  isBigMatch: boolean;
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pctToScore(pct: number | null): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  // Accept 0–1 or 0–100
  const v = pct <= 1.5 ? pct * 100 : pct;
  return clamp(v);
}

function sectionNum(sections: unknown, ...keys: string[]): number | null {
  if (!sections || typeof sections !== "object") return null;
  let cur: unknown = sections;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  if (typeof cur === "number" && Number.isFinite(cur)) return cur;
  if (typeof cur === "string" && cur.trim() !== "" && Number.isFinite(Number(cur))) {
    return Number(cur);
  }
  return null;
}

/** Try several section paths; first hit wins. */
function firstNum(sections: unknown, paths: string[][]): number | null {
  for (const p of paths) {
    const v = sectionNum(sections, ...p);
    if (v != null) return v;
  }
  return null;
}

function coverageBand(coveragePct: number): { confidence: number; status: CoachIntelligenceMetric["status"] } {
  if (coveragePct >= 80) return { confidence: 92, status: "CURRENT" };
  if (coveragePct >= 50) return { confidence: 74, status: "PARTIAL" };
  if (coveragePct >= INSUFFICIENT_COVERAGE) return { confidence: 48, status: "PARTIAL" };
  return { confidence: 20, status: "INSUFFICIENT" };
}

function weightedAverage(
  values: Array<{ value: number; weight: number }>,
): number | null {
  const usable = values.filter((v) => Number.isFinite(v.value) && v.weight > 0);
  if (!usable.length) return null;
  const w = usable.reduce((s, v) => s + v.weight, 0);
  if (w <= 0) return null;
  return usable.reduce((s, v) => s + v.value * v.weight, 0) / w;
}

function renormalise(
  components: Array<{ key: string; score: number | null; weight: number }>,
): { score: number | null; used: string[]; missing: string[] } {
  const used = components.filter((c) => c.score != null);
  const missing = components.filter((c) => c.score == null).map((c) => c.key);
  if (!used.length) return { score: null, used: [], missing: components.map((c) => c.key) };
  const wSum = used.reduce((s, c) => s + c.weight, 0);
  const score = used.reduce((s, c) => s + (c.score as number) * (c.weight / wSum), 0);
  return { score, used: used.map((c) => c.key), missing };
}

function windowWeights(n: number): number[] {
  // Last 5 → 40%, 6–10 → 30%, 11–20 → 30% (newest last in chronological array)
  const weights = Array.from({ length: n }, () => 1);
  if (n === 0) return weights;
  for (let i = 0; i < n; i++) {
    const ageFromEnd = n - 1 - i; // 0 = most recent
    if (ageFromEnd < 5) weights[i] = 0.4 / Math.min(5, n);
    else if (ageFromEnd < 10) weights[i] = 0.3 / Math.min(5, Math.max(1, n - 5));
    else weights[i] = 0.3 / Math.max(1, n - 10);
  }
  // Renormalise
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => w / sum);
}

function formWeights(n: number): number[] {
  // Last 3: 50%, 4–5: 30%, 6–8: 20%
  const weights = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i++) {
    const ageFromEnd = n - 1 - i;
    if (ageFromEnd < 3) weights[i] = 0.5 / Math.min(3, n);
    else if (ageFromEnd < 5) weights[i] = 0.3 / Math.min(2, Math.max(1, n - 3));
    else weights[i] = 0.2 / Math.max(1, n - 5);
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => w / sum);
}

function isBigMatch(m: CoachEligibleMatch, opponentRank: number | null): boolean {
  const name = (m.competitionName ?? "").toLowerCase();
  if (
    name.includes("world cup") ||
    name.includes("final") ||
    name.includes("semi") ||
    name.includes("quarter") ||
    name.includes("knockout") ||
    name.includes("championship")
  ) {
    return true;
  }
  if (opponentRank != null && opponentRank <= 6) return true;
  return false;
}

function mkMetric(
  key: CoachMetricKey,
  score: number | null,
  input: {
    confidence: number;
    sampleSize: number;
    dataCoverage: number;
    period: string;
    components?: Record<string, number | null>;
    availableInputs?: string[];
    missingInputs?: string[];
    status?: CoachIntelligenceMetric["status"];
    raw?: Record<string, number | string | null>;
    worldRank?: number | null;
    trend?: number | null;
  },
): CoachIntelligenceMetric {
  const status =
    input.status ??
    (score == null || input.dataCoverage < INSUFFICIENT_COVERAGE
      ? "INSUFFICIENT"
      : input.dataCoverage < 80
        ? "PARTIAL"
        : "CURRENT");
  const finalScore =
    status === "INSUFFICIENT" || score == null ? null : round1(clamp(score));
  return {
    key,
    label: LABELS[key],
    score: finalScore,
    worldRank: input.worldRank ?? null,
    raw: input.raw ?? {},
    confidence: Math.round(input.confidence),
    sampleSize: input.sampleSize,
    dataCoverage: Math.round(input.dataCoverage),
    period: input.period,
    calculatedAt: new Date().toISOString(),
    modelVersion: COACH_INTELLIGENCE_VERSION,
    trend: input.trend ?? null,
    components: input.components ?? {},
    availableInputs: input.availableInputs ?? [],
    missingInputs: input.missingInputs ?? [],
    status,
  };
}

async function loadMatchContexts(
  matchesChronological: CoachEligibleMatch[],
): Promise<MatchContext[]> {
  const window = matchesChronological.slice(-INTELLIGENCE_WINDOW);
  if (!window.length) return [];
  const ids = window.map((m) => m.id);
  const db = getDb();

  const statsRows = await db
    .select()
    .from(teamMatchStats)
    .where(inArray(teamMatchStats.fixtureId, ids));

  const bestStats = new Map<string, (typeof statsRows)[number]>();
  const providerRank = (p: string | null) =>
    p === "sdms" ? 3 : p === "rugby_data" ? 2 : p === "rwc_player_rollup" ? 1 : 0;
  for (const row of statsRows) {
    const key = `${row.fixtureId}:${row.teamId}`;
    const existing = bestStats.get(key);
    if (!existing || providerRank(row.sourceProvider) > providerRank(existing.sourceProvider)) {
      bestStats.set(key, row);
    }
  }

  const lineupRows = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      playerId: fixturePlayers.playerId,
      squadRole: fixturePlayers.squadRole,
      jerseyNumber: fixturePlayers.jerseyNumber,
      teamId: fixturePlayers.teamId,
    })
    .from(fixturePlayers)
    .where(inArray(fixturePlayers.fixtureId, ids));

  const ratingRows = await db
    .select({
      fixtureId: playerMatchRatings.fixtureId,
      playerId: playerMatchRatings.playerId,
      teamId: playerMatchRatings.teamId,
      rating: playerMatchRatings.rating,
      squadRole: playerMatchRatings.squadRole,
    })
    .from(playerMatchRatings)
    .where(inArray(playerMatchRatings.fixtureId, ids));

  const events = await db
    .select({
      fixtureId: matchEvents.fixtureId,
      teamId: matchEvents.teamId,
      eventType: matchEvents.eventType,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, ids));

  const weights = windowWeights(window.length);
  const fWeights = formWeights(Math.min(8, window.length));
  const formStart = Math.max(0, window.length - 8);

  const contexts: MatchContext[] = [];
  for (let i = 0; i < window.length; i++) {
    const match = window[i];
    const teamId = match.teamId;
    const stats =
      teamId != null ? bestStats.get(`${match.id}:${teamId}`) ?? null : null;

    let opponentRank: number | null = null;
    if (match.opponentTeamId && match.kickoffAt) {
      const rank = await getTeamRankingAtDate({
        teamId: match.opponentTeamId,
        asOf: match.kickoffAt,
      }).catch(() => null);
      opponentRank = rank?.position ?? null;
    }

    const lineup = lineupRows.filter(
      (r) => r.fixtureId === match.id && (!teamId || r.teamId === teamId),
    );
    const starters = lineup
      .filter((p) => {
        const role = (p.squadRole || "").toLowerCase();
        return (
          role.includes("start") ||
          role === "xv" ||
          (p.jerseyNumber != null && p.jerseyNumber >= 1 && p.jerseyNumber <= 15)
        );
      })
      .map((p) => p.playerId);
    const bench = lineup
      .filter((p) => {
        const role = (p.squadRole || "").toLowerCase();
        return (
          role.includes("bench") ||
          role.includes("repl") ||
          (p.jerseyNumber != null && p.jerseyNumber >= 16)
        );
      })
      .map((p) => p.playerId);

    const ratings = ratingRows.filter(
      (r) => r.fixtureId === match.id && (!teamId || r.teamId === teamId),
    );
    const starterRatings = ratings
      .filter((r) => starters.includes(r.playerId) && r.rating != null)
      .map((r) => r.rating as number);
    const benchRatings = ratings
      .filter((r) => bench.includes(r.playerId) && r.rating != null)
      .map((r) => r.rating as number);

    const teamEvents = events.filter(
      (e) => e.fixtureId === match.id && (!teamId || e.teamId === teamId),
    );
    const yellowCards = teamEvents.filter((e) =>
      /yellow/.test((e.eventType || "").toLowerCase()),
    ).length;
    const redCards = teamEvents.filter((e) => /red/.test((e.eventType || "").toLowerCase())).length;

    contexts.push({
      match,
      weight: weights[i] ?? 0,
      formWeight: i >= formStart ? fWeights[i - formStart] ?? 0 : 0,
      stats,
      opponentRank,
      starters,
      bench,
      starterRatings,
      benchRatings,
      yellowCards,
      redCards,
      isBigMatch: isBigMatch(match, opponentRank),
    });
  }
  return contexts;
}

function calcResults(ctx: MatchContext[]): CoachIntelligenceMetric {
  const period = `last_${ctx.length}_matches`;
  if (!ctx.length) {
    return mkMetric("results", null, {
      confidence: 0,
      sampleSize: 0,
      dataCoverage: 0,
      period,
      missingInputs: ["matches"],
    });
  }

  const adj = weightedAverage(
    ctx.map((c) => {
      const base = c.match.result === "W" ? 100 : c.match.result === "D" ? 40 : 0;
      const oppBoost =
        c.opponentRank == null ? 0 : clamp((8 - c.opponentRank) * 2, -8, 16);
      return { value: clamp(base + oppBoost), weight: c.weight };
    }),
  );
  const oppStrength = weightedAverage(
    ctx
      .filter((c) => c.opponentRank != null)
      .map((c) => ({
        value: clamp(100 - ((c.opponentRank as number) - 1) * 4),
        weight: c.weight,
      })),
  );
  const away = ctx.filter((c) => c.match.side === "away");
  const awayScore = away.length
    ? (away.filter((c) => c.match.result === "W").length / away.length) * 100
    : null;
  const marginScore = weightedAverage(
    ctx.map((c) => {
      if (c.match.result === "W") return { value: clamp(55 + c.match.margin * 1.5), weight: c.weight };
      if (c.match.result === "D") return { value: 50, weight: c.weight };
      return { value: clamp(45 + c.match.margin * 1.2), weight: c.weight };
    }),
  );

  const parts = renormalise([
    { key: "adjusted_win_rate", score: adj, weight: 60 },
    { key: "opponent_strength", score: oppStrength, weight: 20 },
    { key: "away_performance", score: awayScore, weight: 10 },
    { key: "result_margin", score: marginScore, weight: 10 },
  ]);
  const coverage = (parts.used.length / 4) * 100;
  const band = coverageBand(Math.max(coverage, ctx.length >= 10 ? 80 : (ctx.length / 20) * 100));
  const sampleBoost = clamp(ctx.length * 4, 0, 20);

  return mkMetric("results", parts.score, {
    confidence: clamp(band.confidence + (ctx.length >= 15 ? 5 : 0)),
    sampleSize: ctx.length,
    dataCoverage: clamp(Math.max(coverage, (ctx.length / INTELLIGENCE_WINDOW) * 100) + sampleBoost * 0),
    period,
    components: {
      adjusted_win_rate: adj != null ? round1(adj) : null,
      opponent_strength: oppStrength != null ? round1(oppStrength) : null,
      away_performance: awayScore != null ? round1(awayScore) : null,
      result_margin: marginScore != null ? round1(marginScore) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: ctx.length < 3 ? "INSUFFICIENT" : band.status,
    raw: { matches: ctx.length, awayMatches: away.length },
  });
}

function calcAttack(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withStats = ctx.filter((c) => c.stats);
  const coverage = ctx.length ? (withStats.length / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);

  const avg = (picker: (c: MatchContext) => number | null) =>
    weightedAverage(
      withStats
        .map((c) => {
          const v = picker(c);
          return v == null ? null : { value: v, weight: c.weight };
        })
        .filter(Boolean) as Array<{ value: number; weight: number }>,
    );

  const ppg = weightedAverage(ctx.map((c) => ({ value: c.match.forScore, weight: c.weight })));
  const tries = avg((c) => {
    const s = c.stats!.sections;
    return firstNum(s, [["attack", "tries"], ["summary", "tries"]]) ?? c.stats!.tries;
  });
  const metres = avg((c) => {
    const s = c.stats!.sections;
    return firstNum(s, [["attack", "metres"], ["summary", "metres"]]) ?? c.stats!.metres;
  });
  const breaks = avg((c) =>
    firstNum(c.stats!.sections, [
      ["attack", "clean_breaks"],
      ["attack", "line_breaks"],
    ]),
  );
  const beaten = avg((c) => firstNum(c.stats!.sections, [["attack", "defenders_beaten"]]));
  const offloads = avg((c) => firstNum(c.stats!.sections, [["attack", "offloads"]]));

  const ppgScore = ppg != null ? clamp(35 + ppg * 2.0) : null;
  const triesScore = tries != null ? clamp(40 + tries * 12) : null;
  const metresScore = metres != null ? clamp(30 + metres / 6) : null;
  const breaksScore = breaks != null ? clamp(40 + breaks * 6) : null;
  const beatenScore = beaten != null ? clamp(40 + beaten * 1.5) : null;
  const offloadScore = offloads != null ? clamp(45 + offloads * 4) : null;

  const parts = renormalise([
    { key: "points_per_game", score: ppgScore, weight: 30 },
    { key: "tries_per_game", score: triesScore, weight: 25 },
    { key: "metres", score: metresScore, weight: 20 },
    { key: "clean_breaks", score: breaksScore, weight: 15 },
    { key: "defenders_beaten", score: beatenScore, weight: 5 },
    { key: "offloads", score: offloadScore, weight: 5 },
  ]);

  return mkMetric("attack", parts.score, {
    confidence: band.confidence,
    sampleSize: withStats.length || ctx.length,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      points_per_game: ppg != null ? round1(ppg) : null,
      tries_per_game: tries != null ? round1(tries) : null,
      metres: metres != null ? round1(metres) : null,
      clean_breaks: breaks != null ? round1(breaks) : null,
      defenders_beaten: beaten != null ? round1(beaten) : null,
      offloads: offloads != null ? round1(offloads) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: band.status,
  });
}

function calcDefence(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withStats = ctx.filter((c) => c.stats);
  const coverage = ctx.length ? (Math.max(withStats.length, ctx.length) > 0 ? (ctx.length ? ((withStats.length || ctx.length) / ctx.length) * 100 : 0) : 0) : 0;
  // Points conceded always available from results
  const resultCoverage = ctx.length ? 100 : 0;
  const band = coverageBand(Math.max(coverage, resultCoverage * 0.6));

  const pa = weightedAverage(ctx.map((c) => ({ value: c.match.againstScore, weight: c.weight })));
  const paScore = pa != null ? clamp(100 - pa * 2.4) : null;

  const tacklePct = weightedAverage(
    withStats
      .map((c) => {
        const v = firstNum(c.stats!.sections, [
          ["defence", "tackles_success_percentage"],
          ["defence", "tackle_success_percentage"],
        ]);
        const score = pctToScore(v);
        return score == null ? null : { value: score, weight: c.weight };
      })
      .filter(Boolean) as Array<{ value: number; weight: number }>,
  );
  const turnovers = weightedAverage(
    withStats
      .map((c) => {
        const v =
          firstNum(c.stats!.sections, [
            ["defence", "turnovers_won"],
            ["summary", "turnovers_won"],
          ]) ?? c.stats!.turnoversWon;
        return v == null ? null : { value: clamp(40 + v * 8), weight: c.weight };
      })
      .filter(Boolean) as Array<{ value: number; weight: number }>,
  );
  const missed = weightedAverage(
    withStats
      .map((c) => {
        const v = firstNum(c.stats!.sections, [["defence", "tackles_missed"]]);
        return v == null ? null : { value: clamp(100 - v * 1.2), weight: c.weight };
      })
      .filter(Boolean) as Array<{ value: number; weight: number }>,
  );

  const parts = renormalise([
    { key: "points_conceded", score: paScore, weight: 45 },
    { key: "tackle_success", score: tacklePct, weight: 30 },
    { key: "turnovers_won", score: turnovers, weight: 15 },
    { key: "missed_tackles", score: missed, weight: 10 },
  ]);

  const dataCoverage = clamp(
    ((paScore != null ? 45 : 0) +
      (tacklePct != null ? 30 : 0) +
      (turnovers != null ? 15 : 0) +
      (missed != null ? 10 : 0)) /
      100 *
      100,
  );

  return mkMetric("defence", parts.score, {
    confidence: coverageBand(Math.max(dataCoverage, resultCoverage * 0.5)).confidence,
    sampleSize: ctx.length,
    dataCoverage: Math.max(dataCoverage, withStats.length ? coverage : 50),
    period: `last_${ctx.length}_matches`,
    components: {
      points_conceded_per_game: pa != null ? round1(pa) : null,
      tackle_success: tacklePct != null ? round1(tacklePct) : null,
      turnovers_won_score: turnovers != null ? round1(turnovers) : null,
      missed_tackles_score: missed != null ? round1(missed) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: coverageBand(Math.max(dataCoverage, 50)).status,
  });
}

function calcSetPiece(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withStats = ctx.filter((c) => c.stats);
  const scrumVals: Array<{ value: number; weight: number }> = [];
  const lineoutVals: Array<{ value: number; weight: number }> = [];
  let haveSet = 0;
  for (const c of withStats) {
    const scrum = pctToScore(
      firstNum(c.stats!.sections, [
        ["set_piece", "scrums_success_percentage"],
        ["set_piece", "scrum_success_percentage"],
      ]),
    );
    const lineout = pctToScore(
      firstNum(c.stats!.sections, [
        ["set_piece", "lineout_success_percentage"],
        ["set_piece", "lineouts_success_percentage"],
      ]),
    );
    if (scrum != null || lineout != null) haveSet += 1;
    if (scrum != null) scrumVals.push({ value: scrum, weight: c.weight });
    if (lineout != null) lineoutVals.push({ value: lineout, weight: c.weight });
  }
  const scrumScore = weightedAverage(scrumVals);
  const lineoutScore = weightedAverage(lineoutVals);
  const parts = renormalise([
    { key: "scrum", score: scrumScore, weight: 45 },
    { key: "lineout", score: lineoutScore, weight: 45 },
    { key: "other", score: null, weight: 10 },
  ]);
  const coverage = ctx.length ? (haveSet / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);

  return mkMetric("set_piece", parts.score, {
    confidence: band.confidence,
    sampleSize: haveSet,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      scrum: scrumScore != null ? round1(scrumScore) : null,
      lineout: lineoutScore != null ? round1(lineoutScore) : null,
      maul: null,
    },
    availableInputs: parts.used,
    missingInputs: [...parts.missing, ...(scrumScore == null ? [] : []), "maul"],
    status: band.status,
    raw: { matchesWithSetPiece: haveSet },
  });
}

function calcBreakdown(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withStats = ctx.filter((c) => c.stats);
  let have = 0;
  const ruckVals: Array<{ value: number; weight: number }> = [];
  const toVals: Array<{ value: number; weight: number }> = [];
  for (const c of withStats) {
    const ruck = pctToScore(
      firstNum(c.stats!.sections, [["rucks", "rucks_success_percentage"]]),
    );
    const to =
      firstNum(c.stats!.sections, [
        ["defence", "turnovers_won"],
        ["summary", "turnovers_won"],
        ["rucks", "turnovers_won"],
      ]) ?? c.stats!.turnoversWon;
    if (ruck != null || to != null) have += 1;
    if (ruck != null) ruckVals.push({ value: ruck, weight: c.weight });
    if (to != null) toVals.push({ value: clamp(40 + to * 9), weight: c.weight });
  }
  const parts = renormalise([
    { key: "ruck_success", score: weightedAverage(ruckVals), weight: 55 },
    { key: "turnovers_won", score: weightedAverage(toVals), weight: 45 },
  ]);
  const coverage = ctx.length ? (have / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  return mkMetric("breakdown", parts.score, {
    confidence: band.confidence,
    sampleSize: have,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      ruck_success: parts.score != null ? round1(weightedAverage(ruckVals) ?? 0) : null,
      turnovers_won: weightedAverage(toVals) != null ? round1(weightedAverage(toVals)!) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: band.status,
  });
}

function calcKicking(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withStats = ctx.filter((c) => c.stats);
  let have = 0;
  const goalVals: Array<{ value: number; weight: number }> = [];
  const metresVals: Array<{ value: number; weight: number }> = [];
  for (const c of withStats) {
    const goalRaw = firstNum(c.stats!.sections, [
      ["kicking", "kicking_success_percentage"],
      ["kicking", "goal_kick_percentage"],
    ]);
    // SDMS sometimes stores odd scales; prefer conversion count proxy when % looks wrong
    let goal = pctToScore(goalRaw);
    if (goal != null && goal < 30) {
      // likely not a true goal % — treat as weak signal
      goal = clamp(50 + goal / 2);
    }
    const metres = firstNum(c.stats!.sections, [
      ["kicking", "kicking_metres"],
      ["kicking", "metres"],
      ["kicking", "kick_metres"],
    ]);
    if (goal != null || metres != null) have += 1;
    if (goal != null) goalVals.push({ value: goal, weight: c.weight });
    if (metres != null) metresVals.push({ value: clamp(35 + metres / 12), weight: c.weight });
  }
  const parts = renormalise([
    { key: "place_kicking", score: weightedAverage(goalVals), weight: 45 },
    { key: "tactical_kicking", score: weightedAverage(metresVals), weight: 55 },
  ]);
  const coverage = ctx.length ? (have / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  return mkMetric("kicking", parts.score, {
    confidence: band.confidence,
    sampleSize: have,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      place_kicking: weightedAverage(goalVals) != null ? round1(weightedAverage(goalVals)!) : null,
      tactical_kicking:
        weightedAverage(metresVals) != null ? round1(weightedAverage(metresVals)!) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: band.status,
  });
}

function calcDiscipline(ctx: MatchContext[]): CoachIntelligenceMetric {
  let have = 0;
  const scores: Array<{ value: number; weight: number }> = [];
  for (const c of ctx) {
    const pens = c.stats
      ? firstNum(c.stats.sections, [
          ["summary", "penalties"],
          ["discipline", "penalties_conceded"],
          ["cms_metrics", "penalties_conceded"],
        ])
      : null;
    const hasCardData = c.yellowCards > 0 || c.redCards > 0 || pens != null;
    if (!hasCardData && !c.stats) continue;
    have += 1;
    const penScore = pens != null ? clamp(100 - pens * 5) : 70;
    const cardPenalty = c.yellowCards * 8 + c.redCards * 22;
    scores.push({ value: clamp(penScore - cardPenalty), weight: c.weight });
  }
  const score = weightedAverage(scores);
  const coverage = ctx.length ? (have / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  return mkMetric("discipline", score, {
    confidence: band.confidence,
    sampleSize: have,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      discipline_score: score != null ? round1(score) : null,
    },
    availableInputs: score != null ? ["penalties", "cards"] : [],
    missingInputs: score == null ? ["penalties", "cards"] : [],
    status: band.status,
    raw: {
      yellowCards: ctx.reduce((s, c) => s + c.yellowCards, 0),
      redCards: ctx.reduce((s, c) => s + c.redCards, 0),
    },
  });
}

function calcSelection(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withLineups = ctx.filter((c) => c.starters.length >= 13);
  const coverage = ctx.length ? (withLineups.length / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  if (withLineups.length < 3) {
    return mkMetric("selection", null, {
      confidence: band.confidence,
      sampleSize: withLineups.length,
      dataCoverage: coverage,
      period: `last_${ctx.length}_matches`,
      missingInputs: ["lineups"],
      status: "INSUFFICIENT",
    });
  }

  let changeSum = 0;
  let pairs = 0;
  let prev: Set<string> | null = null;
  for (const c of withLineups) {
    const set = new Set(c.starters);
    if (prev) {
      let diff = 0;
      for (const id of set) if (!prev.has(id)) diff += 1;
      changeSum += diff;
      pairs += 1;
    }
    prev = set;
  }
  const avgChanges = pairs ? changeSum / pairs : 0;
  // Ideal ~2–4 changes: stability + adaptation
  const stabilityScore = clamp(100 - Math.abs(avgChanges - 3) * 12);

  // Successful adaptation: when changes happen, did they win?
  const changeWins = withLineups.filter((c, i) => {
    if (i === 0) return false;
    const prevSet = new Set(withLineups[i - 1].starters);
    let diff = 0;
    for (const id of c.starters) if (!prevSet.has(id)) diff += 1;
    return diff >= 2 && c.match.result === "W";
  }).length;
  const changeGames = Math.max(1, withLineups.length - 1);
  const adaptScore = clamp(40 + (changeWins / changeGames) * 60);

  const parts = renormalise([
    { key: "stability", score: stabilityScore, weight: 55 },
    { key: "successful_adaptation", score: adaptScore, weight: 45 },
  ]);

  return mkMetric("selection", parts.score, {
    confidence: band.confidence,
    sampleSize: withLineups.length,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      avg_xv_changes: round1(avgChanges),
      stability: round1(stabilityScore),
      successful_adaptation: round1(adaptScore),
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: band.status,
  });
}

function calcGameManagement(ctx: MatchContext[]): CoachIntelligenceMetric {
  if (!ctx.length) {
    return mkMetric("game_management", null, {
      confidence: 0,
      sampleSize: 0,
      dataCoverage: 0,
      period: "last_0_matches",
      missingInputs: ["matches"],
    });
  }
  const close = ctx.filter((c) => Math.abs(c.match.margin) <= 7);
  const closeWr = close.length
    ? (close.filter((c) => c.match.result === "W").length / close.length) * 100
    : null;
  const wins = ctx.filter((c) => c.match.result === "W");
  const comebackProxy = ctx.filter((c) => c.match.result === "W" && c.match.margin <= 5).length;
  const tightWinScore = closeWr;
  const clutchScore = clamp(50 + (comebackProxy / Math.max(1, wins.length || ctx.length)) * 50);
  const parts = renormalise([
    { key: "close_match_win_rate", score: tightWinScore, weight: 60 },
    { key: "clutch_wins", score: clutchScore, weight: 40 },
  ]);
  return mkMetric("game_management", parts.score, {
    confidence: coverageBand(ctx.length >= 8 ? 85 : (ctx.length / 20) * 100).confidence,
    sampleSize: ctx.length,
    dataCoverage: clamp((ctx.length / INTELLIGENCE_WINDOW) * 100),
    period: `last_${ctx.length}_matches`,
    components: {
      close_matches: close.length,
      close_win_rate: closeWr != null ? round1(closeWr) : null,
      clutch_score: round1(clutchScore),
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: ctx.length < 3 ? "INSUFFICIENT" : "CURRENT",
  });
}

function calcBenchImpact(ctx: MatchContext[]): CoachIntelligenceMetric {
  const usable = ctx.filter((c) => c.benchRatings.length >= 2 && c.starterRatings.length >= 5);
  const coverage = ctx.length ? (usable.length / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  if (usable.length < 3) {
    return mkMetric("bench_impact", null, {
      confidence: band.confidence,
      sampleSize: usable.length,
      dataCoverage: coverage,
      period: `last_${ctx.length}_matches`,
      missingInputs: ["bench_ratings"],
      status: "INSUFFICIENT",
    });
  }
  const scores = usable.map((c) => {
    const starterAvg = c.starterRatings.reduce((a, b) => a + b, 0) / c.starterRatings.length;
    const benchAvg = c.benchRatings.reduce((a, b) => a + b, 0) / c.benchRatings.length;
    // Bench close to starters = strong depth impact; win bonus
    const ratio = starterAvg > 0 ? (benchAvg / starterAvg) * 100 : 50;
    const winBoost = c.match.result === "W" ? 8 : c.match.result === "D" ? 2 : -5;
    return { value: clamp(ratio * 0.85 + winBoost), weight: c.weight };
  });
  const score = weightedAverage(scores);
  return mkMetric("bench_impact", score, {
    confidence: band.confidence,
    sampleSize: usable.length,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: { bench_vs_starter_index: score != null ? round1(score) : null },
    availableInputs: score != null ? ["bench_ratings", "starter_ratings"] : [],
    missingInputs: score == null ? ["bench_ratings"] : [],
    status: band.status,
  });
}

function calcPlayerDevelopment(
  ctx: MatchContext[],
  careerMatches: CoachEligibleMatch[],
  developmentScore: number | null,
  developmentMeta: {
    confidence: number;
    sampleSize: number;
    coverage: number;
    components: Record<string, number | null>;
  } | null,
): CoachIntelligenceMetric {
  // Prefer CoachPlayerDevelopmentEngine coach-level score when available.
  if (developmentScore != null && developmentMeta) {
    const band = coverageBand(developmentMeta.coverage);
    return mkMetric("player_development", developmentScore, {
      confidence: Math.round(
        (developmentMeta.confidence + band.confidence) / 2,
      ),
      sampleSize: developmentMeta.sampleSize,
      dataCoverage: developmentMeta.coverage,
      period: `player_development_engine`,
      components: developmentMeta.components,
      availableInputs: ["player_match_ratings", "coach_player_development_v1"],
      missingInputs: [],
      status: band.status,
      raw: { careerMatches: careerMatches.length, engine: "coach-player-development-v1" },
    });
  }

  const withRatings = ctx.filter((c) => c.starterRatings.length + c.benchRatings.length >= 5);
  const coverage = ctx.length ? (withRatings.length / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  if (withRatings.length < 5) {
    return mkMetric("player_development", null, {
      confidence: band.confidence,
      sampleSize: withRatings.length,
      dataCoverage: coverage,
      period: `last_${ctx.length}_matches`,
      missingInputs: ["player_ratings"],
      status: "INSUFFICIENT",
    });
  }

  // Fallback: squad early/late average when per-player engine has insufficient rows.
  const half = Math.floor(withRatings.length / 2);
  const early = withRatings.slice(0, half);
  const late = withRatings.slice(half);
  const avgAll = (rows: MatchContext[]) => {
    const vals = rows.flatMap((c) => [...c.starterRatings, ...c.benchRatings]);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const earlyAvg = avgAll(early);
  const lateAvg = avgAll(late);
  let score: number | null = null;
  if (earlyAvg != null && lateAvg != null) {
    const delta = lateAvg - earlyAvg;
    score = clamp(55 + delta * 25);
  } else {
    const overall = avgAll(withRatings);
    score = overall != null ? clamp(40 + overall * 6) : null;
  }

  return mkMetric("player_development", score, {
    confidence: band.confidence,
    sampleSize: withRatings.length,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      early_avg_rating: earlyAvg != null ? round1(earlyAvg) : null,
      late_avg_rating: lateAvg != null ? round1(lateAvg) : null,
    },
    availableInputs: score != null ? ["player_ratings"] : [],
    missingInputs: score == null ? ["player_ratings"] : [],
    status: band.status,
    raw: { careerMatches: careerMatches.length, engine: "fallback_squad_trend" },
  });
}

function calcSquadDepth(ctx: MatchContext[]): CoachIntelligenceMetric {
  const withLineups = ctx.filter((c) => c.starters.length >= 13);
  const coverage = ctx.length ? (withLineups.length / ctx.length) * 100 : 0;
  const band = coverageBand(coverage);
  if (withLineups.length < 5) {
    return mkMetric("squad_depth", null, {
      confidence: band.confidence,
      sampleSize: withLineups.length,
      dataCoverage: coverage,
      period: `last_${ctx.length}_matches`,
      missingInputs: ["lineups"],
      status: "INSUFFICIENT",
    });
  }
  const players = new Set(withLineups.flatMap((c) => [...c.starters, ...c.bench]));
  const uniqueScore = clamp(40 + players.size * 1.1);
  const withRatings = withLineups.filter((c) => c.benchRatings.length && c.starterRatings.length);
  let dropScore: number | null = null;
  if (withRatings.length >= 3) {
    const drops = withRatings.map((c) => {
      const s = c.starterRatings.reduce((a, b) => a + b, 0) / c.starterRatings.length;
      const b = c.benchRatings.reduce((a, b) => a + b, 0) / c.benchRatings.length;
      return clamp(100 - Math.max(0, s - b) * 18);
    });
    dropScore = drops.reduce((a, b) => a + b, 0) / drops.length;
  }
  const parts = renormalise([
    { key: "players_used", score: uniqueScore, weight: 50 },
    { key: "replacement_quality", score: dropScore, weight: 50 },
  ]);
  return mkMetric("squad_depth", parts.score, {
    confidence: band.confidence,
    sampleSize: withLineups.length,
    dataCoverage: coverage,
    period: `last_${ctx.length}_matches`,
    components: {
      players_used: players.size,
      unique_player_score: round1(uniqueScore),
      replacement_quality: dropScore != null ? round1(dropScore) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: band.status,
  });
}

function calcBigMatch(ctx: MatchContext[]): CoachIntelligenceMetric {
  const big = ctx.filter((c) => c.isBigMatch);
  const coverage = ctx.length ? Math.max(40, (big.length / Math.max(1, ctx.length)) * 100) : 0;
  if (big.length < 2) {
    // Fall back to all matches vs top opponents / results quality
    const results = calcResults(ctx);
    return mkMetric("big_match_performance", results.score != null ? results.score * 0.95 : null, {
      confidence: Math.min(results.confidence, 60),
      sampleSize: big.length,
      dataCoverage: coverage,
      period: `last_${ctx.length}_matches`,
      components: { big_matches: big.length },
      availableInputs: results.score != null ? ["results_proxy"] : [],
      missingInputs: big.length < 2 ? ["big_matches"] : [],
      status: big.length === 0 ? "PARTIAL" : "PARTIAL",
      raw: { note: "Few explicitly tagged big matches — using quality-adjusted results proxy" },
    });
  }
  const wr = (big.filter((c) => c.match.result === "W").length / big.length) * 100;
  const opp = weightedAverage(
    big
      .filter((c) => c.opponentRank != null)
      .map((c) => ({
        value: clamp(100 - ((c.opponentRank as number) - 1) * 5),
        weight: 1,
      })),
  );
  const parts = renormalise([
    { key: "big_match_win_rate", score: wr, weight: 70 },
    { key: "opponent_strength", score: opp, weight: 30 },
  ]);
  return mkMetric("big_match_performance", parts.score, {
    confidence: coverageBand(Math.min(100, big.length * 15)).confidence,
    sampleSize: big.length,
    dataCoverage: clamp(big.length * 12),
    period: `last_${ctx.length}_matches`,
    components: {
      big_matches: big.length,
      win_rate: round1(wr),
      opponent_strength: opp != null ? round1(opp) : null,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: "CURRENT",
  });
}

function calcExperience(career: CoachEligibleMatch[]): CoachIntelligenceMetric {
  const record = computeCareerRecord(career);
  const matchScore = clamp(35 + Math.log10(Math.max(1, record.played)) * 32);
  const comps = new Set(
    career.map((m) => (m.competitionName || "").toLowerCase()).filter(Boolean),
  );
  const bigComps = [...comps].filter(
    (c) =>
      c.includes("world cup") ||
      c.includes("championship") ||
      c.includes("nations") ||
      c.includes("premiership") ||
      c.includes("united rugby") ||
      c.includes("currie"),
  ).length;
  const compScore = clamp(40 + bigComps * 8);
  const parts = renormalise([
    { key: "matches_coached", score: matchScore, weight: 70 },
    { key: "competition_breadth", score: compScore, weight: 30 },
  ]);
  return mkMetric("experience", parts.score, {
    confidence: record.played >= 20 ? 90 : record.played >= 8 ? 70 : 45,
    sampleSize: record.played,
    dataCoverage: record.played > 0 ? 100 : 0,
    period: "career",
    components: {
      matches_coached: record.played,
      competitions: comps.size,
    },
    availableInputs: parts.used,
    missingInputs: parts.missing,
    status: record.played < 3 ? "INSUFFICIENT" : "CURRENT",
  });
}

function calcCurrentForm(ctx: MatchContext[]): CoachIntelligenceMetric {
  const formCtx = ctx.filter((c) => c.formWeight > 0).slice(-8);
  if (!formCtx.length) {
    return mkMetric("current_form", null, {
      confidence: 0,
      sampleSize: 0,
      dataCoverage: 0,
      period: "last_0_matches",
      missingInputs: ["matches"],
    });
  }
  const score = weightedAverage(
    formCtx.map((c) => {
      const base = c.match.result === "W" ? 100 : c.match.result === "D" ? 45 : 0;
      const opp =
        c.opponentRank == null ? 0 : clamp((6 - c.opponentRank) * 2, -6, 12);
      const margin =
        c.match.result === "W" ? clamp(c.match.margin, 0, 20) * 0.4 : 0;
      return { value: clamp(base + opp + margin), weight: c.formWeight || c.weight };
    }),
  );
  return mkMetric("current_form", score, {
    confidence: formCtx.length >= 5 ? 88 : formCtx.length >= 3 ? 70 : 45,
    sampleSize: formCtx.length,
    dataCoverage: clamp((formCtx.length / 8) * 100),
    period: `last_${formCtx.length}_matches`,
    components: {
      form_string: formCtx.map((c) => c.match.result).join(""),
    },
    availableInputs: ["recent_results"],
    missingInputs: [],
    status: formCtx.length < 2 ? "INSUFFICIENT" : "CURRENT",
    raw: { form: formCtx.map((c) => c.match.result).join("") },
  });
}

/**
 * Calculate all 15 Coach Intelligence metrics for a coach.
 * Uses weighted recent window for current form metrics; career for experience.
 */
export async function calculateCoachIntelligence(
  coachId: string,
  options: { asOfDate?: Date | null } = {},
): Promise<CoachIntelligenceBundle> {
  const career = await loadCoachEligibleMatches(coachId, {
    primaryOnly: true,
    asOfDate: options.asOfDate ?? null,
  });
  const chronological = [...career].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );
  const ctx = await loadMatchContexts(chronological);

  let developmentScore: number | null = null;
  let developmentMeta: {
    confidence: number;
    sampleSize: number;
    coverage: number;
    components: Record<string, number | null>;
  } | null = null;
  try {
    const bundle = await getCoachPlayerDevelopmentBundle(coachId, { scope: "current_team" });
    developmentScore = bundle.coachDevelopmentScore;
    developmentMeta = {
      confidence:
        bundle.eligibleForDevelopment > 0
          ? Math.round(
              ((bundle.highConfidence * 90 + bundle.mediumConfidence * 65) /
                Math.max(bundle.eligibleForDevelopment, 1)) ||
                45,
            )
          : 30,
      sampleSize: bundle.eligibleForDevelopment,
      coverage: bundle.ratedAppearanceCoveragePct ?? 0,
      components: bundle.coachDevelopmentComponents,
    };
  } catch {
    // Fall back to squad early/late trend inside calcPlayerDevelopment.
  }

  const metrics: CoachIntelligenceMetric[] = [
    calcResults(ctx),
    calcAttack(ctx),
    calcDefence(ctx),
    calcSetPiece(ctx),
    calcBreakdown(ctx),
    calcKicking(ctx),
    calcDiscipline(ctx),
    calcSelection(ctx),
    calcGameManagement(ctx),
    calcBenchImpact(ctx),
    calcPlayerDevelopment(ctx, chronological, developmentScore, developmentMeta),
    calcSquadDepth(ctx),
    calcBigMatch(ctx),
    calcExperience(chronological),
    calcCurrentForm(ctx),
  ];

  // Ensure stable order matching COACH_INTELLIGENCE_METRICS
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const ordered = COACH_INTELLIGENCE_METRICS.map(
    (k) => byKey.get(k) ?? mkMetric(k, null, { confidence: 0, sampleSize: 0, dataCoverage: 0, period: "n/a" }),
  );

  return {
    coachId,
    metrics: ordered,
    modelVersion: COACH_INTELLIGENCE_VERSION,
    period: `last_${Math.min(INTELLIGENCE_WINDOW, chronological.length)}_eligible_matches`,
    matchWindow: INTELLIGENCE_WINDOW,
    matchesUsed: ctx.length,
    calculatedAt: new Date().toISOString(),
  };
}

/** Attach per-metric world ranks from peer snapshots (eligible coaches only). */
export function applyMetricWorldRanks(
  metrics: CoachIntelligenceMetric[],
  peerMetricScores: Array<{ coachId: string; metrics: Array<{ key: string; score: number | null; confidence?: number; sampleSize?: number }> }>,
  coachId: string,
): CoachIntelligenceMetric[] {
  return metrics.map((m) => {
    if (m.score == null || m.confidence < MIN_RANK_CONFIDENCE || m.sampleSize < MIN_RANK_MATCHES) {
      return { ...m, worldRank: null };
    }
    const peers: Array<{ coachId: string; score: number }> = [];
    for (const peer of peerMetricScores) {
      const pm = peer.metrics.find((x) => x.key === m.key);
      if (
        pm?.score != null &&
        (pm.confidence ?? 100) >= MIN_RANK_CONFIDENCE &&
        (pm.sampleSize ?? 99) >= MIN_RANK_MATCHES
      ) {
        peers.push({ coachId: peer.coachId, score: pm.score });
      }
    }
    // Ensure self included
    if (!peers.some((p) => p.coachId === coachId)) {
      peers.push({ coachId, score: m.score });
    }
    if (peers.length < 2) return { ...m, worldRank: null };
    peers.sort((a, b) => b.score - a.score);
    const idx = peers.findIndex((p) => p.coachId === coachId);
    return { ...m, worldRank: idx >= 0 ? idx + 1 : null };
  });
}

/** Convert intelligence metrics to legacy CoachMetricScore shape for Power Index. */
export function intelligenceToLegacyMetrics(
  metrics: CoachIntelligenceMetric[],
): CoachMetricScore[] {
  return metrics.map((m) => ({
    key: m.key,
    label: m.label,
    score: m.score,
    worldRank: m.worldRank,
    raw: {
      ...m.raw,
      confidence: m.confidence,
      sampleSize: m.sampleSize,
      dataCoverage: m.dataCoverage,
      status: m.status,
    },
  }));
}
