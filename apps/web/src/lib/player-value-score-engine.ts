/**
 * PlayerValueScoreEngine (player-value-score-v1)
 *
 * Rugby365 Value Score — asset attractiveness 0–100.
 * Distinct from OVR, Market Value (GBP), and Confidence.
 *
 * Missing factors are null (UNKNOWN ≠ 0): weights renormalise; confidence drops.
 * Coverage <50% → UNDER_REVIEW (no published number).
 */

export const VALUE_SCORE_MODEL = "player-value-score-v1";

/** Central weight config — must sum to 100. */
export const VALUE_SCORE_WEIGHTS_V1 = {
  player_rating: 25,
  value_trend: 15,
  market_demand: 15,
  transfer_interest: 10,
  contract: 10,
  potential: 8,
  position_scarcity: 7,
  current_form: 5,
  availability: 3,
  commercial: 2,
} as const;

export type ValueScoreFactorKey = keyof typeof VALUE_SCORE_WEIGHTS_V1;

export const VALUE_SCORE_FACTOR_LABELS: Record<ValueScoreFactorKey, string> = {
  player_rating: "Player Rating",
  value_trend: "Value Trend",
  market_demand: "Market Demand",
  transfer_interest: "Transfer Interest",
  contract: "Contract",
  potential: "Potential",
  position_scarcity: "Position Scarcity",
  current_form: "Current Form",
  availability: "Availability",
  commercial: "Commercial",
};

export type ValueScoreStatus =
  | "CURRENT"
  | "PROVISIONAL"
  | "UNDER_REVIEW"
  | "STALE";

export type ValueTrendClass = "Rising" | "Stable" | "Falling" | null;

export type DemandClass =
  | "Very High"
  | "High"
  | "Medium"
  | "Low"
  | "Very Low"
  | null;

export const VALUE_TREND_THRESHOLDS = {
  risingPct: 5,
  fallingPct: -5,
} as const;

export type ValueScoreFactorContribution = {
  key: ValueScoreFactorKey;
  label: string;
  /** Factor score 0–100, or null when unknown (excluded). */
  score: number | null;
  /** Nominal model weight before renormalisation. */
  nominalWeight: number;
  /** Effective weight after renormalisation (0 when excluded). */
  weight: number;
  /** score × weight / 100 when included. */
  contribution: number;
  classification?: string | null;
  note?: string | null;
};

export type PlayerValueScoreResult = {
  /** Published 0–100 when status allows; null when UNDER_REVIEW. */
  valueScore: number | null;
  /** Raw weighted blend before coverage gate (always computed when any factor present). */
  rawScore: number | null;
  confidence: number;
  coverage: number;
  status: ValueScoreStatus;
  modelVersion: string;
  factors: ValueScoreFactorContribution[];
  reweighted: boolean;
  excludedKeys: ValueScoreFactorKey[];
  valueTrend: ValueTrendClass;
  valueTrendChangePct: number | null;
  marketDemand: DemandClass;
  marketDemandScore: number | null;
  transferInterest: DemandClass;
  transferInterestScore: number | null;
  calculatedAt: string;
  publishable: boolean;
};

export type PlayerValueScoreInput = {
  overallRating: number | null;
  potential: number | null;
  /** 90d market-value % change from player_value_history. */
  valueChangePct90d: number | null;
  /** Form on 0–10 or career-ish 0–100 scale. */
  formScore: number | null;
  contractMonthsRemaining: number | null;
  verifiedCaps: number | null;
  competitionKey: string | null;
  positionName: string | null;
  /** 0–100 availability; null = unknown. */
  availabilityScore: number | null;
  /** 0–100 commercial; null = unknown. */
  commercialScore: number | null;
  /**
   * Transfer interest requires evidence. Without it the factor is UNKNOWN
   * (renormalised out) and UI shows "—".
   */
  transferInterestEvidence?: boolean;
  /** Optional explicit 0–100 when evidence exists. */
  transferInterestScore?: number | null;
  calculatedAt?: Date | string;
  /** Days after which CURRENT/PROVISIONAL becomes STALE. */
  staleAfterDays?: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round0(n: number): number {
  return Math.round(n);
}

export function sumValueScoreWeights(
  weights: Record<string, number> = VALUE_SCORE_WEIGHTS_V1,
): number {
  return Object.values(weights).reduce((s, w) => s + w, 0);
}

export function classifyValueTrend(changePct: number | null): ValueTrendClass {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  if (changePct > VALUE_TREND_THRESHOLDS.risingPct) return "Rising";
  if (changePct < VALUE_TREND_THRESHOLDS.fallingPct) return "Falling";
  return "Stable";
}

/**
 * Map actual % movement to a 0–100 factor score.
 * Not binary Rising=100 / Falling=0.
 */
export function scoreValueTrendFromChangePct(changePct: number | null): number | null {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  if (changePct > 20) return 95;
  if (changePct > 10) return 85;
  if (changePct > 5) return 72;
  if (changePct > 2) return 60;
  if (changePct >= -2) return 50;
  if (changePct >= -5) return 40;
  if (changePct >= -10) return 28;
  if (changePct >= -20) return 18;
  return 8;
}

export function classifyDemandFromScore(score: number | null): DemandClass {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  if (score >= 30) return "Low";
  return "Very Low";
}

/**
 * Proxy market-demand score. Weak / incomplete inputs → null (UNKNOWN).
 */
export function scoreMarketDemand(input: {
  overallRating: number | null;
  verifiedCaps: number | null;
  competitionKey: string | null;
  positionScarcityScore: number | null;
}): { score: number | null; classification: DemandClass; note: string } {
  if (input.overallRating == null) {
    return { score: null, classification: null, note: "No overall rating" };
  }

  let points = 0;
  let signals = 0;

  const ovr = input.overallRating;
  if (ovr >= 85) {
    points += 40;
    signals++;
  } else if (ovr >= 78) {
    points += 32;
    signals++;
  } else if (ovr >= 70) {
    points += 24;
    signals++;
  } else if (ovr >= 60) {
    points += 14;
    signals++;
  } else {
    points += 6;
    signals++;
  }

  const caps = input.verifiedCaps ?? 0;
  if (caps >= 60) {
    points += 28;
    signals++;
  } else if (caps >= 30) {
    points += 20;
    signals++;
  } else if (caps >= 10) {
    points += 12;
    signals++;
  } else if (caps >= 1) {
    points += 6;
    signals++;
  }

  if (input.competitionKey) {
    const key = input.competitionKey.toLowerCase();
    if (/premiership|top.?14|united rugby|urc|super.?rugby|champions.?cup|investec/.test(key)) {
      points += 16;
    } else {
      points += 8;
    }
    signals++;
  }

  if (input.positionScarcityScore != null) {
    points += Math.round(input.positionScarcityScore * 0.16);
    signals++;
  }

  if (signals < 2) {
    return { score: null, classification: null, note: "Insufficient demand signals" };
  }

  const score = clamp(round0(points), 0, 100);
  return {
    score,
    classification: classifyDemandFromScore(score),
    note: `${signals} demand signals`,
  };
}

export function scorePositionScarcity(positionName: string | null): {
  score: number | null;
  note: string;
} {
  const p = (positionName ?? "").toLowerCase();
  if (!p) return { score: null, note: "Position unknown" };
  if (/(fly.?half|out.?half|number.?10|10\b)/.test(p)) {
    return { score: 92, note: "Fly-half scarcity" };
  }
  if (/(scrum.?half|half.?back|number.?9|9\b)/.test(p)) {
    return { score: 82, note: "Scrum-half scarcity" };
  }
  if (/(prop|hooker|front.?row)/.test(p)) {
    return { score: 78, note: "Front-row specialist scarcity" };
  }
  if (/(lock|second.?row)/.test(p)) return { score: 68, note: "Lock demand" };
  if (/(openside|blindside|flanker|number.?8|back.?row)/.test(p)) {
    return { score: 66, note: "Back-row demand" };
  }
  if (/(centre|midfield)/.test(p)) return { score: 55, note: "Centre" };
  if (/(wing|full.?back)/.test(p)) return { score: 52, note: "Outside back" };
  return { score: 48, note: "Position factored" };
}

export function scoreContractMonths(months: number | null): {
  score: number | null;
  note: string;
} {
  if (months == null || !Number.isFinite(months)) {
    return { score: null, note: "Contract length unknown" };
  }
  if (months <= 6) return { score: 58, note: "≤6 months remaining" };
  if (months <= 12) return { score: 72, note: "≤12 months remaining" };
  if (months <= 24) return { score: 88, note: "12–24 months remaining" };
  if (months <= 36) return { score: 78, note: "24–36 months remaining" };
  return { score: 62, note: ">36 months remaining" };
}

function normalizeFormTo100(formScore: number | null): number | null {
  if (formScore == null || !Number.isFinite(formScore)) return null;
  if (formScore <= 10) return clamp(round1(formScore * 10), 0, 100);
  return clamp(round1(formScore), 0, 100);
}

/**
 * Ring fill percent must use Value Score, never confidence.
 * Returns 0–100 for SVG stroke; null means empty/muted track.
 */
export function resolveValueScoreRingFillPct(
  valueScore: number | null,
  _confidence?: number | null,
): number | null {
  if (valueScore == null || !Number.isFinite(valueScore)) return null;
  return clamp(valueScore, 0, 100);
}

/** Shared ring colour band tokens (CSS var names / stop colours). */
export function resolveValueScoreRingBand(valueScore: number | null): {
  band: "empty" | "amber" | "green";
  gradientIdSuffix: string;
  stops: Array<{ offset: string; color: string }>;
} {
  if (valueScore == null || !Number.isFinite(valueScore)) {
    return {
      band: "empty",
      gradientIdSuffix: "empty",
      stops: [
        { offset: "0%", color: "rgba(255,255,255,0.12)" },
        { offset: "100%", color: "rgba(255,255,255,0.08)" },
      ],
    };
  }
  if (valueScore >= 80) {
    return {
      band: "green",
      gradientIdSuffix: "green",
      stops: [
        { offset: "0%", color: "#4ade80" },
        { offset: "55%", color: "#22c55e" },
        { offset: "100%", color: "#16a34a" },
      ],
    };
  }
  return {
    band: "amber",
    gradientIdSuffix: "amber",
    stops: [
      { offset: "0%", color: "#fbbf24" },
      { offset: "55%", color: "#f59e0b" },
      { offset: "100%", color: "#d97706" },
    ],
  };
}

export function resolveValueScoreStatus(input: {
  coverage: number;
  calculatedAt: Date;
  staleAfterDays?: number;
}): ValueScoreStatus {
  const staleAfter = input.staleAfterDays ?? 120;
  const ageMs = Date.now() - input.calculatedAt.getTime();
  const stale = ageMs > staleAfter * 86_400_000;

  if (input.coverage < 50) return "UNDER_REVIEW";
  if (stale) return "STALE";
  if (input.coverage < 70) return "PROVISIONAL";
  return "CURRENT";
}

/**
 * Compute Rugby365 Value Score from factor signals.
 * Pure — no DB / React.
 */
export function computePlayerValueScore(input: PlayerValueScoreInput): PlayerValueScoreResult {
  const calculatedAtDate =
    input.calculatedAt instanceof Date
      ? input.calculatedAt
      : input.calculatedAt
        ? new Date(input.calculatedAt)
        : new Date();
  const calculatedAt = calculatedAtDate.toISOString();

  const scarcity = scorePositionScarcity(input.positionName);
  const demand = scoreMarketDemand({
    overallRating: input.overallRating,
    verifiedCaps: input.verifiedCaps,
    competitionKey: input.competitionKey,
    positionScarcityScore: scarcity.score,
  });
  const contract = scoreContractMonths(input.contractMonthsRemaining);
  const trendScore = scoreValueTrendFromChangePct(input.valueChangePct90d);
  const valueTrend = classifyValueTrend(input.valueChangePct90d);
  const form100 = normalizeFormTo100(input.formScore);

  const ratingScore =
    input.overallRating != null && Number.isFinite(input.overallRating)
      ? clamp(round1(input.overallRating), 0, 100)
      : null;

  const potentialScore =
    input.potential != null && Number.isFinite(input.potential)
      ? clamp(round1(input.potential), 0, 100)
      : null;

  const hasTransferEvidence = input.transferInterestEvidence === true;
  let transferScore: number | null = null;
  let transferNote: string | null = "No transfer-interest evidence";
  if (hasTransferEvidence) {
    if (input.transferInterestScore != null && Number.isFinite(input.transferInterestScore)) {
      transferScore = clamp(round0(input.transferInterestScore), 0, 100);
      transferNote = "Evidence-backed transfer interest";
    } else if (demand.score != null && (input.contractMonthsRemaining ?? 99) <= 18) {
      // Soft evidence path: short contract + known demand — still gated by evidence flag.
      transferScore = clamp(round0(demand.score * 0.95), 0, 100);
      transferNote = "Short contract + demand (evidence flag)";
    } else {
      transferNote = "Evidence flag set but score unavailable";
    }
  }

  const transferInterest = hasTransferEvidence
    ? classifyDemandFromScore(transferScore)
    : null;

  const rawByKey: Record<
    ValueScoreFactorKey,
    { score: number | null; note: string | null; classification?: string | null }
  > = {
    player_rating: {
      score: ratingScore,
      note: ratingScore != null ? "Overall rating" : "Overall rating unknown",
    },
    value_trend: {
      score: trendScore,
      note:
        trendScore != null
          ? `90d change ${input.valueChangePct90d!.toFixed(1)}%`
          : "No 90d value history",
      classification: valueTrend,
    },
    market_demand: {
      score: demand.score,
      note: demand.note,
      classification: demand.classification,
    },
    transfer_interest: {
      score: transferScore,
      note: transferNote,
      classification: transferInterest,
    },
    contract: {
      score: contract.score,
      note: contract.note,
    },
    potential: {
      score: potentialScore,
      note: potentialScore != null ? "Potential ceiling" : "Potential unknown",
    },
    position_scarcity: {
      score: scarcity.score,
      note: scarcity.note,
    },
    current_form: {
      score: form100,
      note: form100 != null ? "Current form" : "Form unknown",
    },
    availability: {
      score:
        input.availabilityScore != null && Number.isFinite(input.availabilityScore)
          ? clamp(round1(input.availabilityScore), 0, 100)
          : null,
      note:
        input.availabilityScore != null
          ? "Availability"
          : "Availability unknown",
    },
    commercial: {
      score:
        input.commercialScore != null && Number.isFinite(input.commercialScore)
          ? clamp(round1(input.commercialScore), 0, 100)
          : null,
      note: input.commercialScore != null ? "Commercial" : "Commercial unknown",
    },
  };

  const excludedKeys: ValueScoreFactorKey[] = [];
  const available: Array<{
    key: ValueScoreFactorKey;
    score: number;
    nominalWeight: number;
    note: string | null;
    classification?: string | null;
  }> = [];

  let nominalAvailable = 0;
  for (const key of Object.keys(VALUE_SCORE_WEIGHTS_V1) as ValueScoreFactorKey[]) {
    const nominalWeight = VALUE_SCORE_WEIGHTS_V1[key];
    const raw = rawByKey[key];
    if (raw.score == null) {
      excludedKeys.push(key);
      continue;
    }
    available.push({
      key,
      score: raw.score,
      nominalWeight,
      note: raw.note,
      classification: raw.classification,
    });
    nominalAvailable += nominalWeight;
  }

  const coverage = round1(nominalAvailable);
  const reweighted = excludedKeys.length > 0 && available.length > 0;
  const weightSum = available.reduce((s, a) => s + a.nominalWeight, 0);

  const factors: ValueScoreFactorContribution[] = (
    Object.keys(VALUE_SCORE_WEIGHTS_V1) as ValueScoreFactorKey[]
  ).map((key) => {
    const nominalWeight = VALUE_SCORE_WEIGHTS_V1[key];
    const incl = available.find((a) => a.key === key);
    if (!incl) {
      return {
        key,
        label: VALUE_SCORE_FACTOR_LABELS[key],
        score: null,
        nominalWeight,
        weight: 0,
        contribution: 0,
        classification: rawByKey[key].classification ?? null,
        note: rawByKey[key].note,
      };
    }
    const effective = weightSum > 0 ? (incl.nominalWeight / weightSum) * 100 : 0;
    return {
      key,
      label: VALUE_SCORE_FACTOR_LABELS[key],
      score: incl.score,
      nominalWeight,
      weight: round1(effective),
      contribution: round1((incl.score * effective) / 100),
      classification: incl.classification ?? null,
      note: incl.note,
    };
  });

  const rawScore =
    available.length > 0
      ? round1(factors.reduce((s, f) => s + f.contribution, 0))
      : null;

  let confidence = coverage;
  if (reweighted) confidence = round1(confidence * 0.92);
  if (excludedKeys.includes("contract")) confidence = Math.min(confidence, coverage - 4);
  if (excludedKeys.includes("value_trend")) confidence = Math.min(confidence, coverage - 3);
  confidence = clamp(round1(confidence), 0, 100);

  const status = resolveValueScoreStatus({
    coverage,
    calculatedAt: calculatedAtDate,
    staleAfterDays: input.staleAfterDays,
  });

  // STALE still shows last computed number; UNDER_REVIEW never publishes a number.
  const published =
    status === "UNDER_REVIEW" ? null : rawScore != null ? round0(rawScore) : null;

  return {
    valueScore: published,
    rawScore,
    confidence,
    coverage,
    status,
    modelVersion: VALUE_SCORE_MODEL,
    factors,
    reweighted,
    excludedKeys,
    valueTrend,
    valueTrendChangePct: input.valueChangePct90d,
    marketDemand: demand.classification,
    marketDemandScore: demand.score,
    transferInterest,
    transferInterestScore: transferScore,
    calculatedAt,
    publishable: published != null,
  };
}
