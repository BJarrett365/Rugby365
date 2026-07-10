import { describe, expect, it } from "vitest";
import {
  isClubTeamName,
  isKnownInternationalCountryName,
  isValidInternationalCountryName,
  type TeamClassificationContext,
} from "./international-team-classify";

const ctx: TeamClassificationContext = {
  internationalTeamIds: new Set(["england-id"]),
  clubTeamIds: new Set(["ulster-id", "cardiff-id"]),
  internationalNameKeys: new Set(["england"]),
  clubNameKeys: new Set(["ulster", "cardiff rugby", "northampton saints"]),
  teamNameById: new Map([
    ["england-id", "England"],
    ["ulster-id", "Ulster"],
    ["cardiff-id", "Cardiff Rugby"],
  ]),
};

describe("international team classification", () => {
  it("recognises countries vs clubs", () => {
    expect(isKnownInternationalCountryName("England")).toBe(true);
    expect(isKnownInternationalCountryName("Ulster")).toBe(false);
    expect(isClubTeamName(ctx, "Ulster")).toBe(true);
    expect(isClubTeamName(ctx, "Cardiff Rugby")).toBe(true);
    expect(isValidInternationalCountryName(ctx, "England", "Northampton Saints")).toBe(true);
    expect(isValidInternationalCountryName(ctx, "Ulster", "Northampton Saints")).toBe(false);
    expect(isValidInternationalCountryName(ctx, "Cardiff Rugby", "Northampton Saints")).toBe(false);
  });
});
