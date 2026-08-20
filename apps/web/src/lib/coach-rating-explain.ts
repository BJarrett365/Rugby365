/**
 * Deterministic “Why this rating?” copy from Coach Rating contributions.
 * OpenAI must not calculate ratings — this only narrates structured scores.
 */

import type { CoachRatingContribution } from "./coach-rating-engine";

export type CoachRatingExplanation = {
  headline: string;
  positiveDrivers: string[];
  holdingBack: string[];
};

export function explainCoachRating(input: {
  overallRating: number | null;
  contributions: CoachRatingContribution[];
  coverage?: number | null;
}): CoachRatingExplanation {
  const rating = input.overallRating;
  const headline =
    rating != null ? `WHY ${rating.toFixed(1)}?` : "WHY THIS RATING?";

  const positiveDrivers: string[] = [];
  const holdingBack: string[] = [];

  for (const c of input.contributions) {
    if (c.score >= 82) {
      positiveDrivers.push(driverLine(c, "strong"));
    } else if (c.score >= 75 && c.contribution >= (c.weight * 0.72)) {
      positiveDrivers.push(driverLine(c, "solid"));
    } else if (c.score < 65) {
      holdingBack.push(`${c.label} score (${Math.round(c.score)})`);
    } else if (c.score < 72 && c.weight >= 8) {
      holdingBack.push(`${c.label} below elite level (${Math.round(c.score)})`);
    }
  }

  if ((input.coverage ?? 100) < 70) {
    holdingBack.push("Incomplete historical data coverage");
  }

  const pi = input.contributions.find((c) => c.key === "power_index");
  if (pi && pi.score < 78 && rating != null && pi.score < rating - 1) {
    holdingBack.push("Power Index below overall Coach Rating");
  }

  return {
    headline,
    positiveDrivers: positiveDrivers.slice(0, 5),
    holdingBack: holdingBack.slice(0, 5),
  };
}

function driverLine(c: CoachRatingContribution, tone: "strong" | "solid"): string {
  if (c.key === "power_index") {
    return tone === "strong" ? "Strong current coaching strength" : "Solid Power Index";
  }
  if (c.key === "big_match_performance") return "High Big Match score";
  if (c.key === "experience") return "Elite experience";
  if (c.key === "team_improvement") return "Improved team performance";
  if (c.key === "career_results") return "Strong career results";
  if (c.key === "major_honours") return "Major honours haul";
  if (c.key === "player_development") return "Player development strength";
  if (c.key === "career_consistency") return "Career consistency";
  return `${c.label} (${Math.round(c.score)})`;
}

export function formatCoachStars(rating: number | null | undefined): string {
  if (rating == null) return "☆☆☆☆☆";
  const filled = Math.max(0, Math.min(5, Math.round(rating / 20)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function formatTrendArrow(trend: number | null | undefined): string {
  if (trend == null || trend === 0) return "—";
  return trend > 0 ? `↑${trend}` : `↓${Math.abs(trend)}`;
}
