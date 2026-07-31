/**
 * Rugby365 Recruitment Index (RRI) v1 — pure math.
 * Signature metric: ability + potential + form + scarcity + availability +
 * contract + character → one 0–100 recruitment score for clubs.
 */

export const RRI_MODEL = "rri-v1";

export type ScoutRecommendation =
  | "sign_now"
  | "monitor"
  | "loan"
  | "academy"
  | "do_not_pursue";

export type ScoutRiskLevel = "low" | "medium" | "high" | "excellent";

export type ScoutRriFactorKey =
  | "ability"
  | "potential"
  | "form"
  | "availability"
  | "injury"
  | "contract"
  | "age"
  | "position"
  | "character";

export type ScoutRriFactor = {
  key: ScoutRriFactorKey;
  label: string;
  weight: number;
  score: number;
  note: string;
};

export type ScoutPlayerDna = {
  leadership: number;
  professionalism: number;
  competitiveness: number;
  aggression: number;
  coachability: number;
  workRate: number;
  bigMatchMentality: number;
  communication: number;
  decisionMaking: number;
  resilience: number;
};

export type ScoutPhysicalIntelligence = {
  heightPercentile: number | null;
  weightPercentile: number | null;
  accelerationPercentile: number | null;
  topSpeedPercentile: number | null;
  strengthPercentile: number | null;
  fitnessPercentile: number | null;
};

export type ScoutCareerProjection = {
  nextSeasonLabel: string;
  nextThreeYearsLabel: string;
  peakAge: number | null;
  retirementWindow: string | null;
  internationalCapsProbability: number;
  lionsProbability: number;
  worldCupSquadProbability: number;
};

export type ScoutMarketIntelligence = {
  estimatedValueGbp: number | null;
  likelyTransferFeeGbp: number | null;
  estimatedSalaryGbp: number | null;
  contractMonthsRemaining: number | null;
  freeTransfer: boolean | null;
  releaseClauseGbp: number | null;
  agentLabel: string | null;
};

export type ScoutTacticalIntelligence = {
  preferredSide: string | null;
  lineoutCaller: boolean | null;
  captainMaterial: boolean | null;
  dominantCarrySide: string | null;
  penaltyHotspot: string | null;
};

export type ScoutRatingDetail = {
  readyForFirstTeam: boolean;
  developmentTimeLabel: string;
  riskLevel: ScoutRiskLevel;
  stars: number;
};

export type ScoutScorecard = {
  overallRating: number;
  potential: number;
  physical: number;
  attack: number;
  defence: number;
  setPiece: number;
  discipline: number;
  leadership: number;
  availability: number;
  marketValueGbp: number | null;
  recommendation: ScoutRecommendation;
  stars: number;
};

export type ScoutIntelligenceInputs = {
  /** Career / current ability ~35–99 */
  currentAbility: number | null;
  potential: number | null;
  formScore: number | null;
  /** Last five match ratings 0–10 */
  lastFiveMatchRatings: number[];
  attackRating: number | null;
  defenceRating: number | null;
  disciplineRating: number | null;
  reputation: number | null;
  age: number | null;
  positionName: string | null;
  internationalCaps: number | null;
  /** Months remaining; null = unknown */
  contractMonthsRemaining: number | null;
  /** Days unavailable last 365 days */
  daysUnavailableLastYear: number | null;
  /** Injury/suspension events in last 2 years */
  injuryEventsLastTwoYears: number | null;
  marketValueGbp: number | null;
  transferValueGbp: number | null;
  contractValueGbp: number | null;
  heightCm: number | null;
  weightKg: number | null;
  isCaptain: boolean | null;
  agentLabel: string | null;
  /** Optional CMS overrides */
  overrides?: {
    rriScore?: number | null;
    recommendation?: ScoutRecommendation | null;
    recommendationConfidence?: number | null;
    aiSummary?: string | null;
    playerDna?: Partial<ScoutPlayerDna> | null;
    overallRating?: number | null;
    potential?: number | null;
  };
};

export type ScoutIntelligenceResult = {
  modelVersion: string;
  rriScore: number;
  rriBand: string;
  rriGrade: string;
  recommendation: ScoutRecommendation;
  recommendationConfidence: number;
  aiSummary: string;
  overallRating: number;
  potential: number;
  currentAbility: number;
  ceiling: number;
  physicalScore: number;
  attackScore: number;
  defenceScore: number;
  setPieceScore: number;
  disciplineScore: number;
  leadershipScore: number;
  availabilityScore: number;
  riskInjury: ScoutRiskLevel;
  riskContract: ScoutRiskLevel;
  riskAdaptation: ScoutRiskLevel;
  riskDiscipline: ScoutRiskLevel;
  factors: ScoutRriFactor[];
  scorecard: ScoutScorecard;
  playerDna: ScoutPlayerDna;
  physicalIntelligence: ScoutPhysicalIntelligence;
  careerProjection: ScoutCareerProjection;
  marketIntelligence: ScoutMarketIntelligence;
  tacticalIntelligence: ScoutTacticalIntelligence;
  scoutRating: ScoutRatingDetail;
  notes: string[];
};

/** RRI weights — sum to 1.0 */
export const RRI_WEIGHTS: Record<ScoutRriFactorKey, number> = {
  ability: 0.2,
  potential: 0.2,
  form: 0.15,
  availability: 0.1,
  injury: 0.1,
  contract: 0.1,
  age: 0.05,
  position: 0.05,
  character: 0.05,
};

const FACTOR_LABELS: Record<ScoutRriFactorKey, string> = {
  ability: "Current Ability",
  potential: "Future Potential",
  form: "Recent Form",
  availability: "Availability",
  injury: "Injury Risk (inverted)",
  contract: "Contract Value",
  age: "Age Curve",
  position: "Position Demand",
  character: "Character",
};

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ratingToHundred(raw: number | null, fallback = 55): number {
  if (raw == null || !Number.isFinite(raw)) return fallback;
  // Career ratings sit ~35–99; map gently onto 0–100
  return clamp(raw);
}

function formToHundred(formScore: number | null, lastFive: number[]): number {
  if (lastFive.length > 0) {
    const avg = lastFive.reduce((s, n) => s + n, 0) / lastFive.length;
    // 0–10 match ratings → ~40–95 band
    return clamp(40 + avg * 5.5);
  }
  if (formScore != null && Number.isFinite(formScore)) {
    return clamp(formScore);
  }
  return 55;
}

function availabilityScore(daysUnavailable: number | null): number {
  if (daysUnavailable == null) return 70;
  if (daysUnavailable <= 7) return 95;
  if (daysUnavailable <= 21) return 88;
  if (daysUnavailable <= 45) return 78;
  if (daysUnavailable <= 90) return 62;
  if (daysUnavailable <= 150) return 45;
  return 28;
}

function injuryScore(events: number | null, daysUnavailable: number | null): number {
  // Higher = healthier (lower injury risk)
  let base = 80;
  if (events != null) {
    if (events === 0) base = 92;
    else if (events === 1) base = 78;
    else if (events === 2) base = 62;
    else base = 42;
  }
  if (daysUnavailable != null && daysUnavailable > 60) {
    base = Math.min(base, 50);
  }
  return clamp(base);
}

function contractScore(months: number | null): number {
  // Shorter remaining = better recruitment opportunity
  if (months == null) return 55;
  if (months <= 6) return 92;
  if (months <= 12) return 86;
  if (months <= 18) return 74;
  if (months <= 24) return 60;
  if (months <= 36) return 45;
  return 32;
}

function ageCurveScore(age: number | null): number {
  if (age == null) return 60;
  if (age <= 21) return 78;
  if (age <= 24) return 90;
  if (age <= 27) return 95;
  if (age <= 29) return 82;
  if (age <= 31) return 68;
  if (age <= 33) return 52;
  return 38;
}

function positionDemandScore(positionName: string | null): number {
  const p = (positionName ?? "").toLowerCase();
  if (!p) return 55;
  // Scarce / high-demand roles
  if (/prop|hooker|lock|flanker|openside|blindside|number.?8|no\.?\s*8/.test(p)) return 78;
  if (/fly.?half|flyhalf|out.?half|scrum.?half|10\b|9\b/.test(p)) return 82;
  if (/centre|wing|full.?back|15\b/.test(p)) return 70;
  return 60;
}

function characterScore(input: ScoutIntelligenceInputs): number {
  const discipline = ratingToHundred(input.disciplineRating, 65);
  const rep = ratingToHundred(input.reputation, 60);
  let score = discipline * 0.45 + rep * 0.35 + (input.isCaptain ? 85 : 60) * 0.2;
  return clamp(score);
}

function riskFromScore(healthyScore: number): ScoutRiskLevel {
  if (healthyScore >= 85) return "low";
  if (healthyScore >= 65) return "medium";
  return "high";
}

function availabilityRisk(avail: number): ScoutRiskLevel {
  if (avail >= 90) return "excellent";
  if (avail >= 75) return "low";
  if (avail >= 55) return "medium";
  return "high";
}

export function rriBand(score: number): string {
  if (score >= 90) return "Elite Signing";
  if (score >= 82) return "Priority Target";
  if (score >= 74) return "Strong Target";
  if (score >= 65) return "Solid Option";
  if (score >= 55) return "Watchlist";
  return "Low Priority";
}

export function rriGrade(score: number): string {
  if (score >= 93) return "A+";
  if (score >= 88) return "A";
  if (score >= 82) return "A-";
  if (score >= 76) return "B+";
  if (score >= 70) return "B";
  if (score >= 64) return "B-";
  if (score >= 58) return "C+";
  if (score >= 50) return "C";
  return "D";
}

export function recommendationFromRri(
  score: number,
  age: number | null,
  injuryHealthy: number,
): ScoutRecommendation {
  if (score < 50 || injuryHealthy < 40) return "do_not_pursue";
  if (age != null && age <= 20 && score >= 60) return "academy";
  if (score >= 82 && injuryHealthy >= 60) return "sign_now";
  if (score >= 70 && age != null && age <= 23) return "loan";
  return "monitor";
}

export function recommendationLabel(rec: ScoutRecommendation): string {
  switch (rec) {
    case "sign_now":
      return "Sign Immediately";
    case "loan":
      return "Loan Target";
    case "academy":
      return "Academy / Development";
    case "do_not_pursue":
      return "Do Not Pursue";
    default:
      return "Monitor";
  }
}

export function starsFromRri(score: number): number {
  if (score >= 92) return 5;
  if (score >= 85) return 4.5;
  if (score >= 78) return 4;
  if (score >= 70) return 3.5;
  if (score >= 62) return 3;
  if (score >= 54) return 2.5;
  if (score >= 46) return 2;
  return 1.5;
}

function buildDna(input: ScoutIntelligenceInputs, leadership: number, discipline: number): ScoutPlayerDna {
  const form = formToHundred(input.formScore, input.lastFiveMatchRatings);
  const ability = ratingToHundred(input.currentAbility, 60);
  const potential = ratingToHundred(input.potential, ability + 4);
  const base: ScoutPlayerDna = {
    leadership,
    professionalism: clamp(discipline * 0.55 + (input.reputation ?? 60) * 0.45),
    competitiveness: clamp(form * 0.5 + ability * 0.5),
    aggression: clamp((input.defenceRating ?? 65) * 0.6 + 30),
    coachability: clamp(potential * 0.4 + discipline * 0.35 + 25),
    workRate: clamp(form * 0.55 + (input.defenceRating ?? 65) * 0.45),
    bigMatchMentality: clamp((input.reputation ?? 60) * 0.5 + form * 0.5),
    communication: clamp(leadership * 0.7 + 20),
    decisionMaking: clamp((input.attackRating ?? 65) * 0.45 + discipline * 0.35 + 20),
    resilience: clamp(injuryScore(input.injuryEventsLastTwoYears, input.daysUnavailableLastYear)),
  };
  const ov = input.overrides?.playerDna;
  if (!ov) return base;
  return {
    leadership: ov.leadership ?? base.leadership,
    professionalism: ov.professionalism ?? base.professionalism,
    competitiveness: ov.competitiveness ?? base.competitiveness,
    aggression: ov.aggression ?? base.aggression,
    coachability: ov.coachability ?? base.coachability,
    workRate: ov.workRate ?? base.workRate,
    bigMatchMentality: ov.bigMatchMentality ?? base.bigMatchMentality,
    communication: ov.communication ?? base.communication,
    decisionMaking: ov.decisionMaking ?? base.decisionMaking,
    resilience: ov.resilience ?? base.resilience,
  };
}

function physicalPercentile(value: number | null, low: number, high: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = ((value - low) / (high - low)) * 100;
  return clamp(pct);
}

function buildAiSummary(args: {
  age: number | null;
  positionName: string | null;
  ability: number;
  potential: number;
  form: number;
  discipline: number;
  defence: number;
  attack: number;
  contractMonths: number | null;
  recommendation: ScoutRecommendation;
  internationalCaps: number | null;
}): string {
  const ageBit = args.age != null ? `${args.age}-year-old` : "Prospect";
  const pos = args.positionName ?? "player";
  const contractBit =
    args.contractMonths != null && args.contractMonths <= 18
      ? ` Contract expires in about ${args.contractMonths} months, making him a realistic acquisition.`
      : args.contractMonths != null && args.contractMonths > 30
        ? " Long remaining contract may complicate a move."
        : "";
  const intl =
    (args.internationalCaps ?? 0) > 10
      ? " Proven at international level."
      : args.potential >= 85
        ? " Projects with international upside."
        : "";
  const disciplineBit =
    args.discipline < 65
      ? " Needs improvement in discipline."
      : " Solid disciplinary profile.";
  const rec = recommendationLabel(args.recommendation);

  return `${ageBit} ${pos} with current ability ${args.ability} and potential ${args.potential}. Recent form sits at ${args.form}/100 with attack ${args.attack} and defence ${args.defence}. ${disciplineBit}${contractBit}${intl} Scout recommendation: ${rec}.`;
}

/**
 * Compute full Scout Intelligence packet including RRI.
 */
export function computeScoutIntelligence(input: ScoutIntelligenceInputs): ScoutIntelligenceResult {
  const notes: string[] = [];
  const ability = ratingToHundred(input.currentAbility, 58);
  const potentialRaw = ratingToHundred(input.potential, Math.min(99, ability + 6));
  const potential = Math.max(ability, potentialRaw);
  const form = formToHundred(input.formScore, input.lastFiveMatchRatings);
  const avail = availabilityScore(input.daysUnavailableLastYear);
  const injuryHealthy = injuryScore(input.injuryEventsLastTwoYears, input.daysUnavailableLastYear);
  const contract = contractScore(input.contractMonthsRemaining);
  const age = ageCurveScore(input.age);
  const position = positionDemandScore(input.positionName);
  const character = characterScore(input);
  const attack = ratingToHundred(input.attackRating, ability - 2);
  const defence = ratingToHundred(input.defenceRating, ability - 2);
  const discipline = ratingToHundred(input.disciplineRating, 68);
  const leadership = clamp(
    characterScore({ ...input, isCaptain: input.isCaptain }) * 0.6 +
      (input.isCaptain ? 20 : 0) +
      ratingToHundred(input.reputation, 55) * 0.25,
  );
  const physical = clamp(ability * 0.35 + defence * 0.35 + form * 0.3);
  const setPiece = clamp(
    /prop|hooker|lock|flanker|number.?8|no\.?\s*8/i.test(input.positionName ?? "")
      ? ability * 0.55 + defence * 0.45
      : ability * 0.35 + 40,
  );

  const factorScores: Record<ScoutRriFactorKey, number> = {
    ability,
    potential,
    form,
    availability: avail,
    injury: injuryHealthy,
    contract,
    age,
    position,
    character,
  };

  const factors: ScoutRriFactor[] = (Object.keys(RRI_WEIGHTS) as ScoutRriFactorKey[]).map(
    (key) => ({
      key,
      label: FACTOR_LABELS[key],
      weight: RRI_WEIGHTS[key],
      score: factorScores[key],
      note: `${FACTOR_LABELS[key]} contributes ${(RRI_WEIGHTS[key] * 100).toFixed(0)}%`,
    }),
  );

  let rri = 0;
  for (const f of factors) rri += f.score * f.weight;
  rri = clamp(rri);

  const ov = input.overrides ?? {};
  if (typeof ov.rriScore === "number" && Number.isFinite(ov.rriScore)) {
    rri = clamp(ov.rriScore);
    notes.push("CMS override: rriScore");
  }

  let recommendation = recommendationFromRri(rri, input.age, injuryHealthy);
  if (ov.recommendation) {
    recommendation = ov.recommendation;
    notes.push("CMS override: recommendation");
  }

  const ceiling = clamp(Math.max(potential, ability + 4));
  const overallRating =
    typeof ov.overallRating === "number" ? clamp(ov.overallRating) : clamp(ability);
  const potentialOut =
    typeof ov.potential === "number" ? clamp(ov.potential) : potential;

  let confidence = clamp(
    45 +
      (input.currentAbility != null ? 12 : 0) +
      (input.lastFiveMatchRatings.length >= 3 ? 15 : 0) +
      (input.contractMonthsRemaining != null ? 8 : 0) +
      (input.daysUnavailableLastYear != null ? 8 : 0) +
      ((input.internationalCaps ?? 0) > 0 ? 5 : 0),
  );
  if (typeof ov.recommendationConfidence === "number") {
    confidence = clamp(ov.recommendationConfidence);
  }

  const playerDna = buildDna(input, leadership, discipline);
  const stars = starsFromRri(rri);

  const aiSummary =
    typeof ov.aiSummary === "string" && ov.aiSummary.trim()
      ? ov.aiSummary.trim()
      : buildAiSummary({
          age: input.age,
          positionName: input.positionName,
          ability: overallRating,
          potential: potentialOut,
          form,
          discipline,
          defence,
          attack,
          contractMonths: input.contractMonthsRemaining,
          recommendation,
          internationalCaps: input.internationalCaps,
        });

  const scorecard: ScoutScorecard = {
    overallRating,
    potential: potentialOut,
    physical,
    attack,
    defence,
    setPiece,
    discipline,
    leadership,
    availability: avail,
    marketValueGbp: input.marketValueGbp,
    recommendation,
    stars,
  };

  const ageNum = input.age;
  const peakAge =
    ageNum == null ? 28 : ageNum <= 24 ? 28 : ageNum <= 28 ? Math.min(31, ageNum + 2) : ageNum + 1;

  return {
    modelVersion: RRI_MODEL,
    rriScore: rri,
    rriBand: rriBand(rri),
    rriGrade: rriGrade(rri),
    recommendation,
    recommendationConfidence: confidence,
    aiSummary,
    overallRating,
    potential: potentialOut,
    currentAbility: ability,
    ceiling,
    physicalScore: physical,
    attackScore: attack,
    defenceScore: defence,
    setPieceScore: setPiece,
    disciplineScore: discipline,
    leadershipScore: leadership,
    availabilityScore: avail,
    riskInjury: riskFromScore(injuryHealthy),
    riskContract:
      input.contractMonthsRemaining == null
        ? "medium"
        : input.contractMonthsRemaining <= 12
          ? "low"
          : input.contractMonthsRemaining <= 24
            ? "medium"
            : "high",
    riskAdaptation: ageNum != null && ageNum >= 30 ? "medium" : "low",
    riskDiscipline: riskFromScore(discipline),
    factors,
    scorecard,
    playerDna,
    physicalIntelligence: {
      heightPercentile: physicalPercentile(input.heightCm, 165, 205),
      weightPercentile: physicalPercentile(input.weightKg, 70, 130),
      accelerationPercentile: clamp(form * 0.7 + attack * 0.3),
      topSpeedPercentile: clamp(attack * 0.55 + form * 0.45),
      strengthPercentile: clamp(defence * 0.5 + physical * 0.5),
      fitnessPercentile: clamp(avail * 0.4 + form * 0.6),
    },
    careerProjection: {
      nextSeasonLabel:
        potentialOut > ability + 3
          ? "Projected improvement season"
          : "Maintain current level",
      nextThreeYearsLabel:
        ageNum != null && ageNum <= 26
          ? "Entering / in prime window"
          : ageNum != null && ageNum >= 31
            ? "Managed minutes / leadership phase"
            : "Peak contribution years",
      peakAge,
      retirementWindow: ageNum != null ? `${Math.max(ageNum + 4, 34)}–${Math.max(ageNum + 7, 37)}` : null,
      internationalCapsProbability: clamp(
        (input.internationalCaps ?? 0) > 0
          ? 75 + Math.min(20, (input.internationalCaps ?? 0) / 2)
          : potentialOut * 0.55,
      ),
      lionsProbability: clamp(potentialOut * 0.35 + (input.reputation ?? 50) * 0.25),
      worldCupSquadProbability: clamp(potentialOut * 0.4 + (input.internationalCaps ?? 0)),
    },
    marketIntelligence: {
      estimatedValueGbp: input.marketValueGbp,
      likelyTransferFeeGbp: input.transferValueGbp,
      estimatedSalaryGbp: input.contractValueGbp,
      contractMonthsRemaining: input.contractMonthsRemaining,
      freeTransfer:
        input.contractMonthsRemaining != null ? input.contractMonthsRemaining <= 0 : null,
      releaseClauseGbp: null,
      agentLabel: input.agentLabel,
    },
    tacticalIntelligence: {
      preferredSide: null,
      lineoutCaller: /lock|flanker|hooker/i.test(input.positionName ?? "") ? null : null,
      captainMaterial: leadership >= 80 || Boolean(input.isCaptain),
      dominantCarrySide: null,
      penaltyHotspot: discipline < 65 ? "Breakdown" : null,
    },
    scoutRating: {
      readyForFirstTeam: ability >= 72 && avail >= 60,
      developmentTimeLabel:
        ability >= 80 ? "Immediate" : ability >= 70 ? "3–6 months" : "12–24 months",
      riskLevel: riskFromScore(clamp((injuryHealthy + discipline + avail) / 3)),
      stars,
    },
    notes,
  };
}
