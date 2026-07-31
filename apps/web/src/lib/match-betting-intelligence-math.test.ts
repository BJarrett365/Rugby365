import { describe, expect, it } from "vitest";
import {
  buildBetBuilderSuggestions,
  buildBettingSignals,
  buildTeamTrendWindows,
  combineLegProbabilities,
  computeBettingPrediction,
  computePlayerPropRow,
  probabilitiesFromEdge,
} from "./match-betting-intelligence-math";

describe("match-betting-intelligence-math", () => {
  it("keeps win probabilities summing to 100", () => {
    for (const edge of [-1.2, -0.3, 0, 0.4, 1.1]) {
      const p = probabilitiesFromEdge(edge);
      expect(p.homeWinPct + p.drawPct + p.awayWinPct).toBe(100);
    }
  });

  it("leans home when ratings, form and venue favour home", () => {
    const input = {
      homeName: "Leinster",
      awayName: "Toulouse",
      homeAvgRating: 88,
      awayAvgRating: 82,
      homeFormWins: 4,
      homeFormPlayed: 5,
      awayFormWins: 2,
      awayFormPlayed: 5,
      h2hHomeWins: 3,
      h2hAwayWins: 1,
      h2hDraws: 0,
      homeUnavailable: 1,
      awayUnavailable: 4,
      homeCoachRating: 8.2,
      awayCoachRating: 7.4,
      hasHomeVenue: true,
      weatherHarsh: false,
    };
    const signals = buildBettingSignals(input);
    const prediction = computeBettingPrediction(input, signals);
    expect(prediction.lean).toBe("home");
    expect(prediction.homeWinPct).toBeGreaterThan(prediction.awayWinPct);
    expect(prediction.confidencePct).toBeGreaterThanOrEqual(60);
  });

  it("builds L5/L10/home/away trend windows", () => {
    const matches = Array.from({ length: 12 }, (_, i) => ({
      kickoffAt: new Date(Date.UTC(2026, 0, 20 - i)),
      isHome: i % 2 === 0,
      pointsFor: i % 3 === 0 ? 20 : 30,
      pointsAgainst: i % 3 === 0 ? 28 : 18,
      triesFor: 3,
      dayOfWeek: i % 2 === 0 ? 5 : 6,
      wetWeather: i < 3,
    }));
    const windows = buildTeamTrendWindows(matches);
    expect(windows.find((w) => w.key === "l5")?.played).toBe(5);
    expect(windows.find((w) => w.key === "l10")?.played).toBe(10);
    expect(windows.find((w) => w.key === "home")?.played).toBeGreaterThan(0);
    expect(windows.find((w) => w.key === "friday")?.played).toBeGreaterThanOrEqual(2);
  });

  it("models player try probability and bet builder confidence", () => {
    const prop = computePlayerPropRow({
      playerId: "p1",
      playerName: "James Lowe",
      teamSide: "home",
      positionName: "Wing",
      jerseyNumber: 11,
      careerRating: 90,
      formRating: 7.8,
      squadRole: "starter",
      tryRate: 0.35,
      sampleMatches: 8,
      avgTackles: 6,
      avgCarries: 9,
      avgMetres: 70,
      avgLineBreaks: 1.2,
      teamExpectedTries: 4.2,
      teamWinPct: 68,
    });
    expect(prop.tryPct).toBeGreaterThan(20);
    expect(prop.motmPct).toBeGreaterThan(5);

    expect(combineLegProbabilities([68, 55, 42])).toBeGreaterThan(10);
    expect(combineLegProbabilities([68, 55, 42])).toBeLessThan(68);

    const builders = buildBetBuilderSuggestions({
      homeName: "Leinster",
      awayName: "Toulouse",
      prediction: {
        modelVersion: "betting-intel-v1",
        homeWinPct: 68,
        drawPct: 4,
        awayWinPct: 28,
        lean: "home",
        confidencePct: 88,
        expectedHomeScore: 31,
        expectedAwayScore: 24,
        expectedHomeTries: 4.3,
        expectedAwayTries: 3.1,
        winningMargin: [
          { key: "1-7", label: "1–7", probability: 40 },
          { key: "8-14", label: "8–14", probability: 35 },
          { key: "15+", label: "15+", probability: 25 },
        ],
      },
      signals: [
        {
          key: "ratings",
          side: "home",
          weight: 0.2,
          label: "Rugby365 Rating",
          detail: "Home rates higher",
        },
      ],
      topTryScorer: prop,
    });
    expect(builders.length).toBeGreaterThanOrEqual(1);
    expect(builders[0]!.legs.length).toBeGreaterThanOrEqual(2);
    expect(builders[0]!.combinedConfidencePct).toBeGreaterThan(0);
  });
});
