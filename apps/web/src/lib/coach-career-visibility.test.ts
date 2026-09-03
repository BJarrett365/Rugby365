import { describe, expect, it } from "vitest";
import {
  isPublicCareerRecord,
  isPublicHistoryAssignment,
  overviewTeamName,
  teamNameFromAssignmentBio,
} from "./coach-career-visibility";

describe("isPublicCareerRecord", () => {
  it("accepts verified and editor_approved statuses", () => {
    expect(isPublicCareerRecord({ recordStatus: "verified" })).toBe(true);
    expect(isPublicCareerRecord({ recordStatus: "editor_approved" })).toBe(true);
  });

  it("accepts legacy verifiedAt without status", () => {
    expect(isPublicCareerRecord({ verifiedAt: new Date() })).toBe(true);
  });

  it("rejects unverified rows", () => {
    expect(isPublicCareerRecord({ recordStatus: "needs_review" })).toBe(false);
  });
});

describe("isPublicHistoryAssignment", () => {
  it("hides conflict rows even when dated", () => {
    expect(
      isPublicHistoryAssignment({
        recordStatus: "conflict",
        startDate: "2019-01-01",
        isCurrent: true,
        showOnOverview: true,
      }),
    ).toBe(false);
  });

  it("shows current and overview rows", () => {
    expect(isPublicHistoryAssignment({ isCurrent: true })).toBe(true);
    expect(isPublicHistoryAssignment({ showOnOverview: true })).toBe(true);
  });

  it("shows dated Wikipedia history that is still needs_review", () => {
    expect(
      isPublicHistoryAssignment({
        recordStatus: "needs_review",
        startDate: "2007-01-01",
      }),
    ).toBe(true);
  });
});

describe("overviewTeamName", () => {
  it("recovers Wikipedia team labels from bio when CMS name is Unknown team", () => {
    expect(teamNameFromAssignmentBio("2007–2019 · Wales (head coach)")).toBe("Wales");
    expect(
      overviewTeamName({
        teamName: "Unknown team abcd1234",
        bioSummary: "2007–2019 · Wales (head coach)",
      }),
    ).toBe("Wales");
  });

  it("prefers teamDisplayName", () => {
    expect(
      overviewTeamName({
        teamDisplayName: "Chiefs",
        teamName: "Unknown team abcd1234",
        bioSummary: "2013–2016 · Chiefs",
      }),
    ).toBe("Chiefs");
  });
});
