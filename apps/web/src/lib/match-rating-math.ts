/**
 * Pure Rugby365 Match Rating helpers (no DB).
 * Display and storage always use this same formula — never invent a second rating.
 */

export type MatchRatingStatus = "final" | "provisional" | "unavailable";
export type PerformanceBand =
  | "exceptional"
  | "outstanding"
  | "very_good"
  | "solid"
  | "below_average"
  | "poor";
export type PerformanceTrend = "up" | "down" | "flat" | "new";
export type SelectionTrend = "up" | "down" | "flat" | "new" | "unknown";
export type SquadRole = "starter" | "replacement" | "not_selected";

/**
 * Match ratings (1–10) publish after the fixture is complete.
 * Career ratings are available before kick-off and refresh after full time.
 */
export function isFixtureRatingsPublished(status: string): boolean {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, "_");
  return (
    normalized === "full_time" ||
    normalized === "completed" ||
    normalized === "result" ||
    normalized === "finished" ||
    normalized === "ft"
  );
}

export function clampMatchRating10(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value * 10) / 10));
}

export function performanceBandFor(rating: number): PerformanceBand {
  if (rating >= 9) return "exceptional";
  if (rating >= 8) return "outstanding";
  if (rating >= 7) return "very_good";
  if (rating >= 6) return "solid";
  if (rating >= 5) return "below_average";
  return "poor";
}

export function bandLabel(band: PerformanceBand): string {
  switch (band) {
    case "exceptional":
      return "Exceptional";
    case "outstanding":
      return "Outstanding";
    case "very_good":
      return "Very good";
    case "solid":
      return "Solid";
    case "below_average":
      return "Below average";
    case "poor":
      return "Poor";
  }
}

export function formatMatchRatingDisplay(
  rating: number | null,
  status: MatchRatingStatus,
): string {
  if (rating == null || status === "unavailable") return "—";
  const value = rating.toFixed(1);
  return status === "provisional" ? `${value}*` : value;
}

export function performanceTrendLabel(
  trend: PerformanceTrend | null,
  change: number | null,
): string {
  if (trend === "new" || change == null) return "NEW";
  if (trend === "flat") return "→ 0.0";
  const signed = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
  if (trend === "up") return `▲ ${signed}`;
  if (trend === "down") return `▼ ${signed}`;
  return "NEW";
}

export function computeSelectionMovement(
  previous: SquadRole | null,
  current: SquadRole,
): { trend: SelectionTrend; badge: string } {
  if (!previous) return { trend: "new", badge: "NEW" };
  if (previous === current) {
    if (current === "starter") return { trend: "flat", badge: "Starter → Starter" };
    if (current === "replacement") return { trend: "flat", badge: "Bench → Bench" };
    return { trend: "flat", badge: "Out → Out" };
  }
  if (previous === "not_selected" && current === "starter") {
    return { trend: "up", badge: "START ▲" };
  }
  if (previous === "not_selected" && current === "replacement") {
    return { trend: "up", badge: "RETURN ▲" };
  }
  if (previous === "replacement" && current === "starter") {
    return { trend: "up", badge: "START ▲" };
  }
  if (previous === "starter" && current === "replacement") {
    return { trend: "down", badge: "BENCH ▼" };
  }
  if (current === "not_selected") {
    return { trend: "down", badge: "OUT ▼" };
  }
  return { trend: "unknown", badge: `${previous} → ${current}` };
}

/** Models are separate signals — never merge into one score. */
export const CAREER_RATING_MODEL = "career-v1" as const;
export const MATCH_RATING_MODEL = "match-v1" as const;

/**
 * Form Rating (1–10) from recent Match Ratings only.
 * More weight on newer matches. Never derived from Career Rating.
 */
export function computeFormRatingFromMatchRatings(
  recentNewestFirst: Array<number | null | undefined>,
  windowSize: 3 | 5 | 10 = 5,
): { formRating: number | null; formTrend: PerformanceTrend | null; sampleSize: number } {
  const values = recentNewestFirst
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .slice(0, windowSize);
  if (!values.length) return { formRating: null, formTrend: null, sampleSize: 0 };

  // Weights: newest gets highest (window … 1)
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    const weight = values.length - i;
    weighted += values[i]! * weight;
    weightSum += weight;
  }
  const formRating = clampMatchRating10(weighted / weightSum);

  let formTrend: PerformanceTrend | null = "new";
  if (values.length >= 2) {
    const newest = values[0]!;
    const previous = values[1]!;
    const delta = Math.round((newest - previous) * 10) / 10;
    if (Math.abs(delta) < 0.05) formTrend = "flat";
    else if (delta > 0) formTrend = "up";
    else formTrend = "down";
  }

  return { formRating, formTrend, sampleSize: values.length };
}

export function formTrendLabel(trend: PerformanceTrend | null, formRating: number | null): string {
  if (formRating == null) return "—";
  const value = formRating.toFixed(1);
  if (trend === "up") return `Form ${value} ▲`;
  if (trend === "down") return `Form ${value} ▼`;
  if (trend === "flat") return `Form ${value} →`;
  return `Form ${value}`;
}

export function computeMatchRating10(row: {
  minutesPlayed: number;
  tries: number;
  points: number;
  carries: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  tryAssists: number;
  lineBreaks: number;
  defendersBeaten: number;
  touches: number;
  postContactMetres: number;
  ruckArrivalEffectiveness: number;
  extras?: Record<string, unknown> | null;
}): { rating: number; attack: number; defence: number; explanation: string } {
  const missedTackles = Number(row.extras?.missed_tackles ?? row.extras?.missedTackles ?? 0);
  const handlingErrors = Number(
    row.extras?.handling_errors ?? row.extras?.handlingErrors ?? row.extras?.errors ?? 0,
  );
  // Lightweight attack/defence contributions aligned with SDMS score helpers.
  const attack =
    row.points +
    row.tries * 5 +
    row.metresCarried +
    row.carries +
    row.lineBreaks +
    row.tryAssists * 3 +
    row.defendersBeaten;
  const defence =
    row.tacklesCompleted + row.dominantTackles * 2 + row.turnoversWon * 3 + row.tacklesMade * 0.2;
  const minutesFactor = row.minutesPlayed > 0 ? Math.min(1, row.minutesPlayed / 80) : 0.25;
  const raw =
    5.2 +
    attack * 0.012 +
    defence * 0.02 +
    minutesFactor * 1.4 -
    handlingErrors * 0.25 -
    missedTackles * 0.15;
  const rating = clampMatchRating10(raw);
  const band = performanceBandFor(rating);
  const explanation = `${bandLabel(band)} performance (${rating.toFixed(1)}) from attack contribution ${Math.round(attack)}, defence contribution ${Math.round(defence)}, and ${row.minutesPlayed} minutes.`;
  return { rating, attack, defence, explanation };
}
