import { describe, expect, it } from "vitest";
import {
  COMPETITION_CATALOG,
  findCatalogEntryForCompetitionName,
  groupCompetitionCatalog,
} from "./competition-catalog";

describe("competition-catalog", () => {
  it("has a substantial starting database", () => {
    expect(COMPETITION_CATALOG.length).toBeGreaterThan(120);
  });

  it("groups competitions", () => {
    const groups = groupCompetitionCatalog();
    expect(groups.has("International competitions")).toBe(true);
    expect(groups.has("England")).toBe(true);
    expect(groups.has("Women’s major competitions")).toBe(true);
  });

  it("matches populated DB names to catalog entries", () => {
    expect(findCatalogEntryForCompetitionName("Premiership")?.key).toBe("premiership-rugby");
    expect(findCatalogEntryForCompetitionName("Six Nations")?.key).toBe("six-nations");
    expect(findCatalogEntryForCompetitionName("Investec Champions Cup")?.key).toBe(
      "champions-cup",
    );
    expect(findCatalogEntryForCompetitionName("NPC")?.key).toBe("npc");
    expect(findCatalogEntryForCompetitionName("Currie Cup")?.key).toBe("currie-cup-premier");
    expect(findCatalogEntryForCompetitionName("Autumn Nations Cup")?.key).toBe(
      "autumn-nations-series",
    );
    expect(findCatalogEntryForCompetitionName("Super Rugby")?.key).toBe("super-rugby");
    expect(findCatalogEntryForCompetitionName("Super Rugby Pacific")?.key).toBe(
      "super-rugby-pacific",
    );
  });

  it("tags former competitions", () => {
    const former = COMPETITION_CATALOG.filter((c) => c.lifecycle === "former");
    expect(former.some((c) => c.key === "anglo-welsh-cup")).toBe(true);
    expect(former.some((c) => c.key === "nrc")).toBe(true);
  });
});
