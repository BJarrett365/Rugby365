import { describe, expect, it } from "vitest";
import {
  baseMarketValueFromRating,
  buildValueTimeline,
  computePlayerValue,
  contractSalaryFromRating,
  formatGbpCompact,
} from "./player-value-math";

describe("player-value-math", () => {
  it("maps rating bands to market midpoints", () => {
    expect(baseMarketValueFromRating(97).bandLabel).toBe("95–99");
    expect(baseMarketValueFromRating(92).midGbp).toBe(1_150_000);
    expect(baseMarketValueFromRating(70).midGbp).toBe(55_000);
  });

  it("suggests contract salaries by rating", () => {
    expect(contractSalaryFromRating(96)).toBeGreaterThan(900_000);
    expect(contractSalaryFromRating(78)).toBe(90_000);
  });

  it("values a Dupont-class profile higher than a squad player", () => {
    const star = computePlayerValue({
      currentRating: 96,
      seasonRating: 95,
      formScore: 92,
      lastFiveMatchRatings: [8.5, 9.0, 8.8, 9.2, 8.7],
      potential: 97,
      reputation: 95,
      age: 28,
      positionName: "Scrum-half",
      competitionKey: "top-14",
      internationalCaps: 55,
      contractMonthsRemaining: 24,
      daysUnavailableLastYear: 0,
      isCaptain: true,
      hasSocialPresence: true,
      mediaNudgePct: null,
    });
    const squad = computePlayerValue({
      currentRating: 72,
      seasonRating: 70,
      formScore: 68,
      lastFiveMatchRatings: [6.0, 5.8, 6.2, 6.1, 5.9],
      potential: 74,
      reputation: 60,
      age: 26,
      positionName: "Centre",
      competitionKey: "currie-cup",
      internationalCaps: 0,
      contractMonthsRemaining: null,
      daysUnavailableLastYear: 40,
      isCaptain: false,
      hasSocialPresence: false,
      mediaNudgePct: null,
    });
    expect(star.marketValueGbp).toBeGreaterThan(1_500_000);
    expect(squad.marketValueGbp).toBeLessThan(200_000);
    expect(star.confidence).toBeGreaterThanOrEqual(squad.confidence);
    expect(star.factors.some((f) => f.key === "international" && f.pct > 0)).toBe(true);
  });

  it("applies injury and age risk", () => {
    const healthy = computePlayerValue({
      currentRating: 85,
      seasonRating: 84,
      formScore: 82,
      lastFiveMatchRatings: [7.5, 7.2, 7.8],
      potential: 86,
      reputation: 80,
      age: 27,
      positionName: "Fly-half",
      competitionKey: "premiership",
      internationalCaps: 20,
      contractMonthsRemaining: 18,
      daysUnavailableLastYear: 0,
      isCaptain: false,
      hasSocialPresence: true,
      mediaNudgePct: null,
    });
    const vet = computePlayerValue({
      currentRating: 85,
      seasonRating: 84,
      formScore: 82,
      lastFiveMatchRatings: [7.5, 7.2, 7.8],
      potential: 86,
      reputation: 80,
      age: 34,
      positionName: "Fly-half",
      competitionKey: "premiership",
      internationalCaps: 20,
      contractMonthsRemaining: 4,
      daysUnavailableLastYear: 140,
      isCaptain: false,
      hasSocialPresence: true,
      mediaNudgePct: null,
    });
    expect(vet.marketValueGbp).toBeLessThan(healthy.marketValueGbp);
    expect(vet.riskScore).toBeGreaterThan(healthy.riskScore);
  });

  it("builds a five-year timeline ending at current value", () => {
    const points = buildValueTimeline({
      currentYear: 2026,
      currentMarketValueGbp: 1_820_000,
      ratingByYear: { 2024: 82, 2025: 86 },
    });
    expect(points).toHaveLength(5);
    expect(points.at(-1)?.marketValueGbp).toBe(1_820_000);
    expect(points.find((p) => p.year === 2024)?.marketValueGbp).toBe(300_000);
  });

  it("formats GBP compactly", () => {
    expect(formatGbpCompact(2_350_000)).toMatch(/£2/);
    expect(formatGbpCompact(185_000)).toBe("£185k");
  });
});
