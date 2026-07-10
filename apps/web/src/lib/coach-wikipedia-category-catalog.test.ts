import { describe, expect, it } from "vitest";
import {
  IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES,
  INTERNATIONAL_COACH_WIKIPEDIA_CATEGORIES,
  parseCountryFromCoachCategory,
} from "./coach-wikipedia-category-catalog";

describe("coach-wikipedia-category-catalog", () => {
  it("lists all user-provided national coach categories", () => {
    expect(INTERNATIONAL_COACH_WIKIPEDIA_CATEGORIES.length).toBeGreaterThanOrEqual(17);
    expect(IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES.map((entry) => entry.country)).toContain("Wales");
    expect(IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES.map((entry) => entry.country)).toContain(
      "British & Irish Lions",
    );
  });

  it("parses country names from category titles and URLs", () => {
    expect(
      parseCountryFromCoachCategory(
        "https://en.wikipedia.org/wiki/Category:England_national_rugby_union_team_coaches",
      ),
    ).toBe("England");
    expect(
      parseCountryFromCoachCategory("Category:Wales_national_rugby_union_team_coaches"),
    ).toBe("Wales");
    expect(
      parseCountryFromCoachCategory("Category:British & Irish Lions coaches"),
    ).toBe("British & Irish Lions");
    expect(
      parseCountryFromCoachCategory("Category:Coaches_of_international_rugby_union_teams"),
    ).toBeNull();
  });
});
