/**
 * PlayerIntelligenceEngine — position-aware 0–100 dimensions.
 * First config: FLY_HALF (player-fly-half-v1).
 *
 * Missing inputs are excluded and weights renormalised — never forced to 0.
 */

export const PLAYER_FLY_HALF_MODEL = "player-fly-half-v1";

export type PlayerPositionFamily = "fly_half" | "generic";

export type PlayerIntelKey =
  | "kicking"
  | "game_management"
  | "playmaking"
  | "attack"
  | "defence"
  | "physical"
  | "current_form";

export const FLY_HALF_WEIGHTS_V1: Record<PlayerIntelKey, number> = {
  kicking: 22,
  game_management: 20,
  playmaking: 18,
  attack: 15,
  defence: 10,
  physical: 8,
  current_form: 7,
};

export const PLAYER_INTEL_LABELS: Record<PlayerIntelKey, string> = {
  kicking: "Kicking",
  game_management: "Game Management",
  playmaking: "Playmaking",
  attack: "Attack",
  defence: "Defence",
  physical: "Physical",
  current_form: "Current Form",
};

export type PlayerIntelMetric = {
  key: PlayerIntelKey;
  label: string;
  score: number | null;
  weight: number;
  nominalWeight: number;
  contribution: number | null;
  confidence: number;
  coverage: number;
  sampleSize: number;
  availableInputs: string[];
  missingInputs: string[];
};

export type PlayerIntelligenceResult = {
  modelVersion: string;
  positionFamily: PlayerPositionFamily;
  overallRating: number | null;
  metrics: PlayerIntelMetric[];
  confidence: number;
  coverage: number;
  dataPoints: number;
  reweighted: boolean;
  excludedKeys: PlayerIntelKey[];
};

export type FlyHalfMatchSample = {
  fixtureId: string;
  matchDate: string | null;
  competitionName: string | null;
  minutesPlayed: number;
  points: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  tryAssists: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  lineBreaks: number;
  defendersBeaten: number;
  matchRating: number | null;
  kicks: number;
  kicksFromHand: number;
  kickFromHandMetres: number;
  kickPossessionRetained: number;
  passes: number;
  offloads: number;
  badPasses: number;
  handlingError: number;
  turnoversConceded: number;
  missedTackles: number;
  result: "W" | "D" | "L" | null;
  majorMatchLabel: string | null;
  isCloseMatch: boolean;
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function detectMajorMatchLabel(competitionName: string | null | undefined): string | null {
  const c = (competitionName ?? "").toLowerCase();
  if (!c) return null;
  if (c.includes("world cup") && c.includes("final")) return "World Cup Final";
  if (c.includes("world cup") && (c.includes("semi") || c.includes("quarter"))) {
    return "World Cup Knockout";
  }
  if (c.includes("world cup")) return "World Cup";
  if (c.includes("rugby championship") || c.includes("the rugby championship")) {
    return "Rugby Championship";
  }
  if (c.includes("nations championship") || c.includes("six nations")) {
    return "Major International";
  }
  if (
    (c.includes("champions cup") || c.includes("european")) &&
    (c.includes("final") || c.includes("semi") || c.includes("quarter"))
  ) {
    return "European Knockout";
  }
  if ((c.includes("prem") || c.includes("currie") || c.includes("urc")) && c.includes("final")) {
    return "Domestic Final";
  }
  if (c.includes("international")) return "Major International";
  return null;
}

function scoreKicking(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const available: string[] = [];
  const missing: string[] = [];
  const withBoot = matches.filter((m) => m.conversions + m.penalties + m.dropGoals > 0 || m.points > 0);
  const withTactical = matches.filter((m) => m.kicksFromHand > 0 || m.kickFromHandMetres > 0);

  if (withBoot.length) available.push("goal_kicking_volume", "points_from_boot");
  else missing.push("goal_kicking_volume");
  if (withTactical.length) available.push("tactical_kicking", "kick_metres");
  else missing.push("tactical_kicking");

  const bootPoints = matches.reduce(
    (s, m) => s + m.conversions * 2 + m.penalties * 3 + m.dropGoals * 3,
    0,
  );
  const apps = Math.max(matches.length, 1);
  const bootPerGame = bootPoints / apps;
  const kickMetres = matches.reduce((s, m) => s + m.kickFromHandMetres, 0);
  const kicks = matches.reduce((s, m) => s + Math.max(m.kicksFromHand, m.kicks), 0);
  const metresPerKick = kicks > 0 ? kickMetres / kicks : null;
  const retainRate =
    kicks > 0
      ? matches.reduce((s, m) => s + m.kickPossessionRetained, 0) / kicks
      : null;

  let score: number | null = null;
  if (available.length) {
    const goalPart = clamp(48 + bootPerGame * 4.2);
    const tacticalPart =
      metresPerKick != null ? clamp(45 + metresPerKick * 0.22 + (retainRate ?? 0) * 12) : null;
    if (tacticalPart != null) score = round1(goalPart * 0.62 + tacticalPart * 0.38);
    else score = round1(goalPart);
  }

  const coverage = Math.round((available.length / (available.length + missing.length || 1)) * 100);
  const confidence = clamp(
    35 + withBoot.length * 3 + withTactical.length * 2 + (metresPerKick != null ? 8 : 0),
  );

  return {
    key: "kicking",
    label: PLAYER_INTEL_LABELS.kicking,
    score,
    confidence: Math.round(confidence),
    coverage,
    sampleSize: matches.length,
    availableInputs: available,
    missingInputs: missing,
  };
}

function scorePlaymaking(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const available: string[] = [];
  const missing: string[] = [];
  const hasPasses = matches.some((m) => m.passes > 0);
  const hasAssists = matches.some((m) => m.tryAssists > 0);
  const hasOffloads = matches.some((m) => m.offloads > 0);
  const hasBreaks = matches.some((m) => m.lineBreaks > 0);

  if (hasPasses) available.push("passes");
  else missing.push("passes");
  if (hasAssists) available.push("try_assists");
  else missing.push("try_assists");
  if (hasOffloads) available.push("offloads");
  else missing.push("offloads");
  if (hasBreaks) available.push("line_breaks");
  else missing.push("line_breaks");

  const apps = Math.max(matches.length, 1);
  const passesPg = matches.reduce((s, m) => s + m.passes, 0) / apps;
  const assistsPg = matches.reduce((s, m) => s + m.tryAssists, 0) / apps;
  const offloadsPg = matches.reduce((s, m) => s + m.offloads, 0) / apps;
  const breaksPg = matches.reduce((s, m) => s + m.lineBreaks, 0) / apps;
  const badPassRate =
    matches.reduce((s, m) => s + m.passes, 0) > 0
      ? matches.reduce((s, m) => s + m.badPasses, 0) / matches.reduce((s, m) => s + m.passes, 0)
      : 0;

  let score: number | null = null;
  if (available.length) {
    score = round1(
      clamp(
        46 +
          passesPg * 1.1 +
          assistsPg * 14 +
          offloadsPg * 6 +
          breaksPg * 8 -
          badPassRate * 25,
      ),
    );
  }

  return {
    key: "playmaking",
    label: PLAYER_INTEL_LABELS.playmaking,
    score,
    confidence: clamp(30 + available.length * 12 + matches.length),
    coverage: Math.round((available.length / 4) * 100),
    sampleSize: matches.length,
    availableInputs: available,
    missingInputs: missing,
  };
}

function scoreGameManagement(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const available: string[] = [];
  const missing: string[] = [];
  const rated = matches.filter((m) => m.matchRating != null);
  const close = matches.filter((m) => m.isCloseMatch);
  const big = matches.filter((m) => m.majorMatchLabel);
  const withResult = matches.filter((m) => m.result);

  if (rated.length) available.push("match_rating");
  else missing.push("match_rating");
  if (close.length) available.push("close_match_context");
  else missing.push("close_match_context");
  if (big.length) available.push("big_match_context");
  else missing.push("big_match_context");
  if (withResult.length) available.push("result_context");
  else missing.push("result_context");

  const avgRating = avg(rated.map((m) => m.matchRating!));
  const closeAvg = avg(close.filter((m) => m.matchRating != null).map((m) => m.matchRating!));
  const bigAvg = avg(big.filter((m) => m.matchRating != null).map((m) => m.matchRating!));
  const winRate =
    withResult.length > 0
      ? withResult.filter((m) => m.result === "W").length / withResult.length
      : null;
  const bootPoints = matches.reduce(
    (s, m) => s + m.conversions * 2 + m.penalties * 3 + m.dropGoals * 3,
    0,
  );
  const errorsPg =
    matches.reduce((s, m) => s + m.handlingError + m.turnoversConceded, 0) /
    Math.max(matches.length, 1);

  let score: number | null = null;
  if (available.length) {
    const ratingPart = avgRating != null ? clamp(avgRating * 10) : 55;
    const closePart = closeAvg != null ? clamp(closeAvg * 10) : ratingPart;
    const bigPart = bigAvg != null ? clamp(bigAvg * 10) : ratingPart;
    const resultPart = winRate != null ? clamp(40 + winRate * 45) : 55;
    const pointsPart = clamp(48 + bootPoints / Math.max(matches.length, 1) * 3.5);
    score = round1(
      clamp(
        ratingPart * 0.28 +
          closePart * 0.18 +
          bigPart * 0.18 +
          resultPart * 0.18 +
          pointsPart * 0.12 -
          errorsPg * 4,
      ),
    );
  }

  return {
    key: "game_management",
    label: PLAYER_INTEL_LABELS.game_management,
    score,
    confidence: clamp(28 + available.length * 14 + rated.length),
    coverage: Math.round((available.length / 4) * 100),
    sampleSize: matches.length,
    availableInputs: available,
    missingInputs: missing,
  };
}

function scoreAttack(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const apps = Math.max(matches.length, 1);
  const metresPg = matches.reduce((s, m) => s + m.metresCarried, 0) / apps;
  const breaksPg = matches.reduce((s, m) => s + m.lineBreaks, 0) / apps;
  const beatenPg = matches.reduce((s, m) => s + m.defendersBeaten, 0) / apps;
  const triesPg = matches.reduce((s, m) => s + m.tries, 0) / apps;
  const score = round1(clamp(48 + metresPg * 0.35 + breaksPg * 10 + beatenPg * 4 + triesPg * 12));
  return {
    key: "attack",
    label: PLAYER_INTEL_LABELS.attack,
    score: matches.length ? score : null,
    confidence: matches.length ? clamp(40 + matches.length * 2) : 0,
    coverage: matches.length ? 70 : 0,
    sampleSize: matches.length,
    availableInputs: matches.length ? ["metres", "line_breaks", "defenders_beaten", "tries"] : [],
    missingInputs: matches.length ? [] : ["match_stats"],
  };
}

function scoreDefence(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const apps = Math.max(matches.length, 1);
  const tacklesPg = matches.reduce((s, m) => s + m.tacklesMade, 0) / apps;
  const missedPg = matches.reduce((s, m) => s + m.missedTackles, 0) / apps;
  const completed = matches.reduce((s, m) => s + m.tacklesCompleted, 0);
  const made = matches.reduce((s, m) => s + m.tacklesMade, 0);
  const completion = made > 0 ? completed / made : null;
  const score = round1(
    clamp(50 + tacklesPg * 3.5 - missedPg * 5 + (completion != null ? completion * 15 : 0)),
  );
  return {
    key: "defence",
    label: PLAYER_INTEL_LABELS.defence,
    score: matches.length ? score : null,
    confidence: matches.length ? clamp(38 + matches.length * 2) : 0,
    coverage: matches.length ? 65 : 0,
    sampleSize: matches.length,
    availableInputs: matches.length ? ["tackles", "missed_tackles"] : [],
    missingInputs: matches.length ? [] : ["match_stats"],
  };
}

function scorePhysical(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const apps = Math.max(matches.length, 1);
  const minsPg = matches.reduce((s, m) => s + m.minutesPlayed, 0) / apps;
  const metresPg = matches.reduce((s, m) => s + m.metresCarried, 0) / apps;
  const score = round1(clamp(42 + Math.min(minsPg, 80) * 0.35 + metresPg * 0.25));
  return {
    key: "physical",
    label: PLAYER_INTEL_LABELS.physical,
    score: matches.length ? score : null,
    confidence: matches.length ? clamp(30 + matches.length) : 0,
    coverage: matches.length ? 55 : 0,
    sampleSize: matches.length,
    availableInputs: matches.length ? ["minutes", "metres"] : [],
    missingInputs: matches.length ? ["gps_load", "collision_dominance"] : ["match_stats"],
  };
}

function scoreForm(matches: FlyHalfMatchSample[]): Omit<PlayerIntelMetric, "weight" | "nominalWeight" | "contribution"> {
  const recent = [...matches]
    .sort((a, b) => String(b.matchDate ?? "").localeCompare(String(a.matchDate ?? "")))
    .slice(0, 5);
  const ratings = recent.map((m) => m.matchRating).filter((r): r is number => r != null);
  const score = ratings.length ? round1(clamp(avg(ratings)! * 10)) : null;
  return {
    key: "current_form",
    label: PLAYER_INTEL_LABELS.current_form,
    score,
    confidence: ratings.length ? clamp(40 + ratings.length * 10) : 0,
    coverage: ratings.length ? Math.round((ratings.length / 5) * 100) : 0,
    sampleSize: ratings.length,
    availableInputs: ratings.length ? ["recent_match_ratings"] : [],
    missingInputs: ratings.length ? [] : ["recent_match_ratings"],
  };
}

export function computePlayerIntelligence(input: {
  positionFamily: PlayerPositionFamily;
  matches: FlyHalfMatchSample[];
}): PlayerIntelligenceResult {
  const weights =
    input.positionFamily === "fly_half" ? FLY_HALF_WEIGHTS_V1 : FLY_HALF_WEIGHTS_V1;
  const modelVersion =
    input.positionFamily === "fly_half" ? PLAYER_FLY_HALF_MODEL : "player-generic-v1";

  const raw = [
    scoreKicking(input.matches),
    scoreGameManagement(input.matches),
    scorePlaymaking(input.matches),
    scoreAttack(input.matches),
    scoreDefence(input.matches),
    scorePhysical(input.matches),
    scoreForm(input.matches),
  ];

  const present = raw.filter((m) => m.score != null);
  const excluded = raw.filter((m) => m.score == null).map((m) => m.key);
  const presentWeight = present.reduce((s, m) => s + weights[m.key], 0);
  const reweighted = presentWeight > 0 && presentWeight < 100;

  const metrics: PlayerIntelMetric[] = raw.map((m) => {
    const nominal = weights[m.key];
    const weight =
      m.score == null || presentWeight <= 0
        ? 0
        : Math.round((nominal / presentWeight) * 1000) / 10;
    const contribution =
      m.score != null && weight > 0 ? round1((m.score * weight) / 100) : null;
    return {
      ...m,
      weight,
      nominalWeight: nominal,
      contribution,
    };
  });

  const overall =
    present.length === 0
      ? null
      : round1(metrics.reduce((s, m) => s + (m.contribution ?? 0), 0));

  const confidence = present.length
    ? Math.round(present.reduce((s, m) => s + m.confidence, 0) / present.length)
    : 0;
  const coverage = present.length
    ? Math.round(present.reduce((s, m) => s + m.coverage, 0) / present.length)
    : 0;

  return {
    modelVersion,
    positionFamily: input.positionFamily,
    overallRating: overall,
    metrics,
    confidence,
    coverage,
    dataPoints: input.matches.length,
    reweighted,
    excludedKeys: excluded,
  };
}

export function resolvePlayerPositionFamily(positionName: string | null | undefined): PlayerPositionFamily {
  const p = (positionName ?? "").toLowerCase();
  if (p.includes("fly") || p.includes("10") || p.includes("out-half") || p.includes("outhalf")) {
    return "fly_half";
  }
  return "generic";
}
