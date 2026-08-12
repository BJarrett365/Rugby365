import { describe, expect, it } from "vitest";
import {
  buildCoachingStaffImportKey,
  normalizeCoachSocialAccounts,
} from "./coach-admin-service";
import {
  COACHING_ROLES,
  coachingRoleLabel,
  normalizeCoachingRole,
} from "./coach-types";

describe("coach types", () => {
  it("normalizes common coaching role labels", () => {
    expect(normalizeCoachingRole("Head Coach")).toBe("head_coach");
    expect(normalizeCoachingRole("Head of Rugby")).toBe("head_of_rugby");
    expect(normalizeCoachingRole("Chief of Rugby Operations")).toBe("head_of_rugby");
    expect(normalizeCoachingRole("Director of Rugby")).toBe("director_of_rugby");
    expect(normalizeCoachingRole("S&C Coach")).toBe("strength_conditioning_coach");
    expect(normalizeCoachingRole("Defence Coach")).toBe("defence_coach");
  });

  it("labels all supported roles", () => {
    for (const role of COACHING_ROLES) {
      expect(coachingRoleLabel(role)).toBeTruthy();
    }
  });
});

describe("coach admin helpers", () => {
  it("builds stable import keys for coaching staff", () => {
    const key = buildCoachingStaffImportKey({
      teamId: "team-1",
      coachId: "coach-1",
      role: "Head Coach",
      seasonId: "season-1",
    });
    expect(key).toBe("team-1:coach-1:head_coach:season-1");
    expect(
      buildCoachingStaffImportKey({
        teamId: "team-1",
        coachId: "coach-1",
        role: "Head Coach",
        seasonId: "season-1",
      }),
    ).toBe(key);
  });

  it("normalizes coach social accounts", () => {
    expect(
      normalizeCoachSocialAccounts({
        twitter: " https://x.com/coach ",
        website: "",
        linkedin: "https://linkedin.com/in/coach",
      }),
    ).toEqual({
      twitter: "https://x.com/coach",
      instagram: null,
      facebook: null,
      linkedin: "https://linkedin.com/in/coach",
      website: null,
    });
  });
});
