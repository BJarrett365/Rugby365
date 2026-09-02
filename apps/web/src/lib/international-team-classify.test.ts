import { describe, expect, it } from "vitest";
import {
  isAgeGradeInternationalTeamName,
  isClubTeamName,
  isKnownInternationalCountryName,
  isValidInternationalCountryName,
  resolveDisplayNation,
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

  it("treats U20 and A sides as age-grade, not senior nations", () => {
    expect(isAgeGradeInternationalTeamName("England U20")).toBe(true);
    expect(isAgeGradeInternationalTeamName("Ireland A")).toBe(true);
    expect(isAgeGradeInternationalTeamName("England")).toBe(false);
  });

  it("does not display UN as a nation and maps rugby codes to country names", () => {
    expect(
      resolveDisplayNation(ctx, {
        nationCode: "UN",
        countryName: "England",
        clubName: "Saracens",
        internationalTeamId: null,
      }),
    ).toBe("England");
    expect(
      resolveDisplayNation(ctx, {
        nationCode: "ENG",
        countryName: null,
        clubName: "Bath",
        internationalTeamId: null,
      }),
    ).toBe("England");
    expect(
      resolveDisplayNation(ctx, {
        nationCode: "UN",
        countryName: null,
        clubName: "Ulster",
        internationalTeamId: null,
      }),
    ).toBeNull();
    expect(
      resolveDisplayNation(ctx, {
        nationCode: "IRE",
        countryName: "Italy",
        clubName: "Saracens",
        internationalTeamId: null,
      }),
    ).toBe("Italy");
  });
});
