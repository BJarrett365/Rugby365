import { describe, expect, it } from "vitest";
import type { ScheduleFixture } from "./match-schedule-utils";
import { sanitizePublicScheduleFixtures } from "./public-schedule-sanitize";

function fixture(partial: Partial<ScheduleFixture> & Pick<ScheduleFixture, "id" | "slug">): ScheduleFixture {
  return {
    competitionId: null,
    competitionName: "NPC",
    matchDate: "2026-08-08",
    seasonLabel: "2026",
    kickoffAt: "2026-08-08T02:05:00.000Z",
    status: "scheduled",
    round: null,
    venue: null,
    homeScore: 0,
    awayScore: 0,
    homeTeam: { name: "Auckland" },
    awayTeam: { name: "Wellington" },
    source: "db",
    ...partial,
  };
}

describe("sanitizePublicScheduleFixtures", () => {
  it("recovers Unknown team labels from the fixture slug", () => {
    const rows = sanitizePublicScheduleFixtures([
      fixture({
        id: "1",
        slug: "pumas-v-griquas-2026-08-21__legacy__6cbb44af",
        homeTeam: { name: "Unknown team ecea42c8880b" },
        awayTeam: { name: "Griquas" },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeTeam?.name).toBe("Pumas");
    expect(rows[0]?.awayTeam?.name).toBe("Griquas");
  });

  it("keeps matches with unrecovered sides as TBC instead of dropping them", () => {
    const rows = sanitizePublicScheduleFixtures([
      fixture({
        id: "1",
        slug: "orphan-abc-v-orphan-def",
        homeTeam: { name: "Unknown team abc" },
        awayTeam: { name: "Unknown team def" },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeTeam?.name).toBe("TBC");
    expect(rows[0]?.awayTeam?.name).toBe("TBC");
  });

  it("strips imported date suffixes from club names", () => {
    const rows = sanitizePublicScheduleFixtures([
      fixture({
        id: "1",
        slug: "auckland-v-counties-manukau-2026-08-23-2",
        homeTeam: { name: "Auckland" },
        awayTeam: { name: "Counties Manukau 2026 08 23 2" },
      }),
    ]);
    expect(rows[0]?.awayTeam?.name).toBe("Counties Manukau");
  });

  it("collapses duplicate legacy clones onto the scored result", () => {
    const rows = sanitizePublicScheduleFixtures([
      fixture({
        id: "legacy-unknown",
        slug: "auckland-v-wellington-2026-08-08__legacy__016700a7",
        homeTeam: { name: "Unknown team 4b02e612985e" },
        awayTeam: { name: "Wellington" },
      }),
      fixture({
        id: "legacy-zero",
        slug: "auckland-v-wellington-2026-08-08__legacy__65c0a39c",
        status: "scheduled",
        homeScore: 0,
        awayScore: 0,
      }),
      fixture({
        id: "canonical",
        slug: "auckland-v-wellington-2026-08-08",
        status: "full_time",
        homeScore: 28,
        awayScore: 24,
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("canonical");
    expect(rows[0]?.homeScore).toBe(28);
    expect(rows[0]?.status).toBe("full_time");
  });

  it("promotes a stale scheduled row with scores to a result", () => {
    const rows = sanitizePublicScheduleFixtures([
      fixture({
        id: "harbour",
        slug: "north-harbour-v-counties-manukau-2026-08-06",
        kickoffAt: "2026-08-06T07:10:00.000Z",
        matchDate: "2026-08-06",
        status: "scheduled",
        homeScore: 59,
        awayScore: 19,
        homeTeam: { name: "North Harbour" },
        awayTeam: { name: "Counties Manukau" },
      }),
    ]);
    expect(rows[0]?.status).toBe("full_time");
  });

  it("collapses Hawke's Bay slug variants onto one named result", () => {
    const rows = sanitizePublicScheduleFixtures([
      fixture({
        id: "unknown",
        slug: "hawke-s-bay-v-tasman-2026-08-08",
        homeTeam: { name: "Unknown team d98cbf2996f2" },
        awayTeam: { name: "Tasman" },
        status: "full_time",
        homeScore: 50,
        awayScore: 19,
      }),
      fixture({
        id: "legacy-zero",
        slug: "hawkes-bay-v-tasman-2026-08-08__legacy__c8761df1",
        homeTeam: { name: "Unknown team d98cbf2996f2" },
        awayTeam: { name: "Tasman" },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeTeam?.name).toBe("Hawke's Bay");
    expect(rows[0]?.homeScore).toBe(50);
  });
});
