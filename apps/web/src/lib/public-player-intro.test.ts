import { describe, expect, it } from "vitest";
import { buildPublicPlayerIntro, formatStatValue } from "./public-player-intro";

describe("buildPublicPlayerIntro", () => {
  it("uses CMS override when provided", () => {
    expect(
      buildPublicPlayerIntro({
        name: "Marcus Smith",
        override: "Custom editor intro.",
      }),
    ).toBe("Custom editor intro.");
  });

  it("builds a factual intro from structured fields", () => {
    const intro = buildPublicPlayerIntro({
      name: "Marcus Smith",
      positionName: "fly-half",
      countryName: "England",
      clubName: "Harlequins",
      competitionName: "Premiership",
      birthDate: "1999-02-14",
      careerAppearances: 100,
      internationalCaps: 40,
    });
    expect(intro).toContain("Marcus Smith is an England international fly-half");
    expect(intro).toContain("Harlequins");
    expect(intro).toContain("Premiership");
    expect(intro).toContain("100 senior club appearances");
    expect(intro).toContain("40 international caps");
  });

  it("returns null when name is empty and no override", () => {
    expect(buildPublicPlayerIntro({ name: "  " })).toBeNull();
  });
});

describe("formatStatValue", () => {
  it("keeps confirmed zero and uses dash for missing", () => {
    expect(formatStatValue(0)).toBe("0");
    expect(formatStatValue(null)).toBe("—");
    expect(formatStatValue(undefined)).toBe("—");
    expect(formatStatValue(12)).toBe("12");
  });
});
