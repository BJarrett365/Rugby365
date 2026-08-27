import { describe, expect, it } from "vitest";
import { collapseAdminClubCatalog } from "./admin-clubs-catalog";

function club(partial: { name: string; slug: string; id?: string }): {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  teamType: string | null;
  sourceProvider: string;
} {
  return {
    id: partial.id ?? partial.slug,
    name: partial.name,
    slug: partial.slug,
    shortName: null,
    teamType: "club",
    sourceProvider: "wikipedia",
  };
}

describe("collapseAdminClubCatalog", () => {
  it("keeps one Bulls and strips dated legacy clones", () => {
    const rows = collapseAdminClubCatalog([
      club({ name: "Bulls", slug: "bulls" }),
      club({ name: "Bulls 2026 01 03__legacy__d8463a54", slug: "bulls-2026-01-03__legacy__d8463a54" }),
      club({ name: "Bulls", slug: "bulls__legacy__abc12345" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Bulls");
    expect(rows[0]?.slug).toBe("bulls");
  });

  it("collapses Black Lion duplicates onto the clean slug", () => {
    const rows = collapseAdminClubCatalog([
      club({ name: "Black Lion", slug: "black-lion__legacy__deadbeef" }),
      club({ name: "Black Lion", slug: "black-lion" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe("black-lion");
  });

  it("shows dated Borders/Bridgend/Caerphilly clones as the club name", () => {
    const rows = collapseAdminClubCatalog([
      club({ name: "Borders 2003 11 01", slug: "borders-2003-11-01" }),
      club({ name: "Borders", slug: "borders" }),
      club({ name: "Bridgend 2002 09 20", slug: "bridgend-2002-09-20" }),
      club({ name: "Caerphilly 2002 08 30", slug: "caerphilly-2002-08-30" }),
    ]);
    const names = rows.map((row) => row.name);
    expect(names).toEqual(["Borders", "Bridgend", "Caerphilly"]);
  });

  it("merges Benetton hash clones and The Black Lion", () => {
    const rows = collapseAdminClubCatalog([
      club({ name: "Benetton Dp9zn98l", slug: "benetton-dp9zn98l-2017-09-01" }),
      club({ name: "Benetton Treviso", slug: "benetton-treviso" }),
      club({ name: "The Black Lion", slug: "the-black-lion" }),
      club({ name: "Black Lion", slug: "black-lion" }),
    ]);
    expect(rows.map((row) => row.name).sort()).toEqual(["Benetton Treviso", "Black Lion"]);
  });

  it("drops Wikipedia flagicon debris", () => {
    const rows = collapseAdminClubCatalog([
      club({
        name: "Bayonne",
        slug: "flagicon-fra-bayonne-ref-cite-news-url-https-www-bbc-co-uk",
      }),
      club({ name: "Bayonne", slug: "bayonne" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe("bayonne");
  });
});
