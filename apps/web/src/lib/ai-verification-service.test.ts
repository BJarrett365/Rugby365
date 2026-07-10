import { describe, expect, it } from "vitest";
import { buildRuleVerificationReport } from "./ai-verification-service";
import type { AiSourceSnapshot } from "./ai-enrichment-types";

const teamSnapshot: AiSourceSnapshot = {
  entityType: "team",
  entityId: "team-1",
  entityName: "Bath Rugby",
  database: {
    name: "Bath Rugby",
    shortName: "Bath",
    countryName: "England",
    bioSummary: null,
    homeVenueId: "venue-1",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Bath_Rugby",
  },
  sources: {
    wikipediaUrl: "https://en.wikipedia.org/wiki/Bath_Rugby",
    venueName: "The Recreation Ground",
    venueCountry: "United Kingdom",
  },
  context: {
    competitions: ["Premiership Rugby", "Champions Cup"],
    coachingStaff: [{ name: "Johann van Graan", role: "Head Coach", isCurrent: true }],
    seenNames: ["Bath", "Bath Rugby"],
    duplicates: [],
  },
};

describe("buildRuleVerificationReport", () => {
  it("marks confirmed populated fields", () => {
    const report = buildRuleVerificationReport(teamSnapshot);
    expect(report.confirmedFields.some((field) => field.field === "shortName")).toBe(true);
    expect(report.confirmedFields.some((field) => field.field === "wikipediaUrl")).toBe(true);
  });

  it("flags missing bio and venue summary gaps", () => {
    const report = buildRuleVerificationReport(teamSnapshot);
    expect(report.missingFields.some((field) => field.field === "bioSummary")).toBe(true);
  });

  it("returns a bounded confidence score", () => {
    const report = buildRuleVerificationReport(teamSnapshot);
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.2);
    expect(report.confidenceScore).toBeLessThanOrEqual(0.95);
  });

  it("suggests high-priority editor actions for missing high-importance fields", () => {
    const report = buildRuleVerificationReport({
      ...teamSnapshot,
      database: {
        ...teamSnapshot.database,
        homeVenueId: null,
      },
    });
    expect(report.editorActions.some((action) => action.priority === "high")).toBe(true);
  });
});
