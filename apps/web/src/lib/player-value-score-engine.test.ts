import { describe, expect, it } from "vitest";
import {
  computePlayerValueScore,
  resolveValueScoreRingFillPct,
  resolveValueScoreStatus,
  scoreValueTrendFromChangePct,
  sumValueScoreWeights,
  VALUE_SCORE_MODEL,
  VALUE_SCORE_WEIGHTS_V1,
} from "./player-value-score-engine";

describe("player-value-score-engine", () => {
  it("weights sum to 100", () => {
    expect(sumValueScoreWeights(VALUE_SCORE_WEIGHTS_V1)).toBe(100);
  });

  it("renormalises when factors are missing (UNKNOWN ≠ 0)", () => {
    const result = computePlayerValueScore({
      overallRating: 80,
      potential: null,
      valueChangePct90d: null,
      formScore: null,
      contractMonthsRemaining: null,
      verifiedCaps: 40,
      competitionKey: "premiership",
      positionName: "Fly-half",
      availabilityScore: null,
      commercialScore: null,
      transferInterestEvidence: false,
    });

    expect(result.excludedKeys).toContain("value_trend");
    expect(result.excludedKeys).toContain("transfer_interest");
    expect(result.excludedKeys).toContain("contract");
    expect(result.excludedKeys).toContain("availability");
    expect(result.excludedKeys).toContain("commercial");
    expect(result.reweighted).toBe(true);

    const included = result.factors.filter((f) => f.score != null);
    const weightSum = included.reduce((s, f) => s + f.weight, 0);
    expect(weightSum).toBeGreaterThan(99);
    expect(weightSum).toBeLessThan(101);

    // Missing factors contribute 0 weight — not a zero score pulling the average down.
    for (const key of result.excludedKeys) {
      const f = result.factors.find((x) => x.key === key)!;
      expect(f.score).toBeNull();
      expect(f.weight).toBe(0);
      expect(f.contribution).toBe(0);
    }
  });

  it("coverage <50 → UNDER_REVIEW with null published score", () => {
    const result = computePlayerValueScore({
      overallRating: null,
      potential: null,
      valueChangePct90d: null,
      formScore: 7,
      contractMonthsRemaining: null,
      verifiedCaps: null,
      competitionKey: null,
      positionName: null,
      availabilityScore: null,
      commercialScore: null,
      transferInterestEvidence: false,
    });

    // Only current_form (5) available → coverage 5
    expect(result.coverage).toBeLessThan(50);
    expect(result.status).toBe("UNDER_REVIEW");
    expect(result.valueScore).toBeNull();
    expect(result.publishable).toBe(false);
  });

  it("coverage 50–69 → PROVISIONAL with published score", () => {
    const result = computePlayerValueScore({
      overallRating: 78,
      potential: null,
      valueChangePct90d: null,
      formScore: null,
      contractMonthsRemaining: 18,
      verifiedCaps: 20,
      competitionKey: null,
      positionName: "Centre",
      availabilityScore: null,
      commercialScore: null,
      transferInterestEvidence: false,
    });

    // rating 25 + contract 10 + scarcity 7 + demand (needs signals) — demand may add 15
    expect(result.coverage).toBeGreaterThanOrEqual(50);
    expect(result.coverage).toBeLessThan(70);
    expect(result.status).toBe("PROVISIONAL");
    expect(result.valueScore).not.toBeNull();
  });

  it("coverage 70+ → CURRENT publishable score", () => {
    const result = computePlayerValueScore({
      overallRating: 86,
      potential: 87,
      valueChangePct90d: 8,
      formScore: 7.5,
      contractMonthsRemaining: 20,
      verifiedCaps: 70,
      competitionKey: "united rugby championship",
      positionName: "Fly-half",
      availabilityScore: 90,
      commercialScore: 70,
      transferInterestEvidence: true,
      transferInterestScore: 88,
    });

    expect(result.coverage).toBeGreaterThanOrEqual(70);
    expect(result.status).toBe("CURRENT");
    expect(result.valueScore).not.toBeNull();
    expect(result.valueScore).toBeGreaterThanOrEqual(70);
    expect(result.modelVersion).toBe(VALUE_SCORE_MODEL);
    expect(result.transferInterest).toBe("Very High");
    expect(result.marketDemand).not.toBeNull();
  });

  it("scores value trend from % movement bands (not Rising=100)", () => {
    expect(scoreValueTrendFromChangePct(25)).toBe(95);
    expect(scoreValueTrendFromChangePct(12)).toBe(85);
    expect(scoreValueTrendFromChangePct(6)).toBe(72);
    expect(scoreValueTrendFromChangePct(0)).toBe(50);
    expect(scoreValueTrendFromChangePct(-6)).toBe(28);
    expect(scoreValueTrendFromChangePct(-25)).toBe(8);
    expect(scoreValueTrendFromChangePct(null)).toBeNull();

    const rising = computePlayerValueScore({
      overallRating: 80,
      potential: 82,
      valueChangePct90d: 6,
      formScore: 70,
      contractMonthsRemaining: 18,
      verifiedCaps: 40,
      competitionKey: "premiership",
      positionName: "Fly-half",
      availabilityScore: 80,
      commercialScore: 50,
      transferInterestEvidence: false,
    });
    const trendFactor = rising.factors.find((f) => f.key === "value_trend")!;
    expect(trendFactor.score).toBe(72);
    expect(trendFactor.score).not.toBe(100);
  });

  it("does not invent transfer interest without evidence", () => {
    const result = computePlayerValueScore({
      overallRating: 90,
      potential: 91,
      valueChangePct90d: 10,
      formScore: 8,
      contractMonthsRemaining: 4,
      verifiedCaps: 80,
      competitionKey: "premiership",
      positionName: "Fly-half",
      availabilityScore: 90,
      commercialScore: 80,
      transferInterestEvidence: false,
    });

    expect(result.transferInterest).toBeNull();
    expect(result.excludedKeys).toContain("transfer_interest");
  });

  it("ring fill uses value score, never confidence", () => {
    expect(resolveValueScoreRingFillPct(95, 0.1)).toBe(95);
    expect(resolveValueScoreRingFillPct(40, 0.99)).toBe(40);
    expect(resolveValueScoreRingFillPct(null, 0.95)).toBeNull();
    expect(resolveValueScoreRingFillPct(null, 100)).toBeNull();
  });

  it("resolveValueScoreStatus thresholds", () => {
    const now = new Date();
    expect(resolveValueScoreStatus({ coverage: 40, calculatedAt: now })).toBe("UNDER_REVIEW");
    expect(resolveValueScoreStatus({ coverage: 55, calculatedAt: now })).toBe("PROVISIONAL");
    expect(resolveValueScoreStatus({ coverage: 80, calculatedAt: now })).toBe("CURRENT");
    const old = new Date(Date.now() - 200 * 86_400_000);
    expect(resolveValueScoreStatus({ coverage: 80, calculatedAt: old, staleAfterDays: 120 })).toBe(
      "STALE",
    );
  });
});
