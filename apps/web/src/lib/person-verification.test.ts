import { describe, expect, it } from "vitest";
import { buildPersonVerificationReport } from "./person-verification-service";
import { buildPersonMissingFields, personDuplicateKey } from "./person-intelligence-service";
import { computeRefereeProfileScore } from "./referee-intelligence-service";
import type { PersonIntelligencePacket } from "./person-intelligence-types";

const refereePacket: PersonIntelligencePacket = {
  personId: "person-ref-1",
  roleType: "referee",
  roleEntityId: "ref-1",
  name: "Wayne Barnes",
  birthDate: null,
  age: null,
  nationality: "England",
  birthPlace: null,
  currentRole: "international",
  currentOrganisation: "Premiership Rugby",
  imageUrl: null,
  bioSummary: null,
  sourceUrls: [],
  score: computeRefereeProfileScore({
    matchesRefereed: 25,
    internationalMatches: 8,
    testMatches: 2,
    majorFinals: 1,
    competitionLevelScore: 10,
    recentAppointments: 4,
  }),
  roleContext: { matchesRefereed: 25 },
  missingFields: buildPersonMissingFields("referee", {
    bioSummary: null,
    birthDate: null,
    nationality: "England",
    imageUrl: null,
    currentRole: "international",
  }),
  conflicts: [],
  confidenceScore: 0.55,
  generatedAt: "2026-07-06T00:00:00.000Z",
};

describe("buildPersonVerificationReport", () => {
  it("suggests respectful referee review wording", () => {
    const report = buildPersonVerificationReport({
      ...refereePacket,
      missingFields: buildPersonMissingFields("referee", {
        bioSummary: "Experienced international referee.",
        birthDate: "1979-04-20",
        nationality: "England",
        imageUrl: "https://example.com/photo.jpg",
        currentRole: "international",
      }),
    });
    expect(report.suggestedEditorAction.toLowerCase()).toContain("respectful");
    expect(report.summary).toContain("referee");
  });

  it("lists missing high-importance fields", () => {
    const report = buildPersonVerificationReport(refereePacket);
    expect(report.missingFields.some((field) => field.field === "birthDate")).toBe(true);
  });

  it("flags conflicts before publishing", () => {
    const report = buildPersonVerificationReport({
      ...refereePacket,
      conflicts: [
        {
          field: "nationality",
          label: "Nationality",
          values: [
            { source: "database", value: "England" },
            { source: "wikipedia", value: "Wales" },
          ],
        },
      ],
    });
    expect(report.suggestedEditorAction).toContain("conflicting");
    expect(report.conflictingFields).toHaveLength(1);
  });
});

describe("personDuplicateKey", () => {
  it("matches people by normalized name, dob and nationality", () => {
    const keyA = personDuplicateKey("Steve Borthwick", "1979-12-01", "England");
    const keyB = personDuplicateKey("Steve Borthwick", "1979-12-01", "england");
    expect(keyA).toBe(keyB);
  });
});
