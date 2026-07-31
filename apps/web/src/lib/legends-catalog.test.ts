import { describe, expect, it } from "vitest";
import {
  mergeLegendCatalogByName,
  PLANET_RUGBY_LEGENDS_CATALOG,
} from "./legends-catalog";

describe("legends-catalog", () => {
  it("merges duplicate names across eras and collections", () => {
    const merged = mergeLegendCatalogByName();
    const mccaw = merged.find((p) => p.name === "Richie McCaw");
    expect(mccaw).toBeTruthy();
    expect(mccaw!.eras).toContain("2000s");
    expect(mccaw!.collections).toEqual(
      expect.arrayContaining([
        "greatest-players",
        "greatest-captains",
        "greatest-all-blacks",
      ]),
    );
    expect(merged.length).toBeLessThan(PLANET_RUGBY_LEGENDS_CATALOG.length);
  });

  it("keeps unique historic names", () => {
    const merged = mergeLegendCatalogByName();
    expect(merged.some((p) => p.name === "William Webb Ellis")).toBe(true);
    expect(merged.some((p) => p.name === "Antoine Dupont")).toBe(true);
  });
});
