import { describe, expect, it } from "vitest";
import {
  buildRefereeScoreHistoryRecord,
  computeRefereeProfileScore,
  type RefereeScoreInputs,
} from "./referee-intelligence-service";
import type { PersonIntelligencePacket } from "./person-intelligence-types";

const experiencedInputs: RefereeScoreInputs = {
  matchesRefereed: 40,
  internationalMatches: 12,
  testMatches: 4,
  majorFinals: 2,
  competitionLevelScore: 12,
  recentAppointments: 5,
};

const limitedInputs: RefereeScoreInputs = {
  matchesRefereed: 3,
  internationalMatches: 0,
  testMatches: 0,
  majorFinals: 0,
  competitionLevelScore: 4,
  recentAppointments: 2,
};

describe("computeRefereeProfileScore", () => {
  it("uses respectful public wording", () => {
    const score = computeRefereeProfileScore(experiencedInputs);
    expect(score.explanation).toContain("Rugby365 Referee Profile Score");
    expect(score.explanation.toLowerCase()).not.toContain("bias");
    expect(score.explanation.toLowerCase()).not.toContain("unfair");
  });

  it("scores experienced referees above limited-data profiles", () => {
    const experienced = computeRefereeProfileScore(experiencedInputs);
    const limited = computeRefereeProfileScore(limitedInputs);
    expect(experienced.displayScore).toBeGreaterThan(limited.displayScore ?? 0);
  });

  it("flags limited appointment data without judgemental language", () => {
    const score = computeRefereeProfileScore(limitedInputs);
    expect(score.explanation.toLowerCase()).toContain("limited");
  });

  it("includes supporting score dimensions", () => {
    const score = computeRefereeProfileScore(experiencedInputs);
    expect(score.supportingScores.experience).toBeGreaterThan(50);
    expect(score.supportingScores.appointmentLevel).toBeGreaterThan(50);
    expect(score.supportingScores.disciplineProfile).toBeGreaterThan(0);
  });
});

describe("buildRefereeScoreHistoryRecord", () => {
  it("creates append-only referee score history rows", () => {
    const packet: PersonIntelligencePacket = {
      personId: "person-2",
      roleType: "referee",
      roleEntityId: "ref-1",
      name: "Test Referee",
      birthDate: null,
      age: null,
      nationality: "Ireland",
      birthPlace: null,
      currentRole: "international",
      currentOrganisation: "Six Nations",
      imageUrl: null,
      bioSummary: null,
      sourceUrls: [],
      score: computeRefereeProfileScore(experiencedInputs),
      roleContext: { matchesRefereed: 40 },
      missingFields: [],
      conflicts: [],
      confidenceScore: 0.8,
      generatedAt: "2026-07-06T00:00:00.000Z",
    };

    const record = buildRefereeScoreHistoryRecord(packet);
    expect(record.ratingType).toBe("referee_profile_score");
    expect(record.overallScore).toBe(packet.score.calculatedScore);
    expect(record.calculationInputs).toEqual(packet.roleContext);
  });
});
