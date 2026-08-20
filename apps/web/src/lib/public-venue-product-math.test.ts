import { describe, expect, it } from "vitest";
import {
  buildVenueRankingTitle,
  countryNameToSlug,
  formatCapacity,
  formatRating,
  haversineKm,
  parseVenueCategory,
  remotenessKm,
  venueFlagIso,
} from "./public-venue-product-math";

describe("public-venue-product-math", () => {
  it("slugs country names for SEO routes", () => {
    expect(countryNameToSlug("South Africa")).toBe("south-africa");
    expect(countryNameToSlug("New Zealand")).toBe("new-zealand");
    expect(countryNameToSlug("England")).toBe("england");
  });

  it("uses Home Nations subdivision flag codes", () => {
    expect(venueFlagIso("England", "GB")).toBe("gb-eng");
    expect(venueFlagIso("Wales", "GB")).toBe("gb-wls");
    expect(venueFlagIso("France", "FR")).toBe("fr");
  });

  it("formats unknown rating and capacity honestly", () => {
    expect(formatRating(null)).toBe("—");
    expect(formatCapacity(null)).toBe("—");
    expect(formatCapacity(82000)).toBe("82,000");
  });

  it("parses category query params", () => {
    expect(parseVenueCategory("biggest")).toBe("biggest");
    expect(parseVenueCategory("fortress")).toBe("fortress");
    expect(parseVenueCategory("nope")).toBe("best");
  });

  it("builds dynamic ranking titles", () => {
    expect(
      buildVenueRankingTitle({
        category: "best",
        countryName: "South Africa",
        competitionName: "United Rugby Championship",
      }),
    ).toBe("BEST UNITED RUGBY CHAMPIONSHIP STADIUMS IN SOUTH AFRICA");
    expect(buildVenueRankingTitle({ category: "biggest", competitionName: "Top 14" })).toBe(
      "BIGGEST TOP 14 STADIUMS",
    );
  });

  it("estimates remoteness from rugby hubs", () => {
    // Near London → low remoteness
    expect(remotenessKm(51.5, -0.1)).toBeLessThan(50);
    // Far from all hubs → high remoteness
    expect(remotenessKm(-77.8, 166.7)).toBeGreaterThan(3000);
    expect(haversineKm(0, 0, 0, 1)).toBeGreaterThan(100);
  });
});
