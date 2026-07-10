import { describe, expect, it } from "vitest";
import {
  buildCoachScoreHistoryRecord,
  computeCoachRating,
  type CoachRatingInputs,
} from "./coach-intelligence-service";
import type { PersonIntelligencePacket, PersonIntelligenceScore } from "./person-intelligence-types";

const strongInputs: CoachRatingInputs = {
  winRate: 0.7,
  recentFormPoints: 12,
  competitionLevelScore: 10,
  internationalExperience: true,
  yearsExperience: 8,
  teamImprovement: 0.15,
  trophiesCount: 1,
  finalsCount: 1,
};

const weakInputs: CoachRatingInputs = {
  winRate: 0.35,
  recentFormPoints: 3,
  competitionLevelScore: 4,
  internationalExperience: false,
  yearsExperience: 2,
  teamImprovement: -0.05,
  trophiesCount: 0,
  finalsCount: 0,
};

describe("computeCoachRating", () => {
  it("returns explainable supporting scores and overall rating", () => {
    const score = computeCoachRating(strongInputs);
    expect(score.displayScore).toBeGreaterThan(70);
    expect(score.supportingScores.currentPerformance).toBeGreaterThan(60);
    expect(score.explanation).toContain("Rugby365 Coach Rating");
    expect(score.formulaVersion).toBeTruthy();
  });

  it("rates stronger profiles above weaker profiles", () => {
    const strong = computeCoachRating(strongInputs);
    const weak = computeCoachRating(weakInputs);
    expect(strong.displayScore).toBeGreaterThan(weak.displayScore ?? 0);
  });

  it("tracks score movement against previous rating", () => {
    const previous: PersonIntelligenceScore = {
      overallScore: 72,
      displayScore: 72,
      calculatedScore: 72,
      supportingScores: {},
      explanation: "Previous",
      confidenceScore: 0.6,
      formulaVersion: "coach-rating-v1",
      manualOverrideRating: null,
      manualOverrideReason: null,
      careerHigh: 72,
      careerLow: 72,
      scoreMovement: null,
    };
    const next = computeCoachRating(strongInputs, previous);
    expect(next.scoreMovement).toBe((next.displayScore ?? 0) - 72);
    expect(next.careerHigh).toBeGreaterThanOrEqual(72);
  });

  it("mentions improvement when team win rate has improved", () => {
    const score = computeCoachRating({ ...strongInputs, teamImprovement: 0.2 });
    expect(score.explanation.toLowerCase()).toContain("improved");
  });
});

describe("buildCoachScoreHistoryRecord", () => {
  it("creates append-only history payload without overwriting semantics", () => {
    const packet: PersonIntelligencePacket = {
      personId: "person-1",
      roleType: "coach",
      roleEntityId: "coach-1",
      name: "Test Coach",
      birthDate: null,
      age: null,
      nationality: "England",
      birthPlace: null,
      currentRole: "Head Coach",
      currentOrganisation: "Saracens",
      imageUrl: null,
      bioSummary: null,
      sourceUrls: [],
      score: computeCoachRating(strongInputs),
      roleContext: { winRate: 0.7 },
      missingFields: [],
      conflicts: [],
      confidenceScore: 0.7,
      generatedAt: "2026-07-06T00:00:00.000Z",
    };

    const record = buildCoachScoreHistoryRecord(packet, "team-1");
    expect(record.personId).toBe("person-1");
    expect(record.teamId).toBe("team-1");
    expect(record.ratingType).toBe("coach_rating");
    expect(record.overallScore).toBe(packet.score.calculatedScore);
    expect(record.formulaVersion).toBe(packet.score.formulaVersion);
  });
});
