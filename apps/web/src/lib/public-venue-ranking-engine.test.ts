import { describe, expect, it } from "vitest";
import {
  categoryImplementationNote,
  deriveVenueType,
  effectiveRugbyCapacity,
  mergeEditorialAndDataRanks,
  type VenueRankingRow,
} from "./public-venue-ranking-engine";

function row(overrides: Partial<VenueRankingRow> & { id: string }): VenueRankingRow {
  return {
    capacity: 50000,
    rugbyCapacity: null,
    venueType: null,
    latitude: -36.87,
    longitude: 174.76,
    openedYear: 1900,
    r365Rating: null,
    fixtureCount: 50,
    homeWinPct: 0.72,
    avgAttendancePct: 0.85,
    homeTeamCount: 1,
    intlFixtureCount: 10,
    wikipediaUrl: null,
    ...overrides,
  };
}

describe("public-venue-ranking-engine", () => {
  it("places editorial #1 ahead of data scores for best overall", () => {
    const cohort = [
      row({ id: "eden", capacity: 50000 }),
      row({ id: "twickenham", capacity: 82000, fixtureCount: 200 }),
    ];
    const merged = mergeEditorialAndDataRanks({
      cohort,
      category: "best",
      editorial: [
        {
          venueId: "eden",
          category: "best",
          editorialRank: 1,
          editorialReason: "Editorial pick",
        },
      ],
      limit: 5,
    });
    expect(merged[0]?.venueId).toBe("eden");
    expect(merged[0]?.rankSource).toBe("editorial");
    expect(merged[0]?.dataRank).toBeNull();
  });

  it("does not assign R365 rating via editorial merge", () => {
    const scored = mergeEditorialAndDataRanks({
      cohort: [row({ id: "a", r365Rating: null })],
      category: "best",
      editorial: [],
      limit: 1,
    });
    expect(scored[0]?.rankSource).toBe("provisional");
  });

  it("ranks biggest by rugby capacity", () => {
    const merged = mergeEditorialAndDataRanks({
      cohort: [
        row({ id: "small", capacity: 5000, rugbyCapacity: 5000, homeTeamCount: 1, fixtureCount: 20 }),
        row({ id: "large", capacity: 80000, rugbyCapacity: 75000, homeTeamCount: 1, fixtureCount: 30 }),
      ],
      category: "biggest",
      editorial: [],
      limit: 2,
    });
    expect(merged[0]?.venueId).toBe("large");
  });

  it("derives multi-sport for large low-fixture venues", () => {
    const type = deriveVenueType(
      row({ id: "mcg", capacity: 100000, fixtureCount: 2, homeTeamCount: 0 }),
    );
    expect(type).toBe("multi_sport");
  });

  it("labels iconic as editorial-only implementation", () => {
    expect(categoryImplementationNote("iconic")).toBe("editorial");
    expect(categoryImplementationNote("biggest")).toBe("data");
    expect(categoryImplementationNote("best")).toBe("mixed");
  });

  it("uses rugby capacity when set", () => {
    expect(effectiveRugbyCapacity({ capacity: 100000, rugbyCapacity: 48000 })).toBe(48000);
  });
});
