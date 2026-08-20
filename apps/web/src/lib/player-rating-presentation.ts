/**
 * Public presentation of player ratings / value — trust labels, not flattery.
 */

export type PlayerRatingPublicState =
  | "CURRENT"
  | "PROVISIONAL"
  | "PARTIAL"
  | "LOW_CONFIDENCE";

export type PlayerValueHealthStatus =
  | "HEALTHY"
  | "PARTIAL"
  | "OUTLIER"
  | "UNDER_REVIEW";

/** Centrally configured Rugby365 Rating bands — presentation of OVR only. */
export const RATING_CLASSIFICATION_BANDS = [
  { min: 90, label: "Elite / World Class", stars: 5 },
  { min: 85, label: "World Class", stars: 4.5 },
  { min: 80, label: "International Class", stars: 4 },
  { min: 75, label: "Top Level", stars: 3.5 },
  { min: 65, label: "Professional", stars: 3 },
  { min: 55, label: "Developing", stars: 2.5 },
  { min: 0, label: "Developing", stars: 2 },
] as const;

export const RANKING_MIN_ELIGIBLE = 5;
export const RANKING_PREFERRED_ELIGIBLE = 10;

export function resolveRatingPublicState(input: {
  overall: number | null;
  confidence: number | null; // 0–100 technical confidence
  coverage: number | null; // 0–100 input coverage
  dataPoints: number;
  modelVersion: string | null;
}): PlayerRatingPublicState {
  if (input.overall == null) return "LOW_CONFIDENCE";
  const coverage = input.coverage ?? 0;
  const confidence = input.confidence ?? 0;
  const points = input.dataPoints ?? 0;

  if (coverage < 50 || points < 10) return "PARTIAL";
  if (coverage < 85 || points < 40) return "PROVISIONAL";
  if (confidence < 60) return "LOW_CONFIDENCE";
  return "CURRENT";
}

export function classifyOverallRating(
  rating: number | null,
  state: PlayerRatingPublicState,
): { label: string; stars: number; provisionalNote: string | null } {
  if (rating == null || !Number.isFinite(rating)) {
    return { label: "Unrated", stars: 0, provisionalNote: null };
  }
  const band =
    RATING_CLASSIFICATION_BANDS.find((b) => rating >= b.min) ??
    RATING_CLASSIFICATION_BANDS[RATING_CLASSIFICATION_BANDS.length - 1]!;

  // Always show the actual Rugby365 ability band label.
  // Confidence / trust is presented separately (UI metadata + tooltips).
  const label = band.label;

  return {
    label,
    stars: band.stars,
    provisionalNote:
      state === "PROVISIONAL" || state === "PARTIAL" || state === "LOW_CONFIDENCE"
        ? "Classification based on current model coverage — trust is lower than a fully verified tier"
        : null,
  };
}

export function evaluateValueHealth(input: {
  marketValueGbp: number | null;
  modelConfidence: number | null; // 0–1
  ratingState: PlayerRatingPublicState;
  contractKnown: boolean;
  clubVerified: boolean;
  ageKnown: boolean;
  verifiedCaps: number | null;
  outlierHeuristic: boolean;
}): {
  status: PlayerValueHealthStatus;
  displayConfidence: number; // 0–1 adjusted for public trust
  reasons: string[];
  publicLabel: string;
} {
  const reasons: string[] = [];
  if (!input.contractKnown) reasons.push("contract missing");
  if (!input.clubVerified) reasons.push("current club uncertain");
  if (!input.ageKnown) reasons.push("age unknown");
  if (input.ratingState === "PROVISIONAL" || input.ratingState === "PARTIAL") {
    reasons.push("rating provisional / partial coverage");
  }
  if ((input.verifiedCaps ?? 0) >= 50 && (input.marketValueGbp ?? 0) > 0 && (input.marketValueGbp ?? 0) < 250_000) {
    reasons.push("elite international profile vs very low modelled value");
  }
  if (input.outlierHeuristic) reasons.push("VALUE OUTLIER REVIEW");

  let status: PlayerValueHealthStatus = "HEALTHY";
  if (input.outlierHeuristic || reasons.some((r) => r.includes("OUTLIER"))) {
    status = "OUTLIER";
  } else if (reasons.length >= 2) {
    status = "UNDER_REVIEW";
  } else if (reasons.length === 1) {
    status = "PARTIAL";
  }

  // Never present 92% confidence on incomplete inputs.
  let displayConfidence = input.modelConfidence ?? 0.35;
  if (!input.contractKnown) displayConfidence = Math.min(displayConfidence, 0.45);
  if (!input.clubVerified) displayConfidence = Math.min(displayConfidence, 0.4);
  if (input.ratingState !== "CURRENT") displayConfidence = Math.min(displayConfidence, 0.55);
  if (status === "OUTLIER" || status === "UNDER_REVIEW") {
    displayConfidence = Math.min(displayConfidence, 0.35);
  }

  const publicLabel =
    status === "OUTLIER" || status === "UNDER_REVIEW"
      ? "VALUE UNDER REVIEW"
      : status === "PARTIAL"
        ? "RUGBY365 ESTIMATE · LOW DATA CONFIDENCE"
        : "RUGBY365 ESTIMATE";

  return { status, displayConfidence, reasons, publicLabel };
}

/** Value factor presentation: distinguish missing data from a true 0 score. */
export function presentValueFactor(input: {
  key: string;
  label: string;
  pct: number;
  note: string;
}): {
  key: string;
  label: string;
  pct: number | null;
  missing: boolean;
  display: string;
  note: string;
} {
  const missingNotes = [
    "unknown",
    "not recorded",
    "no recent absence data",
    "potential unknown",
    "captaincy not recorded",
    "limited public commercial",
    "form data limited",
  ];
  const noteLower = input.note.toLowerCase();
  const looksMissing =
    input.pct === 0 && missingNotes.some((n) => noteLower.includes(n));

  if (looksMissing) {
    return {
      key: input.key,
      label: input.label,
      pct: null,
      missing: true,
      display: "— Missing",
      note: input.note,
    };
  }
  return {
    key: input.key,
    label: input.label,
    pct: input.pct,
    missing: false,
    display: `${input.pct > 0 ? "+" : ""}${input.pct}%`,
    note: input.note,
  };
}
