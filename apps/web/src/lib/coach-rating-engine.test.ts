import { describe, expect, it } from "vitest";
import {
  COACH_RATING_WEIGHTS_V1,
  computeCoachRating,
  scoreMajorHonours,
  scoreCareerConsistency,
} from "./coach-rating-engine";
import type { CoachIntelligenceMetric } from "./coach-intelligence-engine";
import { COACH_INTELLIGENCE_VERSION } from "./coach-intelligence-engine";
import type { CoachEligibleMatch } from "./coach-career-record-service";

function metric(
  key: CoachIntelligenceMetric["key"],
  score: number | null,
): CoachIntelligenceMetric {
  return {
    key,
    label: key,
    score,
    worldRank: null,
    raw: {},
    confidence: 90,
    sampleSize: 20,
    dataCoverage: 100,
    period: "test",
    calculatedAt: new Date().toISOString(),
    modelVersion: COACH_INTELLIGENCE_VERSION,
    trend: null,
    components: {},
    availableInputs: ["x"],
    missingInputs: [],
    status: "CURRENT",
  };
}

function match(result: "W" | "L" | "D", i: number): CoachEligibleMatch {
  return {
    id: `m${i}`,
    slug: `m${i}`,
    kickoffAt: new Date(2024, 0, i + 1),
    competitionName: null,
    teamId: "t",
    teamName: "Team",
    opponentTeamId: "o",
    opponentName: "Opp",
    forScore: result === "W" ? 30 : 10,
    againstScore: result === "W" ? 10 : 30,
    result,
    margin: result === "W" ? 20 : -20,
    side: "home",
  };
}

describe("coach-rating-engine", () => {
  it("weights sum to 100", () => {
    expect(Object.values(COACH_RATING_WEIGHTS_V1).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("uses Power Index as 40% input without inventing scores", () => {
    const result = computeCoachRating({
      powerIndex: 80,
      intelligence: [
        metric("big_match_performance", 90),
        metric("player_development", 70),
        metric("experience", 85),
      ],
      careerWinRate: 75,
      matches: Array.from({ length: 20 }, (_, i) => match(i % 3 === 0 ? "L" : "W", i)),
      impact: {
        modelVersion: "coach-impact-v1",
        baselineLabel: "test",
        underLabel: "Under Coach",
        beforeCount: 20,
        underCount: 20,
        enoughData: true,
        confidence: "high",
        confidencePct: 90,
        tenureStart: "2024-01-01",
        teamId: null,
        teamName: null,
        rows: [
          {
            key: "win_rate",
            metric: "Win Rate",
            before: "50%",
            under: "70%",
            change: 20,
            changeLabel: "+20 pts",
            improved: true,
            confidencePct: 90,
          },
        ],
      },
      honours: [{ honourLevel: "major", achievementType: "winner", roleType: "coach", year: 2023 }],
      matchesUsed: 20,
      ratingConfidencePct: 90,
    });
    expect(result.score).not.toBeNull();
    expect(result.contributions.find((c) => c.key === "power_index")?.score).toBe(80);
    expect(result.eligibleForWorldRank).toBe(true);
    expect(result.score!).toBeGreaterThan(60);
    expect(result.score!).toBeLessThanOrEqual(100);
  });

  it("caps major honours influence", () => {
    const many = Array.from({ length: 20 }, () => ({
      honourLevel: "major",
      achievementType: "winner",
      roleType: "coach",
      year: 2010,
    }));
    expect(scoreMajorHonours(many)).toBeLessThanOrEqual(100);
  });

  it("scores career consistency from match stability", () => {
    const stable = Array.from({ length: 20 }, (_, i) => match(i % 4 === 0 ? "L" : "W", i));
    const score = scoreCareerConsistency(stable);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(40);
  });
});
