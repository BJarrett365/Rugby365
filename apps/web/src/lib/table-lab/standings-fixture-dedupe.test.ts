import { describe, expect, it } from "vitest";
import {
  canonicalStandingsTeamName,
  isHealthyStandingsRows,
  isStaleLiveFixture,
  isUnknownStandingsTeamName,
  pickCanonicalFixturesForStandings,
  pickCanonicalTeamIdByName,
  resolvePublicClubNamesFromFixtureSlug,
  resolveTeamNamesFromFixtureSlug,
  scoreFixtureForStandingsDedupe,
  standingsMatchDayKey,
  stripImportedDateSuffix,
} from "./standings-fixture-dedupe";

describe("standings fixture dedupe", () => {
  it("maps national nicknames to country names", () => {
    expect(canonicalStandingsTeamName("All Blacks")).toBe("New Zealand");
    expect(canonicalStandingsTeamName("Wallabies")).toBe("Australia");
    expect(canonicalStandingsTeamName("Springboks")).toBe("South Africa");
    expect(canonicalStandingsTeamName("Argentina")).toBe("Argentina");
  });

  it("detects unknown/orphan team labels", () => {
    expect(isUnknownStandingsTeamName("Unknown team e416a7d7de5e")).toBe(true);
    expect(isUnknownStandingsTeamName("Orphan")).toBe(true);
    expect(isUnknownStandingsTeamName("Argentina")).toBe(false);
  });

  it("strips clone-import date suffixes from display names", () => {
    expect(stripImportedDateSuffix("Counties Manukau 2026 08 23 2")).toBe("Counties Manukau");
    expect(stripImportedDateSuffix("Auckland 2026 08 22 2")).toBe("Auckland");
    expect(stripImportedDateSuffix("Glasgow Warriors 2026 02 28__legacy__01a15850")).toBe(
      "Glasgow Warriors",
    );
    expect(stripImportedDateSuffix("Auckland")).toBe("Auckland");
    expect(stripImportedDateSuffix("Benetton Dp9zn98l")).toBe("Benetton");
    expect(canonicalStandingsTeamName("Auckland 2026 08 22 2")).toBe("Auckland");
  });

  it("strips date suffixes from known public club names", () => {
    expect(
      resolvePublicClubNamesFromFixtureSlug(
        "north-harbour-v-auckland-2026-08-22-2",
        "North Harbour",
        "Auckland 2026 08 22 2",
      ),
    ).toEqual({ homeName: "North Harbour", awayName: "Auckland" });
  });

  it("keeps Currie Cup Pumas as a club when recovering public names from slug", () => {
    expect(
      resolvePublicClubNamesFromFixtureSlug(
        "pumas-v-griquas-2026-08-21__legacy__6cbb44af",
        "Unknown team ecea42c8880b",
        "Griquas",
      ),
    ).toEqual({ homeName: "Pumas", awayName: "Griquas" });
  });

  it("resolves orphan names from fixture slug", () => {
    expect(
      resolveTeamNamesFromFixtureSlug(
        "argentina-v-south-africa-2025-09-27__legacy__c727dafb",
        "Unknown team e416a7d7de5e",
        "South Africa",
      ),
    ).toEqual({ homeName: "Argentina", awayName: "South Africa" });

    expect(
      resolveTeamNamesFromFixtureSlug(
        "australia-v-all-blacks-2025-10-04",
        "Unknown team 65566c57f615",
        "All Blacks",
      ),
    ).toEqual({ homeName: "Australia", awayName: "New Zealand" });

    expect(
      resolveTeamNamesFromFixtureSlug(
        "sharks-v-stade-toulousain-2025-01-11",
        "Unknown team 68800845167a",
        "Unknown team 3041fa76d9fa",
      ),
    ).toEqual({ homeName: "Sharks", awayName: "Toulouse" });

    expect(
      resolveTeamNamesFromFixtureSlug(
        "sale-sharks-v-toulon-krjdq463-2025-01-19",
        "Sale Sharks",
        "Unknown team abc",
      ),
    ).toEqual({ homeName: "Sale Sharks", awayName: "Toulon" });

    expect(
      resolveTeamNamesFromFixtureSlug(
        "stormers-v-cardiff-rugby-2026-05-30__legacy__828ef9b0",
        "DHL Stormers XXIII",
        "Unknown team 54fb30268418",
      ),
    ).toEqual({ homeName: "DHL Stormers XXIII", awayName: "Cardiff Rugby" });

    expect(
      resolveTeamNamesFromFixtureSlug(
        "south-africa-v-ru-jpn-2025-11-01",
        "South Africa",
        "Unknown team 9efeaaf99bcf",
      ),
    ).toEqual({ homeName: "South Africa", awayName: "Japan" });
  });

  it("marks old live fixtures as stale", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    expect(isStaleLiveFixture("live", "2025-09-27T15:10:00.000Z", now)).toBe(true);
    expect(isStaleLiveFixture("live", "2026-08-10T10:00:00.000Z", now)).toBe(false);
    expect(isStaleLiveFixture("full_time", "2025-09-27T15:10:00.000Z", now)).toBe(false);
    expect(isStaleLiveFixture("live", null, now)).toBe(true);
    expect(isStaleLiveFixture("live", "2026-08-10T18:00:00.000Z", now)).toBe(true);
  });

  it("builds a stable match-day key after nickname normalisation", () => {
    expect(
      standingsMatchDayKey("2025-10-04T17:45:00.000Z", "Australia", "All Blacks"),
    ).toBe("2025-10-04:australia:new zealand");
    expect(
      standingsMatchDayKey("2025-10-04T09:45:00.000Z", "All Blacks", "Australia"),
    ).toBe("2025-10-04:australia:new zealand");
  });

  it("keeps one canonical fixture per match-day pairing", () => {
    const rows = [
      {
        id: "legacy-unknown",
        slug: "argentina-v-south-africa-2025-10-04__legacy__abc",
        status: "live",
        homeScore: 0,
        awayScore: 0,
        homeName: "Unknown team e416",
        awayName: "South Africa",
        kickoffAt: "2025-10-04T13:00:00.000Z",
      },
      {
        id: "canonical",
        slug: "argentina-v-south-africa-2025-10-04",
        status: "full_time",
        homeScore: 27,
        awayScore: 29,
        homeName: "Argentina",
        awayName: "South Africa",
        kickoffAt: "2025-10-04T14:00:00.000Z",
      },
      {
        id: "wrmru",
        slug: "argentina-wrmru40-v-south-africa-2025-10-04",
        status: "full_time",
        homeScore: 27,
        awayScore: 29,
        homeName: "Argentina",
        awayName: "South Africa",
        kickoffAt: "2025-10-04T14:00:00.000Z",
      },
    ];

    const keepers = pickCanonicalFixturesForStandings(rows, (row) => row);
    expect(keepers).toHaveLength(1);
    expect(keepers[0]?.id).toBe("canonical");
    expect(scoreFixtureForStandingsDedupe(rows[1]!)).toBeGreaterThan(
      scoreFixtureForStandingsDedupe(rows[0]!),
    );
  });

  it("picks a stable canonical team id per nation", () => {
    const map = pickCanonicalTeamIdByName([
      { id: "nz-legacy", name: "New Zealand", slug: "new-zealand-5d9ywpjo__legacy__437b4617" },
      { id: "nz-main", name: "New Zealand", slug: "new-zealand-5d9ywpjo" },
      { id: "ab", name: "All Blacks", slug: "all-blacks" },
    ]);
    expect(map.get("new zealand")?.id).toBe("nz-main");
    expect(map.get("new zealand")?.name).toBe("New Zealand");
  });

  it("rejects unhealthy synced standings with duplicates or unknowns", () => {
    expect(
      isHealthyStandingsRows([
        { teamId: "1", teamName: "South Africa" },
        { teamId: "2", teamName: "New Zealand" },
      ]),
    ).toBe(true);
    expect(
      isHealthyStandingsRows([
        { teamId: "1", teamName: "New Zealand" },
        { teamId: "2", teamName: "New Zealand" },
      ]),
    ).toBe(false);
    expect(
      isHealthyStandingsRows([{ teamId: "1", teamName: "Unknown team abc" }]),
    ).toBe(false);
  });
});
