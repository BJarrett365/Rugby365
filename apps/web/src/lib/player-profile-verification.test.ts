import { describe, expect, it } from "vitest";
import { buildBioVerificationReport } from "./player-profile-verification-service";
import type { PlayerBioPacket } from "./player-bio-types";
import { buildPlayerRatingSnapshot } from "./player-rating-service";

const bioPacket: PlayerBioPacket = {
  playerId: "player-1",
  name: "Adam Brocklebank",
  fullName: "Adam Brocklebank",
  birthDate: null,
  age: 28,
  nationality: "England",
  nationCode: "ENG",
  heightCm: null,
  weightKg: null,
  position: "Loosehead Prop",
  currentClub: "Newcastle Falcons",
  internationalTeam: null,
  isInternational: false,
  previousClubs: [],
  transferHistory: [],
  careerStints: [],
  recentMatches: [],
  seasonStats: [],
  scoringStats: { tries: 0, conversions: 0, penalties: 0, dropGoals: 0, points: 0 },
  rating: buildPlayerRatingSnapshot({
    playerId: "player-1",
    birthDate: null,
    internationalTeamId: null,
    seasonStats: [],
    matchStats: [],
    fixtureCount: 0,
    hasLegend: false,
  }),
  legends: [],
  availability: {
    currentStatus: "Available",
    isUnavailable: false,
    unavailableReason: null,
    returningPlayer: false,
    totalMatchesMissed: 0,
    expectedReturnDate: null,
    currentInjuryType: null,
    currentSuspensionOffence: null,
    injuryHistoryCount: 0,
    suspensionHistoryCount: 0,
  },
  sourceUrls: [],
  confidenceScore: 0.35,
  missingFields: [{ field: "birthDate", label: "Date of birth", importance: "high" }],
  conflicts: [
    {
      field: "heightCm",
      label: "Height (cm)",
      values: [
        { source: "database", value: 183 },
        { source: "rugbypass", value: 185 },
      ],
    },
  ],
  generatedAt: "2026-07-06T00:00:00.000Z",
};

describe("buildBioVerificationReport", () => {
  it("flags limited data when confidence is low", () => {
    const report = buildBioVerificationReport(bioPacket);
    expect(report.confidenceScore).toBeLessThan(0.5);
    expect(report.suggestedEditorAction).toContain("conflicting");
  });

  it("lists missing high-importance fields", () => {
    const report = buildBioVerificationReport(bioPacket);
    expect(report.missingFields.some((field) => field.field === "birthDate")).toBe(true);
  });

  it("includes conflicting fields and source field inventory", () => {
    const report = buildBioVerificationReport(bioPacket);
    expect(report.conflictingFields).toHaveLength(1);
    expect(report.sourceFieldsUsed).toContain("name");
    expect(report.sourceFieldsUsed).toContain("position");
  });
});
