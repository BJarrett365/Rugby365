import { describe, expect, it } from "vitest";
import { classifyOverallRating, evaluateValueHealth } from "./player-rating-presentation";

describe("player-rating-presentation", () => {
  it("does not return 'Lower Confidence' headline label", () => {
    const result = classifyOverallRating(50, "PARTIAL");
    expect(result.label).not.toBe("Lower Confidence");
    expect(result.label).toBe("Developing");
  });

  it("maps outlier health to OUTLIER status", () => {
    const health = evaluateValueHealth({
      marketValueGbp: 100_000,
      modelConfidence: 0.7,
      ratingState: "CURRENT",
      contractKnown: true,
      clubVerified: true,
      ageKnown: true,
      verifiedCaps: 60,
      outlierHeuristic: true,
    });
    expect(health.status).toBe("OUTLIER");
    expect(health.publicLabel).toBe("VALUE UNDER REVIEW");
    expect(health.displayConfidence).toBeLessThanOrEqual(0.35);
  });

  it("maps missing/uncertain inputs to UNDER_REVIEW", () => {
    const health = evaluateValueHealth({
      marketValueGbp: 250_000,
      modelConfidence: 0.7,
      ratingState: "CURRENT",
      contractKnown: false,
      clubVerified: false,
      ageKnown: true,
      verifiedCaps: 10,
      outlierHeuristic: false,
    });
    expect(health.status).toBe("UNDER_REVIEW");
    expect(health.publicLabel).toBe("VALUE UNDER REVIEW");
  });

  it("maps fully known inputs to HEALTHY", () => {
    const health = evaluateValueHealth({
      marketValueGbp: 250_000,
      modelConfidence: 0.7,
      ratingState: "CURRENT",
      contractKnown: true,
      clubVerified: true,
      ageKnown: true,
      verifiedCaps: 10,
      outlierHeuristic: false,
    });
    expect(health.status).toBe("HEALTHY");
    expect(health.publicLabel).toBe("RUGBY365 ESTIMATE");
  });
});

