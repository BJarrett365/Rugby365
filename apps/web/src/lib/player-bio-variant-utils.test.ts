import { describe, expect, it } from "vitest";
import {
  bioTypesForRefresh,
  composeFlatBioProfile,
  readBioVariants,
} from "./player-bio-variant-utils";
import { EMPTY_BIO_SECTIONS } from "./player-bio-types";

describe("player bio variants", () => {
  it("composes flat profile from separate variants without losing international or scouting", () => {
    const variants = {
      domestic: {
        ...EMPTY_BIO_SECTIONS,
        shortIntro: "Club intro",
        fullBio: "Domestic full bio",
      },
      international: {
        ...EMPTY_BIO_SECTIONS,
        internationalSummary: "England international profile",
      },
      scouting: {
        ...EMPTY_BIO_SECTIONS,
        scoutingSummary: "Scouting report",
        ratingExplanation: "Strong carrier",
      },
    };

    const flat = composeFlatBioProfile(variants);
    expect(flat.shortIntro).toBe("Club intro");
    expect(flat.internationalSummary).toBe("England international profile");
    expect(flat.scoutingSummary).toBe("Scouting report");
  });

  it("reads legacy flat columns into variants when variant json is empty", () => {
    const variants = readBioVariants({
      shortIntro: "Legacy intro",
      internationalSummary: "Legacy international",
      scoutingSummary: "Legacy scouting",
    });
    expect(variants.domestic.shortIntro).toBe("Legacy intro");
    expect(variants.international.internationalSummary).toBe("Legacy international");
    expect(variants.scouting.scoutingSummary).toBe("Legacy scouting");
  });

  it("queues domestic and scouting refresh on match stats", () => {
    const types = bioTypesForRefresh({
      trigger: "match_stats_imported",
      shouldRefresh: true,
      clubChanged: false,
      positionChanged: false,
      internationalChanged: false,
      ratingChanged: false,
      formChanged: false,
      badgeAdded: false,
      ageProfileChanged: false,
      isInternational: false,
      initial: false,
    });
    expect(types).toContain("domestic");
    expect(types).toContain("scouting");
  });

  it("queues international and domestic refresh when caps status changes", () => {
    const types = bioTypesForRefresh({
      trigger: "international_status_changed",
      shouldRefresh: true,
      clubChanged: false,
      positionChanged: false,
      internationalChanged: true,
      ratingChanged: false,
      formChanged: false,
      badgeAdded: false,
      ageProfileChanged: false,
      isInternational: true,
      initial: false,
    });
    expect(types).toEqual(expect.arrayContaining(["international", "domestic"]));
  });
});
