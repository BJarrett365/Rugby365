import { describe, expect, it } from "vitest";
import {
  computeTeamRating,
  depthToRatingScore,
  valueToRatingScore,
} from "./team-rating-math";

describe("team-rating-math", () => {
  it("maps squad value on a log scale", () => {
    expect(valueToRatingScore(500_000)).toBeGreaterThan(35);
    expect(valueToRatingScore(5_000_000)!).toBeGreaterThan(valueToRatingScore(500_000)!);
  });

  it("scores depth from rated player count", () => {
    expect(depthToRatingScore(23)).toBeGreaterThan(depthToRatingScore(10));
  });

  it("computes an overall team rating in band", () => {
    const result = computeTeamRating({
      avgTop23Rating: 82,
      formWinPct: 70,
      squadValueGbp: 25_000_000,
      ratedPlayerCount: 30,
      trophyCount: 8,
    });
    expect(result.overall).not.toBeNull();
    expect(result.overall!).toBeGreaterThanOrEqual(35);
    expect(result.overall!).toBeLessThanOrEqual(99);
    expect(result.modelVersion).toBe("team-rating-v1");
  });
});
