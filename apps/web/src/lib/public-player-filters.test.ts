import { describe, expect, it } from "vitest";
import {
  buildPublicPlayerPath,
  normalizeSeasonSlugParam,
  seasonLabelToPublicSlug,
} from "./public-player-filters";
import {
  dedupeTransfersForPublic,
  findTransferConflicts,
  publicTransferCollapseKey,
} from "./public-player-transfer-utils";

describe("public-player-filters", () => {
  it("normalizes season slug variants", () => {
    expect(normalizeSeasonSlugParam("2025–26")).toBe("2025-26");
    expect(normalizeSeasonSlugParam("2025/26")).toBe("2025-26");
    expect(normalizeSeasonSlugParam("all")).toBe("all");
    expect(normalizeSeasonSlugParam(undefined)).toBe("current");
  });

  it("maps labels to public slugs", () => {
    expect(seasonLabelToPublicSlug("2025–26")).toBe("2025-26");
    expect(seasonLabelToPublicSlug("2023")).toBe("2023");
  });

  it("builds domestic and international paths with preserved filters", () => {
    expect(
      buildPublicPlayerPath({
        slug: "theo-mcfarland-2940zp68",
        view: "domestic",
        tab: "stats",
        season: "2025-26",
        competition: "premiership",
      }),
    ).toBe(
      "/players/theo-mcfarland-2940zp68?tab=stats&season=2025-26&competition=premiership",
    );
    expect(
      buildPublicPlayerPath({
        slug: "theo-mcfarland-2940zp68",
        view: "international",
        season: "2023",
      }),
    ).toBe("/players/theo-mcfarland-2940zp68/international?season=2023");
  });
});

describe("public transfer dedupe", () => {
  it("collapses same from→to across different seasons", () => {
    const rows = [
      {
        id: "1",
        effectiveDate: "2026-07-12",
        fromClub: "Saracens",
        toClub: "La Rochelle",
        fromTeamId: "a",
        toTeamId: "b",
        movementType: "permanent",
        seasonId: "s1",
        seasonLabel: "2025–26",
      },
      {
        id: "2",
        effectiveDate: "2026-07-09",
        fromClub: "Saracens",
        toClub: "La Rochelle",
        fromTeamId: "a",
        toTeamId: "b",
        movementType: "permanent",
        seasonId: "s2",
        seasonLabel: "2026–27",
      },
    ];
    expect(publicTransferCollapseKey(rows[0]!)).toBe(publicTransferCollapseKey(rows[1]!));
    const publicRows = dedupeTransfersForPublic(rows);
    expect(publicRows).toHaveLength(1);
    expect(publicRows[0]!.duplicateCollapsed).toBe(1);
    expect(findTransferConflicts(rows)).toHaveLength(1);
  });
});
