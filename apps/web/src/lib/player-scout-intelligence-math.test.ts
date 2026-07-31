import { describe, expect, it } from "vitest";
import {
  computeScoutIntelligence,
  recommendationLabel,
  rriBand,
  rriGrade,
  starsFromRri,
} from "./player-scout-intelligence-math";

describe("player-scout-intelligence-math", () => {
  it("scores an elite prime target highly", () => {
    const result = computeScoutIntelligence({
      currentAbility: 88,
      potential: 92,
      formScore: 86,
      lastFiveMatchRatings: [8.2, 7.9, 8.5, 8.0, 8.1],
      attackRating: 84,
      defenceRating: 90,
      disciplineRating: 82,
      reputation: 85,
      age: 25,
      positionName: "Blindside Flanker",
      internationalCaps: 18,
      contractMonthsRemaining: 14,
      daysUnavailableLastYear: 5,
      injuryEventsLastTwoYears: 0,
      marketValueGbp: 1_800_000,
      transferValueGbp: 2_300_000,
      contractValueGbp: 320_000,
      heightCm: 196,
      weightKg: 112,
      isCaptain: false,
      agentLabel: "Elite Agency",
    });

    expect(result.rriScore).toBeGreaterThanOrEqual(82);
    expect(result.recommendation).toBe("sign_now");
    expect(result.rriBand).toBe(rriBand(result.rriScore));
    expect(result.rriGrade).toBe(rriGrade(result.rriScore));
    expect(result.playerDna.workRate).toBeGreaterThan(70);
    expect(result.aiSummary.toLowerCase()).toContain("flanker");
    expect(result.factors).toHaveLength(9);
    expect(result.factors.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 5);
  });

  it("flags high injury + low form as do_not_pursue or monitor", () => {
    const result = computeScoutIntelligence({
      currentAbility: 62,
      potential: 64,
      formScore: 40,
      lastFiveMatchRatings: [4.5, 5.0, 4.2],
      attackRating: 55,
      defenceRating: 58,
      disciplineRating: 48,
      reputation: 50,
      age: 32,
      positionName: "Centre",
      internationalCaps: 0,
      contractMonthsRemaining: 36,
      daysUnavailableLastYear: 160,
      injuryEventsLastTwoYears: 4,
      marketValueGbp: 80_000,
      transferValueGbp: 50_000,
      contractValueGbp: 40_000,
      heightCm: 185,
      weightKg: 98,
      isCaptain: false,
      agentLabel: null,
    });

    expect(result.rriScore).toBeLessThan(60);
    expect(["do_not_pursue", "monitor"]).toContain(result.recommendation);
    expect(result.riskInjury).toBe("high");
  });

  it("honours CMS overrides", () => {
    const result = computeScoutIntelligence({
      currentAbility: 70,
      potential: 72,
      formScore: 70,
      lastFiveMatchRatings: [],
      attackRating: 70,
      defenceRating: 70,
      disciplineRating: 70,
      reputation: 70,
      age: 26,
      positionName: "Wing",
      internationalCaps: 2,
      contractMonthsRemaining: 20,
      daysUnavailableLastYear: 10,
      injuryEventsLastTwoYears: 1,
      marketValueGbp: 400_000,
      transferValueGbp: 500_000,
      contractValueGbp: 150_000,
      heightCm: 188,
      weightKg: 95,
      isCaptain: false,
      agentLabel: null,
      overrides: {
        rriScore: 94,
        recommendation: "sign_now",
        aiSummary: "Custom scout note.",
        playerDna: { leadership: 99 },
      },
    });

    expect(result.rriScore).toBe(94);
    expect(result.recommendation).toBe("sign_now");
    expect(result.aiSummary).toBe("Custom scout note.");
    expect(result.playerDna.leadership).toBe(99);
    expect(recommendationLabel(result.recommendation)).toBe("Sign Immediately");
    expect(starsFromRri(94)).toBe(5);
  });
});
