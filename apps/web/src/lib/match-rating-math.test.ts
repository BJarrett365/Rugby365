import { describe, expect, it } from "vitest";
import {
  CAREER_RATING_MODEL,
  MATCH_RATING_MODEL,
  computeFormRatingFromMatchRatings,
  computeMatchRating10,
  computeSelectionMovement,
  formatMatchRatingDisplay,
  formTrendLabel,
  performanceTrendLabel,
} from "./match-rating-math";

describe("match-rating-math", () => {
  it("scores a strong attacking performance highly", () => {
    const result = computeMatchRating10({
      minutesPlayed: 80,
      tries: 2,
      points: 10,
      carries: 12,
      metresCarried: 81,
      tacklesMade: 9,
      tacklesCompleted: 9,
      dominantTackles: 1,
      turnoversWon: 0,
      tryAssists: 0,
      lineBreaks: 2,
      defendersBeaten: 3,
      touches: 20,
      postContactMetres: 40,
      ruckArrivalEffectiveness: 80,
      extras: {},
    });
    expect(result.rating).toBeGreaterThanOrEqual(8);
    expect(result.rating).toBeLessThanOrEqual(10);
  });

  it("formats provisional and unavailable ratings", () => {
    expect(formatMatchRatingDisplay(8.4, "final")).toBe("8.4");
    expect(formatMatchRatingDisplay(7.2, "provisional")).toBe("7.2*");
    expect(formatMatchRatingDisplay(null, "unavailable")).toBe("—");
  });

  it("formats trend labels", () => {
    expect(performanceTrendLabel("up", 0.6)).toBe("▲ +0.6");
    expect(performanceTrendLabel("down", -0.3)).toBe("▼ -0.3");
    expect(performanceTrendLabel("flat", 0)).toBe("→ 0.0");
    expect(performanceTrendLabel("new", null)).toBe("NEW");
  });

  it("computes selection movement badges", () => {
    expect(computeSelectionMovement("starter", "replacement").badge).toBe("BENCH ▼");
    expect(computeSelectionMovement("replacement", "starter").badge).toBe("START ▲");
    expect(computeSelectionMovement("starter", "not_selected").badge).toBe("OUT ▼");
    expect(computeSelectionMovement(null, "starter").badge).toBe("NEW");
  });

  it("keeps career and match model ids distinct", () => {
    expect(CAREER_RATING_MODEL).toBe("career-v1");
    expect(MATCH_RATING_MODEL).toBe("match-v1");
  });

  it("computes form from match ratings with recency weight", () => {
    const rising = computeFormRatingFromMatchRatings([9.1, 7.5, 7.0], 5);
    expect(rising.formRating).not.toBeNull();
    expect(rising.formTrend).toBe("up");
    expect(formTrendLabel(rising.formTrend, rising.formRating)).toContain("Form");
    expect(formTrendLabel(rising.formTrend, rising.formRating)).toContain("▲");

    const empty = computeFormRatingFromMatchRatings([], 5);
    expect(empty.formRating).toBeNull();
  });
});
