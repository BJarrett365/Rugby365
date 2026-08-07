/**
 * Deterministic historical RWC player-stat estimator.
 *
 * Used when Opta/SDMS per-match advanced stats do not exist (e.g. RWC 1987).
 * Estimates are derived from modern RWC (2011–2023) position averages, scaled by
 * official match scores, minutes, role, try involvement, and team strength — not random draws.
 */

export const ESTIMATOR_METHOD = "rwc_historical_position_prior_v1";
export const ESTIMATOR_PROVIDER = "ai_algorithm_estimate";
export const ESTIMATOR_PRIOR_YEARS = [2011, 2015, 2019, 2023] as const;
/** Pre-professional era contact/volume tempering vs modern Opta baselines. */
export const ERA_INTENSITY_FACTOR = 0.82;

export type PositionPrior80 = {
  jersey: number;
  sampleSize: number;
  tackles: number;
  metres: number;
  carries: number;
  lineBreaks: number;
  defendersBeaten: number;
  turnoversWon: number;
  tryAssists: number;
  dominantTackles: number;
  postContactMetres: number;
  touches: number;
};

/** Heuristic extras per 80 mins by jersey when modern samples lack passes/kicks/offloads. */
export type JerseyExtras80 = {
  passes: number;
  offloads: number;
  kicksFromHand: number;
  lineoutTakes: number;
  scrumInvolvements: number;
};

export type EstimatePlayerInput = {
  jerseyNumber: number | null;
  positionName: string | null;
  squadRole: string;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
  teamScore: number;
  oppositionScore: number;
  teamStrength: number;
  oppositionStrength: number;
  /** Explicit minutes when known; otherwise inferred from role/jersey. */
  minutesPlayed?: number | null;
};

export type EstimatedMatchStats = {
  minutesPlayed: number;
  tacklesCompleted: number;
  tacklesMade: number;
  metresCarried: number;
  carries: number;
  lineBreaks: number;
  defendersBeaten: number;
  turnoversWon: number;
  tryAssists: number;
  dominantTackles: number;
  postContactMetres: number;
  touches: number;
  passes: number;
  offloads: number;
  kicksFromHand: number;
  kicks: number;
  lineoutTakes: number;
  scrumInvolvements: number;
  confidence: number;
  confidenceByMetric: Record<string, number>;
  reasoning: string;
  jerseyUsed: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundStat(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n));
}

export function inferJerseyFromPosition(positionName: string | null | undefined): number | null {
  const p = (positionName ?? "").toLowerCase();
  if (!p) return null;
  if (/(loosehead|tighthead|\bprop\b)/.test(p) && !/hook/.test(p)) return /tight/.test(p) ? 3 : 1;
  if (/hooker/.test(p)) return 2;
  if (/(lock|second\s*row|second\s*five.?eighth)/.test(p) && !/centre|center/.test(p)) return 4;
  if (/(blindside|openside|flanker)/.test(p)) return /open/.test(p) ? 7 : 6;
  if (/(number\s*8|no\.?\s*8|eighthman|eighth)/.test(p)) return 8;
  if (/(scrum.?half|half.?back)/.test(p)) return 9;
  if (/(fly.?half|first\s*five|out.?half|stand.?off)/.test(p)) return 10;
  if (/(inside\s*centre|second\s*five)/.test(p)) return 12;
  if (/(outside\s*centre|centre|center)/.test(p)) return 13;
  if (/(wing|winger)/.test(p)) return 14;
  if (/(full.?back)/.test(p)) return 15;
  return null;
}

export function resolveJersey(input: Pick<EstimatePlayerInput, "jerseyNumber" | "positionName" | "squadRole">) {
  if (input.jerseyNumber != null && input.jerseyNumber >= 1 && input.jerseyNumber <= 23) {
    return input.jerseyNumber;
  }
  const fromPos = inferJerseyFromPosition(input.positionName);
  if (fromPos != null) return fromPos;
  const role = input.squadRole.toLowerCase();
  if (role.includes("start")) return 12;
  return 20;
}

export function inferMinutes(input: Pick<EstimatePlayerInput, "jerseyNumber" | "squadRole" | "minutesPlayed">) {
  if (input.minutesPlayed != null && input.minutesPlayed > 0) {
    return clamp(Math.round(input.minutesPlayed), 1, 100);
  }
  const jersey = input.jerseyNumber;
  const role = input.squadRole.toLowerCase();
  if (jersey != null && jersey >= 1 && jersey <= 15) return 80;
  if (role.includes("start")) return 80;
  if (jersey != null && jersey >= 16 && jersey <= 23) {
    // 1987 benches were smaller; assume limited minutes unless known.
    return jersey <= 18 ? 25 : 15;
  }
  if (role.includes("sub") || role.includes("repl") || role.includes("bench")) return 20;
  return 40;
}

/** Fallback priors when a jersey has no modern sample (per-80). */
export const FALLBACK_PRIORS_80: Record<number, Omit<PositionPrior80, "jersey" | "sampleSize">> = {
  1: { tackles: 8, metres: 8, carries: 5, lineBreaks: 0.05, defendersBeaten: 0.3, turnoversWon: 0.2, tryAssists: 0.05, dominantTackles: 0.4, postContactMetres: 4, touches: 12 },
  2: { tackles: 9, metres: 10, carries: 6, lineBreaks: 0.08, defendersBeaten: 0.4, turnoversWon: 0.35, tryAssists: 0.05, dominantTackles: 0.5, postContactMetres: 5, touches: 18 },
  3: { tackles: 8, metres: 8, carries: 5, lineBreaks: 0.05, defendersBeaten: 0.3, turnoversWon: 0.2, tryAssists: 0.05, dominantTackles: 0.4, postContactMetres: 4, touches: 12 },
  4: { tackles: 10, metres: 18, carries: 8, lineBreaks: 0.15, defendersBeaten: 0.8, turnoversWon: 0.35, tryAssists: 0.08, dominantTackles: 0.6, postContactMetres: 9, touches: 16 },
  5: { tackles: 10, metres: 18, carries: 8, lineBreaks: 0.15, defendersBeaten: 0.8, turnoversWon: 0.35, tryAssists: 0.08, dominantTackles: 0.6, postContactMetres: 9, touches: 16 },
  6: { tackles: 12, metres: 28, carries: 9, lineBreaks: 0.25, defendersBeaten: 1.2, turnoversWon: 0.7, tryAssists: 0.1, dominantTackles: 0.8, postContactMetres: 12, touches: 16 },
  7: { tackles: 14, metres: 26, carries: 9, lineBreaks: 0.25, defendersBeaten: 1.3, turnoversWon: 1.0, tryAssists: 0.1, dominantTackles: 1.0, postContactMetres: 11, touches: 15 },
  8: { tackles: 11, metres: 40, carries: 11, lineBreaks: 0.45, defendersBeaten: 2.0, turnoversWon: 0.5, tryAssists: 0.15, dominantTackles: 0.7, postContactMetres: 16, touches: 18 },
  9: { tackles: 8, metres: 20, carries: 7, lineBreaks: 0.35, defendersBeaten: 1.4, turnoversWon: 0.6, tryAssists: 0.5, dominantTackles: 0.2, postContactMetres: 6, touches: 70 },
  10: { tackles: 7, metres: 38, carries: 8, lineBreaks: 0.3, defendersBeaten: 1.6, turnoversWon: 0.25, tryAssists: 0.25, dominantTackles: 0.2, postContactMetres: 10, touches: 26 },
  11: { tackles: 5, metres: 65, carries: 9, lineBreaks: 1.1, defendersBeaten: 3.4, turnoversWon: 0.25, tryAssists: 0.15, dominantTackles: 0.15, postContactMetres: 18, touches: 13 },
  12: { tackles: 9, metres: 32, carries: 9, lineBreaks: 0.4, defendersBeaten: 2.0, turnoversWon: 0.25, tryAssists: 0.3, dominantTackles: 0.3, postContactMetres: 12, touches: 17 },
  13: { tackles: 6, metres: 48, carries: 8, lineBreaks: 0.8, defendersBeaten: 2.0, turnoversWon: 0.3, tryAssists: 0.4, dominantTackles: 0.25, postContactMetres: 14, touches: 14 },
  14: { tackles: 5, metres: 70, carries: 9, lineBreaks: 1.5, defendersBeaten: 3.2, turnoversWon: 0.25, tryAssists: 0.35, dominantTackles: 0.15, postContactMetres: 18, touches: 14 },
  15: { tackles: 3, metres: 78, carries: 12, lineBreaks: 0.95, defendersBeaten: 3.0, turnoversWon: 0.35, tryAssists: 0.25, dominantTackles: 0.15, postContactMetres: 16, touches: 20 },
};

export function jerseyExtras80(jersey: number): JerseyExtras80 {
  const j = jersey >= 16 ? ((jersey - 15) % 8) + 1 : jersey;
  if (j === 9) return { passes: 68, offloads: 1.2, kicksFromHand: 6, lineoutTakes: 0, scrumInvolvements: 0 };
  if (j === 10) return { passes: 18, offloads: 1.5, kicksFromHand: 14, lineoutTakes: 0, scrumInvolvements: 0 };
  if (j === 15) return { passes: 6, offloads: 1.2, kicksFromHand: 8, lineoutTakes: 0, scrumInvolvements: 0 };
  if (j === 12 || j === 13) return { passes: 8, offloads: 1.4, kicksFromHand: 2, lineoutTakes: 0, scrumInvolvements: 0 };
  if (j === 11 || j === 14) return { passes: 3, offloads: 1.0, kicksFromHand: 2, lineoutTakes: 0, scrumInvolvements: 0 };
  if (j === 2) return { passes: 4, offloads: 0.4, kicksFromHand: 0, lineoutTakes: 8, scrumInvolvements: 14 };
  if (j === 4 || j === 5) return { passes: 3, offloads: 0.5, kicksFromHand: 0, lineoutTakes: 10, scrumInvolvements: 2 };
  if (j === 1 || j === 3) return { passes: 2, offloads: 0.3, kicksFromHand: 0, lineoutTakes: 1, scrumInvolvements: 16 };
  if (j >= 6 && j <= 8) return { passes: 4, offloads: 1.0, kicksFromHand: 0.2, lineoutTakes: 2, scrumInvolvements: 1 };
  return { passes: 3, offloads: 0.5, kicksFromHand: 0.5, lineoutTakes: 0, scrumInvolvements: 0 };
}

export function priorForJersey(jersey: number, priors: Map<number, PositionPrior80>): PositionPrior80 {
  const mapped = jersey >= 16 && jersey <= 23 ? (((jersey - 16) % 8) + 1) : jersey;
  const key = clamp(mapped, 1, 15);
  const found = priors.get(key);
  const fb = FALLBACK_PRIORS_80[key] ?? FALLBACK_PRIORS_80[12]!;
  if (!found) return { jersey: key, sampleSize: 0, ...fb };
  // Modern samples often omit uncommon Opta columns — fill zeros from heuristics.
  return {
    ...found,
    jersey: key,
    dominantTackles: found.dominantTackles > 0 ? found.dominantTackles : fb.dominantTackles,
    postContactMetres: found.postContactMetres > 0 ? found.postContactMetres : fb.postContactMetres,
    touches: found.touches > 0 ? found.touches : fb.touches,
  };
}

export function estimatePlayerMatchStats(
  input: EstimatePlayerInput,
  priors: Map<number, PositionPrior80>,
  options: { eraFactor?: number } = {},
): EstimatedMatchStats {
  const era = options.eraFactor ?? ERA_INTENSITY_FACTOR;
  const jersey = resolveJersey(input);
  const minutes = inferMinutes({ ...input, jerseyNumber: jersey });
  const prior = priorForJersey(jersey, priors);
  const extras = jerseyExtras80(jersey);
  const minuteScale = minutes / 80;

  const totalScore = Math.max(1, input.teamScore + input.oppositionScore);
  const scoreShare = input.teamScore / totalScore;
  const oppShare = input.oppositionScore / totalScore;
  const strengthRatio = clamp(
    (input.teamStrength + 0.15) / (input.oppositionStrength + 0.15),
    0.55,
    1.7,
  );
  const oppStrengthRatio = clamp(
    (input.oppositionStrength + 0.15) / (input.teamStrength + 0.15),
    0.55,
    1.7,
  );

  // Attack volume rises with score share + relative strength; defence rises when conceding.
  const attackMult = clamp(era * (0.72 + scoreShare * 0.55) * Math.sqrt(strengthRatio), 0.4, 1.55);
  const defenceMult = clamp(era * (0.78 + oppShare * 0.55) * Math.sqrt(oppStrengthRatio), 0.45, 1.6);

  const tryBoost = 1 + Math.min(3, Math.max(0, input.tries)) * 0.18;
  const kickerBoost = 1 + Math.min(8, input.penalties + input.dropGoals) * 0.03;

  const scaleAttack = minuteScale * attackMult * tryBoost;
  const scaleDefence = minuteScale * defenceMult;
  const scaleNeutral = minuteScale * era * (0.9 + 0.2 * scoreShare);

  const tackles = prior.tackles * scaleDefence;
  const metres = prior.metres * scaleAttack;
  const carries = prior.carries * scaleAttack;
  const breaks = prior.lineBreaks * scaleAttack * (1 + Math.min(2, input.tries) * 0.25);
  const beaten = prior.defendersBeaten * scaleAttack;
  const turnovers = prior.turnoversWon * scaleDefence;
  const assists = prior.tryAssists * scaleAttack * (jersey === 9 || jersey === 10 ? 1.15 : 1);
  const dominant = prior.dominantTackles * scaleDefence;
  const pcm = prior.postContactMetres * scaleAttack;
  const touches = prior.touches * scaleNeutral * (jersey === 9 ? 1 : kickerBoost);

  const passes = extras.passes * scaleNeutral * (jersey === 9 ? 1.05 : 1);
  const offloads = extras.offloads * scaleAttack;
  const kicksFromHand = extras.kicksFromHand * minuteScale * era * kickerBoost * (jersey === 10 || jersey === 15 || jersey === 9 ? 1 : 0.85);
  const lineoutTakes = extras.lineoutTakes * minuteScale * era;
  const scrumInvolvements = extras.scrumInvolvements * minuteScale * era;

  let confidence = prior.sampleSize >= 25 ? 58 : prior.sampleSize >= 10 ? 50 : prior.sampleSize > 0 ? 42 : 34;
  if (input.jerseyNumber != null && input.jerseyNumber >= 1 && input.jerseyNumber <= 23) confidence += 10;
  else if (inferJerseyFromPosition(input.positionName) != null) confidence += 5;
  if (minutes >= 60) confidence += 5;
  else if (minutes <= 20) confidence -= 8;
  if (input.teamScore + input.oppositionScore > 0) confidence += 8;
  if (input.tries > 0 || input.points > 0) confidence += 4;
  confidence = clamp(confidence, 25, 72);

  const confidenceByMetric: Record<string, number> = {
    tacklesCompleted: confidence,
    metresCarried: confidence - 2,
    carries: confidence,
    lineBreaks: confidence - 6,
    defendersBeaten: confidence - 4,
    turnoversWon: confidence - 5,
    tryAssists: confidence - 8,
    dominantTackles: confidence - 12,
    postContactMetres: confidence - 10,
    passes: confidence - 14,
    offloads: confidence - 12,
    kicksFromHand: confidence - 10,
    lineoutTakes: confidence - 8,
    scrumInvolvements: confidence - 8,
  };

  const roleLabel =
    jersey <= 15 ? `jersey #${jersey} starter/${jersey <= 15 ? "XV" : "bench"}` : `bench #${jersey}`;
  const reasoning = [
    `${ESTIMATOR_METHOD}: ${roleLabel}, ${minutes}' assumed`,
    `prior RWC ${ESTIMATOR_PRIOR_YEARS.join("/") } jersey ${prior.jersey} (n=${prior.sampleSize})`,
    `era×${era.toFixed(2)}; attack×${attackMult.toFixed(2)} defence×${defenceMult.toFixed(2)}`,
    `score ${input.teamScore}-${input.oppositionScore} (share ${(scoreShare * 100).toFixed(0)}%)`,
    `strength ${(input.teamStrength).toFixed(2)} vs ${(input.oppositionStrength).toFixed(2)}`,
    input.tries > 0 ? `try involvement +${input.tries}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return {
    minutesPlayed: minutes,
    tacklesCompleted: roundStat(tackles),
    tacklesMade: roundStat(tackles),
    metresCarried: roundStat(metres),
    carries: roundStat(carries),
    lineBreaks: roundStat(breaks),
    defendersBeaten: roundStat(beaten),
    turnoversWon: roundStat(turnovers),
    tryAssists: roundStat(assists),
    dominantTackles: roundStat(dominant),
    postContactMetres: roundStat(pcm),
    touches: roundStat(touches),
    passes: roundStat(passes),
    offloads: roundStat(offloads),
    kicksFromHand: roundStat(kicksFromHand),
    kicks: roundStat(kicksFromHand),
    lineoutTakes: roundStat(lineoutTakes),
    scrumInvolvements: roundStat(scrumInvolvements),
    confidence,
    confidenceByMetric: Object.fromEntries(
      Object.entries(confidenceByMetric).map(([k, v]) => [k, clamp(Math.round(v), 15, 72)]),
    ),
    reasoning,
    jerseyUsed: jersey,
  };
}

export function teamStrengthFromRecord(pointsFor: number, pointsAgainst: number, matches: number) {
  if (matches <= 0) return 1;
  const pf = pointsFor / matches;
  const pa = Math.max(1, pointsAgainst / matches);
  return clamp((pf + 8) / (pa + 8), 0.45, 2.2);
}

export const RWC_ESTIMATION_SEASON_NOTE =
  "Where official historical player statistics are unavailable, Rugby365 uses AI and historical match data to generate the closest possible performance estimates. All AI-generated statistics are clearly labelled as estimates.";
