import { describe, expect, it } from "vitest";
import { computeValueScore } from "./player-potential";

describe("player-potential computeValueScore (compat)", () => {
  it("returns null score with reduced confidence for outlier profiles", () => {
    const outlier = computeValueScore({
      overallRating: 75,
      age: 30,
      formScore: 70,
      marketValueGbp: 120_000,
      contractMonthsRemaining: 6,
      verifiedCaps: 60,
      valueOutlier: true,
      valueChangePct: 5,
      competitionKey: "premiership",
      positionName: "Fly-half",
    });

    expect(outlier.score).toBeNull();
    expect(outlier.confidence).toBeLessThanOrEqual(25);
    expect(outlier.valueTrend).not.toBeNull();
    expect(outlier.transferInterest).toBeNull();
  });

  it("returns a numeric score when coverage allows and not an outlier", () => {
    const ok = computeValueScore({
      overallRating: 75,
      age: 28,
      formScore: 70,
      marketValueGbp: 200_000,
      contractMonthsRemaining: 24,
      verifiedCaps: 60,
      valueOutlier: false,
      valueChangePct: 5,
      competitionKey: "premiership",
      positionName: "Fly-half",
    });

    expect(ok.score).not.toBeNull();
    expect(ok.confidence).toBeGreaterThan(0);
    // No transfer evidence → —
    expect(ok.transferInterest).toBeNull();
  });
});
