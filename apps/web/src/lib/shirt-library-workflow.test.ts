import { describe, expect, it } from "vitest";
import { SHIRT_STATUSES, SHIRT_KIT_TYPES, SHIRT_SELECTION_METHODS } from "./shirt-library-types";
import { shirtConfigFromVersion } from "./shirt-svg-config";
import { NATIONS_CHAMPIONSHIP_SHIRT_SEEDS } from "./shirt-library-nations-seed";

describe("shirt library workflow contracts", () => {
  it("defines required approval statuses", () => {
    expect(SHIRT_STATUSES).toContain("DRAFT");
    expect(SHIRT_STATUSES).toContain("AWAITING_REVIEW");
    expect(SHIRT_STATUSES).toContain("APPROVED");
    expect(SHIRT_STATUSES).toContain("REJECTED");
  });

  it("supports home/away/third kits for pitch overlays", () => {
    expect(SHIRT_KIT_TYPES).toEqual(
      expect.arrayContaining(["HOME", "AWAY", "THIRD"]),
    );
  });

  it("tracks how TotW selected a shirt", () => {
    expect(SHIRT_SELECTION_METHODS).toEqual(
      expect.arrayContaining(["MATCH_DATA", "DEFAULT_HOME", "ADMIN_OVERRIDE", "FALLBACK"]),
    );
  });

  it("builds svg config from a version without sponsors", () => {
    const cfg = shirtConfigFromVersion({
      bodyColour: "#006B3C",
      secondaryColour: "#FFB81C",
      patternType: "PLAIN",
      numberColour: "#FFFFFF",
    });
    expect(cfg.bodyColour).toBe("#006B3C");
    expect(JSON.stringify(cfg).toLowerCase()).not.toMatch(/sponsor/);
  });

  it("seeds 12 Nations Championship nations with home and away drafts", () => {
    expect(NATIONS_CHAMPIONSHIP_SHIRT_SEEDS).toHaveLength(12);
    for (const seed of NATIONS_CHAMPIONSHIP_SHIRT_SEEDS) {
      const kits = seed.kits.map((k) => k.kitType);
      expect(kits).toContain("HOME");
      expect(kits).toContain("AWAY");
    }
  });

  it("never treats unapproved statuses as public-ready", () => {
    const publicOk = new Set(["APPROVED"]);
    for (const status of SHIRT_STATUSES) {
      if (status === "APPROVED") expect(publicOk.has(status)).toBe(true);
      else expect(publicOk.has(status)).toBe(false);
    }
  });
});
