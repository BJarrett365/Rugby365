import { describe, expect, it } from "vitest";
import { computeLegendScore, LEGEND_SCORE_MODEL } from "./legend-score-math";

describe("computeLegendScore", () => {
  it("scores a modern GOAT captain highly", () => {
    const result = computeLegendScore({
      careerRating: 96,
      peakRating: 98,
      reputation: 95,
      legendLevel: "rugby_icon",
      collectionSlugs: ["greatest-players", "greatest-captains", "greatest-all-blacks"],
      titleCount: 4,
      internationalApps: 148,
      clubStintCount: 2,
    });
    expect(result.modelVersion).toBe(LEGEND_SCORE_MODEL);
    expect(result.overallScore).toBeGreaterThanOrEqual(88);
    expect(result.hallOfFameStatus).toBe("rugby_icon");
    expect(result.components.leadershipRating).toBeGreaterThanOrEqual(88);
  });

  it("uses legend-level baseline when ratings are missing", () => {
    const result = computeLegendScore({
      careerRating: null,
      peakRating: null,
      reputation: null,
      legendLevel: "hall_of_fame",
      collectionSlugs: ["greatest-players"],
      titleCount: 0,
      internationalApps: null,
      clubStintCount: null,
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.components.careerRating).toBe(92);
  });

  it("respects CMS overall override", () => {
    const result = computeLegendScore({
      careerRating: 70,
      peakRating: 70,
      reputation: 70,
      legendLevel: "club_legend",
      collectionSlugs: [],
      titleCount: 0,
      internationalApps: 10,
      clubStintCount: 1,
      overrides: { overallScore: 99 },
    });
    expect(result.overallScore).toBe(99);
  });
});
