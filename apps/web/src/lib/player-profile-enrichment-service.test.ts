import { describe, expect, it } from "vitest";
import type { RugbyPassPlayerProfile } from "@rugby365/import-sdk";
import {
  enrichmentFieldsUpdated,
  mergeRugbyPassEnrichment,
  namesLikelyMatch,
} from "./player-profile-enrichment-service";

const sampleProfile: RugbyPassPlayerProfile = {
  slug: "adam-brocklebank",
  sourceUrl: "https://www.rugbypass.com/players/adam-brocklebank/",
  displayName: "Adam Brocklebank",
  fullName: "Adam Brocklebank",
  nationality: "England",
  age: 30,
  birthDate: "1996-01-01",
  position: "Prop",
  heightCm: 187,
  weightKg: 125,
  currentTeam: "Newcastle",
  imageUrl: "https://example.com/head.png",
  bioSummary: null,
  birthPlace: null,
  rugbypassPlayerId: "24106",
  seasonStats: [],
  recentMatches: [],
};

describe("namesLikelyMatch", () => {
  it("matches same player names with minor differences", () => {
    expect(namesLikelyMatch("Adam Brocklebank", "Adam Brocklebank")).toBe(true);
    expect(namesLikelyMatch("A Brocklebank", "Adam Brocklebank")).toBe(true);
  });
});

describe("mergeRugbyPassEnrichment", () => {
  it("fills empty profile fields without overwriting existing values", () => {
    const patch = mergeRugbyPassEnrichment(
      {
        id: "p1",
        name: "Adam Brocklebank",
        positionName: "Loosehead Prop",
        heightCm: 190,
      },
      sampleProfile,
    );
    expect(patch.positionName).toBeUndefined();
    expect(patch.heightCm).toBeUndefined();
    expect(patch.countryName).toBe("England");
    expect(patch.weightKg).toBe(125);
    expect(patch.rugbypassSlug).toBe("adam-brocklebank");
  });

  it("never applies RugbyPass image URLs (images come from our image API)", () => {
    const patch = mergeRugbyPassEnrichment(
      { id: "p1", name: "Adam Brocklebank", imageUrl: null },
      sampleProfile,
    );
    expect(patch.imageUrl).toBeUndefined();
  });

  it("reports updated enrichment fields", () => {
    const patch = mergeRugbyPassEnrichment(
      { id: "p1", name: "Adam Brocklebank" },
      sampleProfile,
    );
    const fields = enrichmentFieldsUpdated({ id: "p1", name: "Adam Brocklebank" }, patch);
    expect(fields).toContain("countryName");
    expect(fields).toContain("rugbypassUrl");
  });
});
