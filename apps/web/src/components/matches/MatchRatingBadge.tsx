"use client";

import type { MatchRatingDisplay, PerformanceBand } from "@/lib/match-rating-service";

function bandClass(band: PerformanceBand | null): string {
  switch (band) {
    case "exceptional":
      return "match-rating-badge--exceptional";
    case "outstanding":
      return "match-rating-badge--outstanding";
    case "very_good":
      return "match-rating-badge--very-good";
    case "solid":
      return "match-rating-badge--solid";
    case "below_average":
      return "match-rating-badge--below";
    case "poor":
      return "match-rating-badge--poor";
    default:
      return "match-rating-badge--na";
  }
}

function bandTitle(band: PerformanceBand | null, status: string): string {
  if (!band) return status === "unavailable" ? "Rating unavailable" : "No band";
  const labels: Record<PerformanceBand, string> = {
    exceptional: "Exceptional performance",
    outstanding: "Outstanding performance",
    very_good: "Very good performance",
    solid: "Solid performance",
    below_average: "Below-average performance",
    poor: "Poor performance",
  };
  return status === "provisional" ? `${labels[band]} (provisional)` : labels[band];
}

/** Career Rating badge (career-v1, 35–99) — separate from Match Rating. */
export function CareerRatingBadge({
  value,
}: {
  value: number | null | undefined;
}) {
  if (value == null) {
    return (
      <span className="career-rating-badge career-rating-badge--na" title="Career Rating unavailable">
        —
      </span>
    );
  }
  return (
    <span
      className="career-rating-badge"
      title={`Career Rating (career-v1): overall player quality ${value}`}
    >
      <span className="career-rating-badge__label">Career</span>
      <span className="career-rating-badge__value">{value}</span>
    </span>
  );
}

/**
 * Combined line-up cell: Career | Match (or Form) | Trend
 * Keep career and match visually separate — never merge scores.
 */
export function DualRatingCell({
  rating,
  mode = "auto",
}: {
  rating: MatchRatingDisplay | null | undefined;
  /** completed = show Match; scheduled = show Form; auto = match if present else form */
  mode?: "completed" | "scheduled" | "auto";
}) {
  const career = rating?.careerRating ?? null;
  const hasMatch =
    rating != null &&
    rating.rating != null &&
    rating.ratingStatus !== "unavailable";
  const showMatch =
    mode === "completed" || (mode === "auto" && hasMatch);
  const showForm = !showMatch && rating?.formRating != null;

  return (
    <div className="dual-rating-cell" aria-label="Career and match ratings">
      <CareerRatingBadge value={career} />
      <span className="dual-rating-cell__sep" aria-hidden>
        |
      </span>
      {showMatch && rating ? (
        <MatchRatingBadge rating={rating} showPrefix />
      ) : showForm && rating ? (
        <span
          className="match-rating-badge match-rating-badge--form"
          title="Form Rating from recent Match Ratings (not Career)"
        >
          {rating.formLabel}
        </span>
      ) : (
        <span className="match-rating-badge match-rating-badge--na" title="Match Rating unavailable">
          —
        </span>
      )}
    </div>
  );
}

export function MatchRatingBadge({
  rating,
  compact = false,
  showPrefix = false,
}: {
  rating: MatchRatingDisplay | null | undefined;
  compact?: boolean;
  showPrefix?: boolean;
}) {
  if (!rating || rating.rating == null || rating.ratingStatus === "unavailable") {
    return (
      <span className="match-rating-badge match-rating-badge--na" title="Match Rating unavailable">
        —
      </span>
    );
  }

  return (
    <span
      className={`match-rating-badge ${bandClass(rating.performanceBand)}${compact ? " match-rating-badge--compact" : ""}`}
      title={bandTitle(rating.performanceBand, rating.ratingStatus)}
    >
      {showPrefix && <span className="match-rating-badge__prefix">Match</span>}
      <span className="match-rating-badge__value">{rating.ratingLabel}</span>
      {rating.ratingStatus !== "unavailable" && (
        <span className="match-rating-badge__trend" aria-label={rating.performanceTrendLabel}>
          {rating.performanceTrendLabel}
        </span>
      )}
    </span>
  );
}

export function SelectionTrendChip({ rating }: { rating: MatchRatingDisplay | null | undefined }) {
  if (!rating?.selectionBadge) return null;
  return (
    <span
      className="match-selection-chip"
      title={`Selection: ${rating.selectionPreviousRole ?? "—"} → ${rating.selectionCurrentRole ?? "—"}`}
    >
      {rating.selectionBadge}
    </span>
  );
}
