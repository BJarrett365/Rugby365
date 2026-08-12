/**
 * Coach Player Development Engine v1
 *
 * Public card shows understandable rating change (current − baseline).
 * Ranking / Coach Intelligence uses adjustedDevelopmentScore.
 *
 * Label: development_under_coach (association), not causation.
 */

export const COACH_PLAYER_DEVELOPMENT_VERSION = "coach-player-development-v1";

export type DevelopmentBaselineSource =
  | "pre_coach_last_5"
  | "tenure_start_first_3"
  | "insufficient";

export type DevelopmentConfidenceLabel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export type DevelopmentTrend = "up" | "stable" | "down";

export type DebutType = "CLUB" | "PROVINCIAL" | "INTERNATIONAL" | null;

export type CoachPlayerRatedAppearance = {
  fixtureId: string;
  kickoffAt: Date | null;
  rating: number;
  minutesPlayed: number;
  isStart: boolean;
  positionName: string | null;
  competitionLevel: number | null; // optional 1–5 strength; null = unknown
  underCoach: boolean;
};

export type CoachPlayerDevelopmentInput = {
  playerId: string;
  playerName: string | null;
  playerSlug: string | null;
  playerImageUrl: string | null;
  position: string | null;
  age: number | null;
  appearances: CoachPlayerRatedAppearance[];
  /** Tenure start — ratings before this are pre-coach baseline candidates. */
  tenureStartAt: Date | null;
  /** Mean team rating change under coach (late − early), used for fairness. */
  teamWideRatingDelta: number | null;
  debutGiven?: boolean;
  debutType?: DebutType;
  careerHighUnderCoach?: boolean;
};

export type CoachPlayerDevelopmentRow = {
  playerId: string;
  playerName: string;
  playerSlug: string | null;
  playerImageUrl: string | null;
  position: string | null;
  age: number | null;

  appearancesUnderCoach: number;
  startsUnderCoach: number;
  minutesUnderCoach: number;
  ratedAppsUnderCoach: number;

  baselineRating: number | null;
  baselineSource: DevelopmentBaselineSource;
  baselineSampleSize: number;
  currentRating: number | null;
  currentSampleSize: number;

  /** Public: current − baseline (rating points on 1–10 scale). */
  displayedChange: number | null;
  rawChange: number | null;

  /** Internal ranking / intelligence score (0–100). */
  adjustedDevelopmentScore: number | null;

  trend: DevelopmentTrend;
  trendDelta: number | null;
  confidence: DevelopmentConfidenceLabel;
  confidencePct: number;

  debutGiven: boolean;
  debutType: DebutType;
  careerHighUnderCoach: boolean;

  eligiblePublic: boolean;
  eligibleProvisional: boolean;
  dataIssues: string[];

  calc: {
    teamAdjustment: number;
    ageAdjustment: number;
    sampleFactor: number;
    opportunityFactor: number;
    ceilingFactor: number;
  };

  modelVersion: string;
};

export type CoachPlayerDevelopmentBundle = {
  modelVersion: string;
  enoughData: boolean;
  message: string | null;
  playersUsed: number;
  eligibleForDevelopment: number;
  highConfidence: number;
  mediumConfidence: number;
  insufficientData: number;
  ratedAppearanceCoveragePct: number | null;
  mostImproved: CoachPlayerDevelopmentRow[];
  allPlayers: CoachPlayerDevelopmentRow[];
  coachDevelopmentScore: number | null;
  coachDevelopmentComponents: Record<string, number | null>;
};

const MIN_PROVISIONAL = 3;
const MIN_PUBLIC = 5;
const RECENT_WINDOW = 5;
const BASELINE_WINDOW = 5;
const TENURE_START_BASELINE = 3;
const TREND_WINDOW = 3;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Slightly heavier weight on more recent appearances. */
function weightedRecentAvg(ratings: number[]): number | null {
  if (!ratings.length) return null;
  let wSum = 0;
  let vSum = 0;
  for (let i = 0; i < ratings.length; i++) {
    const w = 1 + i * 0.15; // later = more weight
    wSum += w;
    vSum += ratings[i]! * w;
  }
  return vSum / wSum;
}

function isStartRole(isStart: boolean): boolean {
  return isStart;
}

export function resolveBaseline(
  appearances: CoachPlayerRatedAppearance[],
  tenureStartAt: Date | null,
): {
  baselineRating: number | null;
  baselineSource: DevelopmentBaselineSource;
  baselineSampleSize: number;
} {
  const chron = [...appearances].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );

  if (tenureStartAt) {
    const cut = tenureStartAt.getTime();
    const pre = chron.filter((a) => !a.underCoach && (a.kickoffAt?.getTime() ?? 0) < cut);
    if (pre.length >= 2) {
      const slice = pre.slice(-BASELINE_WINDOW);
      return {
        baselineRating: avg(slice.map((a) => a.rating)),
        baselineSource: "pre_coach_last_5",
        baselineSampleSize: slice.length,
      };
    }
  }

  const under = chron.filter((a) => a.underCoach);
  if (under.length >= TENURE_START_BASELINE) {
    const slice = under.slice(0, TENURE_START_BASELINE);
    return {
      baselineRating: avg(slice.map((a) => a.rating)),
      baselineSource: "tenure_start_first_3",
      baselineSampleSize: slice.length,
    };
  }

  return {
    baselineRating: null,
    baselineSource: "insufficient",
    baselineSampleSize: 0,
  };
}

export function resolveCurrentUnderCoach(
  underCoach: CoachPlayerRatedAppearance[],
): { currentRating: number | null; currentSampleSize: number } {
  const chron = [...underCoach].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );
  const recent = chron.slice(-RECENT_WINDOW);
  return {
    currentRating: weightedRecentAvg(recent.map((a) => a.rating)),
    currentSampleSize: recent.length,
  };
}

export function resolveTrend(underCoach: CoachPlayerRatedAppearance[]): {
  trend: DevelopmentTrend;
  trendDelta: number | null;
} {
  const chron = [...underCoach].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );
  if (chron.length < TREND_WINDOW * 2) {
    return { trend: "stable", trendDelta: null };
  }
  const prev = chron.slice(-TREND_WINDOW * 2, -TREND_WINDOW);
  const last = chron.slice(-TREND_WINDOW);
  const a = avg(prev.map((x) => x.rating));
  const b = avg(last.map((x) => x.rating));
  if (a == null || b == null) return { trend: "stable", trendDelta: null };
  const delta = b - a;
  if (delta >= 0.25) return { trend: "up", trendDelta: round1(delta) };
  if (delta <= -0.25) return { trend: "down", trendDelta: round1(delta) };
  return { trend: "stable", trendDelta: round1(delta) };
}

/**
 * Age adjustment: modest ±10% of raw change magnitude.
 * Young improving → slight credit; peak-age → neutral; older maintaining → slight floor.
 */
export function ageAdjustmentFactor(age: number | null, rawChange: number): number {
  if (age == null || !Number.isFinite(age)) return 0;
  const mag = Math.abs(rawChange);
  if (mag < 0.05) return 0;
  let pct = 0;
  if (age <= 23) pct = 0.08;
  else if (age <= 26) pct = 0.04;
  else if (age <= 30) pct = 0;
  else if (age <= 33) pct = -0.02;
  else pct = -0.04;
  // Cap at ±10% of raw change
  const adj = rawChange * pct;
  const cap = mag * 0.1;
  return Math.max(-cap, Math.min(cap, adj));
}

/** Lower baselines get slightly more credit for the same absolute lift (ceiling effect). */
export function ceilingFactor(baseline: number): number {
  // baseline 5 → 1.15, 7 → 1.05, 9 → 0.92
  return clamp(1.25 - baseline * 0.035, 0.85, 1.2);
}

export function sampleSizeFactor(underN: number, baselineN: number): number {
  const under = underN >= 10 ? 1 : underN >= 5 ? 0.92 : underN >= 3 ? 0.78 : 0.55;
  const base = baselineN >= 5 ? 1 : baselineN >= 3 ? 0.95 : baselineN >= 2 ? 0.85 : 0.7;
  return under * base;
}

export function opportunityFactor(starts: number, apps: number, minutes: number): number {
  const startShare = apps > 0 ? starts / apps : 0;
  const minPerApp = apps > 0 ? minutes / apps : 0;
  let f = 0.85;
  if (apps >= 8) f += 0.08;
  else if (apps >= 5) f += 0.04;
  if (startShare >= 0.7) f += 0.06;
  else if (startShare >= 0.4) f += 0.03;
  if (minPerApp >= 60) f += 0.05;
  else if (minPerApp >= 40) f += 0.02;
  return clamp(f, 0.75, 1.1);
}

export function confidenceFromSamples(
  underN: number,
  baselineN: number,
  baselineSource: DevelopmentBaselineSource,
  minutes: number,
): { label: DevelopmentConfidenceLabel; pct: number } {
  let pct = 35;
  if (underN >= 10) pct += 25;
  else if (underN >= 5) pct += 18;
  else if (underN >= 3) pct += 8;
  if (baselineSource === "pre_coach_last_5") pct += 20;
  else if (baselineSource === "tenure_start_first_3") pct += 8;
  if (baselineN >= 5) pct += 8;
  else if (baselineN >= 3) pct += 4;
  if (minutes >= 400) pct += 8;
  else if (minutes >= 200) pct += 4;
  pct = clamp(Math.round(pct), 0, 99);

  let label: DevelopmentConfidenceLabel = "INSUFFICIENT";
  if (underN >= 10 && baselineSource === "pre_coach_last_5" && pct >= 75) label = "HIGH";
  else if (underN >= 5 && pct >= 55) label = "MEDIUM";
  else if (underN >= 3 && pct >= 40) label = "LOW";
  else label = "INSUFFICIENT";

  return { label, pct };
}

/**
 * Map adjusted development (rating-point space after factors) onto 0–100 score.
 * Neutral (0 change) ≈ 50. ±2 rating points ≈ ±25 score.
 */
export function toDevelopmentScore(adjustedDelta: number): number {
  return round1(clamp(50 + adjustedDelta * 12.5));
}

export function calculatePlayerDevelopmentRow(
  input: CoachPlayerDevelopmentInput,
): CoachPlayerDevelopmentRow {
  const dataIssues: string[] = [];
  if (!input.playerName?.trim()) dataIssues.push("unresolved_player_name");

  const under = input.appearances
    .filter((a) => a.underCoach)
    .sort((a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0));

  const appearancesUnderCoach = under.length;
  const startsUnderCoach = under.filter((a) => isStartRole(a.isStart)).length;
  const minutesUnderCoach = under.reduce((s, a) => s + (a.minutesPlayed || 0), 0);

  const baseline = resolveBaseline(input.appearances, input.tenureStartAt);
  const current = resolveCurrentUnderCoach(under);
  const trend = resolveTrend(under);

  let rawChange: number | null = null;
  let displayedChange: number | null = null;
  let adjustedDevelopmentScore: number | null = null;

  let teamAdjustment = 0;
  let ageAdj = 0;
  let sampleFactor = 0;
  let oppFactor = 0;
  let ceilFactor = 1;

  if (
    baseline.baselineRating != null &&
    current.currentRating != null &&
    under.length >= MIN_PROVISIONAL
  ) {
    rawChange = current.currentRating - baseline.baselineRating;
    displayedChange = round1(rawChange);

    // Team-wide fairness: subtract a portion of squad lift
    const teamDelta = input.teamWideRatingDelta ?? 0;
    teamAdjustment = teamDelta !== 0 ? -(teamDelta * 0.35) : 0;

    ageAdj = ageAdjustmentFactor(input.age, rawChange);
    sampleFactor = sampleSizeFactor(under.length, baseline.baselineSampleSize);
    oppFactor = opportunityFactor(startsUnderCoach, appearancesUnderCoach, minutesUnderCoach);
    ceilFactor = ceilingFactor(baseline.baselineRating);

    const adjustedDelta =
      (rawChange + teamAdjustment + ageAdj) * sampleFactor * oppFactor * ceilFactor;
    adjustedDevelopmentScore = toDevelopmentScore(adjustedDelta);
  } else if (under.length < MIN_PROVISIONAL) {
    dataIssues.push("insufficient_under_coach_sample");
  } else if (baseline.baselineRating == null) {
    dataIssues.push("insufficient_baseline");
  }

  const conf = confidenceFromSamples(
    under.length,
    baseline.baselineSampleSize,
    baseline.baselineSource,
    minutesUnderCoach,
  );

  const eligibleProvisional = under.length >= MIN_PROVISIONAL && displayedChange != null;
  const eligiblePublic =
    under.length >= MIN_PUBLIC &&
    displayedChange != null &&
    conf.label !== "INSUFFICIENT" &&
    Boolean(input.playerName?.trim());

  return {
    playerId: input.playerId,
    playerName: input.playerName?.trim() || "Unknown player",
    playerSlug: input.playerSlug,
    playerImageUrl: input.playerImageUrl,
    position: input.position,
    age: input.age,
    appearancesUnderCoach,
    startsUnderCoach,
    minutesUnderCoach,
    ratedAppsUnderCoach: under.length,
    baselineRating: baseline.baselineRating != null ? round1(baseline.baselineRating) : null,
    baselineSource: baseline.baselineSource,
    baselineSampleSize: baseline.baselineSampleSize,
    currentRating: current.currentRating != null ? round1(current.currentRating) : null,
    currentSampleSize: current.currentSampleSize,
    displayedChange,
    rawChange: rawChange != null ? round1(rawChange) : null,
    adjustedDevelopmentScore,
    trend: trend.trend,
    trendDelta: trend.trendDelta,
    confidence: conf.label,
    confidencePct: conf.pct,
    debutGiven: Boolean(input.debutGiven),
    debutType: input.debutType ?? null,
    careerHighUnderCoach: Boolean(input.careerHighUnderCoach),
    eligiblePublic,
    eligibleProvisional,
    dataIssues,
    calc: {
      teamAdjustment: round1(teamAdjustment),
      ageAdjustment: round1(ageAdj),
      sampleFactor: round1(sampleFactor),
      opportunityFactor: round1(oppFactor),
      ceilingFactor: round1(ceilFactor),
    },
    modelVersion: COACH_PLAYER_DEVELOPMENT_VERSION,
  };
}

export function rankMostImproved(
  rows: CoachPlayerDevelopmentRow[],
  limit = 5,
  mode: "public" | "provisional" = "public",
): CoachPlayerDevelopmentRow[] {
  const pool = rows.filter((r) =>
    mode === "public" ? r.eligiblePublic : r.eligibleProvisional,
  );
  return [...pool]
    .sort((a, b) => {
      const as = a.adjustedDevelopmentScore ?? -1;
      const bs = b.adjustedDevelopmentScore ?? -1;
      if (bs !== as) return bs - as;
      return (b.displayedChange ?? -999) - (a.displayedChange ?? -999);
    })
    .slice(0, limit);
}

/**
 * Coach-level Player Development Intelligence score (0–100) from player rows.
 */
export function calculateCoachDevelopmentScore(
  rows: CoachPlayerDevelopmentRow[],
): {
  score: number | null;
  components: Record<string, number | null>;
} {
  const eligible = rows.filter((r) => r.eligibleProvisional && r.adjustedDevelopmentScore != null);
  if (eligible.length < 3) {
    return {
      score: null,
      components: {
        average_adjusted: null,
        top5_development: null,
        young_player_development: null,
        debutants: null,
        career_highs: null,
        development_breadth: null,
      },
    };
  }

  const scores = eligible.map((r) => r.adjustedDevelopmentScore!);
  const averageAdjusted = avg(scores);

  const top5 = rankMostImproved(eligible, 5, "provisional");
  const top5Avg = avg(top5.map((r) => r.adjustedDevelopmentScore!).filter(Boolean));

  const young = eligible.filter((r) => r.age != null && r.age <= 24);
  const youngAvg = young.length
    ? avg(young.map((r) => r.adjustedDevelopmentScore!).filter(Boolean))
    : null;

  const debutShare = eligible.filter((r) => r.debutGiven).length / eligible.length;
  const debutScore = clamp(40 + debutShare * 80);

  const highShare = eligible.filter((r) => r.careerHighUnderCoach).length / eligible.length;
  const highScore = clamp(40 + highShare * 80);

  const meaningful = eligible.filter((r) => (r.displayedChange ?? 0) >= 0.4).length;
  const breadth = clamp(35 + (meaningful / Math.max(eligible.length, 1)) * 65);

  const components = {
    average_adjusted: averageAdjusted != null ? round1(averageAdjusted) : null,
    top5_development: top5Avg != null ? round1(top5Avg) : null,
    young_player_development: youngAvg != null ? round1(youngAvg) : averageAdjusted != null ? round1(averageAdjusted) : null,
    debutants: round1(debutScore),
    career_highs: round1(highScore),
    development_breadth: round1(breadth),
  };

  const score = round1(
    clamp(
      (components.average_adjusted ?? 50) * 0.35 +
        (components.top5_development ?? 50) * 0.2 +
        (components.young_player_development ?? 50) * 0.15 +
        (components.debutants ?? 50) * 0.1 +
        (components.career_highs ?? 50) * 0.1 +
        (components.development_breadth ?? 50) * 0.1,
    ),
  );

  return { score, components };
}

export function buildCoachPlayerDevelopmentBundle(
  rows: CoachPlayerDevelopmentRow[],
  meta: {
    playersUsed: number;
    ratedAppearanceCoveragePct?: number | null;
  },
): CoachPlayerDevelopmentBundle {
  const eligible = rows.filter((r) => r.eligiblePublic);
  const provisional = rows.filter((r) => r.eligibleProvisional);
  const high = rows.filter((r) => r.confidence === "HIGH").length;
  const medium = rows.filter((r) => r.confidence === "MEDIUM").length;
  const insufficient = rows.filter(
    (r) => r.confidence === "INSUFFICIENT" || r.confidence === "LOW",
  ).length;

  const coachScore = calculateCoachDevelopmentScore(rows);
  const mostImproved = rankMostImproved(rows, 5, "public");

  const enoughData = mostImproved.length >= 3;

  return {
    modelVersion: COACH_PLAYER_DEVELOPMENT_VERSION,
    enoughData,
    message: enoughData
      ? null
      : "INSUFFICIENT PLAYER DEVELOPMENT DATA",
    playersUsed: meta.playersUsed,
    eligibleForDevelopment: provisional.length,
    highConfidence: high,
    mediumConfidence: medium,
    insufficientData: insufficient,
    ratedAppearanceCoveragePct: meta.ratedAppearanceCoveragePct ?? null,
    mostImproved,
    allPlayers: [...rows].sort(
      (a, b) => (b.adjustedDevelopmentScore ?? -1) - (a.adjustedDevelopmentScore ?? -1),
    ),
    coachDevelopmentScore: coachScore.score,
    coachDevelopmentComponents: coachScore.components,
  };
}
