import { describe, expect, it } from "vitest";
import {
  mapStatsPerformPlayerStats,
  parseStatsPerformSquadsPayload,
  statsPerformLabelsMatch,
  statsPerformPersonDisplayName,
} from "./stats-perform-ingest-service";

describe("parseStatsPerformSquadsPayload", () => {
  it("reads contestants, people, and calendar metadata", () => {
    const parsed = parseStatsPerformSquadsPayload({
      competition: { id: "comp1", name: "Top 14" },
      tournamentCalendar: {
        id: "cal1",
        value: "Top 14 2024/2025",
        startDate: "2024-09-01Z",
        endDate: "2025-06-30Z",
      },
      squad: [
        {
          contestantId: "team1",
          contestantName: "Montpellier Hérault Rugby",
          contestantShortName: "MHR",
          type: "club",
          person: [
            {
              id: "p1",
              firstName: "Paul",
              lastName: "Willemse",
              matchName: "P. Willemse",
              nationality: "South Africa",
              position: "Lock",
              active: "yes",
            },
            { id: "", firstName: "", lastName: "" },
          ],
        },
      ],
    });

    expect(parsed.competitionName).toBe("Top 14");
    expect(parsed.calendarName).toBe("Top 14 2024/2025");
    expect(parsed.contestants).toHaveLength(1);
    expect(parsed.contestants[0]?.person).toEqual([
      {
        id: "p1",
        firstName: "Paul",
        lastName: "Willemse",
        matchName: "P. Willemse",
        nationality: "South Africa",
        position: "Lock",
        active: "yes",
      },
    ]);
  });

  it("returns empty contestants for unexpected payloads", () => {
    expect(parseStatsPerformSquadsPayload(null).contestants).toEqual([]);
    expect(parseStatsPerformSquadsPayload({}).contestants).toEqual([]);
  });
});

describe("statsPerformLabelsMatch", () => {
  it("matches hyphen and accent variants without junk substring hits", () => {
    expect(statsPerformLabelsMatch("Union Bordeaux Bègles", "Union Bordeaux-Bègles")).toBe(true);
    expect(statsPerformLabelsMatch("Union Bordeaux Bègles", "Bordeaux Begles")).toBe(true);
    expect(statsPerformLabelsMatch("Union Bordeaux Bègles", "t=South Eastern Transvaal")).toBe(false);
    expect(statsPerformLabelsMatch("Championship", "Rugby Europe Championship")).toBe(false);
    expect(statsPerformLabelsMatch("Top 14", "Top 14")).toBe(true);
    expect(statsPerformLabelsMatch("Atlantique Stade Rochelais", "La Rochelle")).toBe(false);
    expect(statsPerformLabelsMatch("RC Toulonnais", "Toulon")).toBe(false);
  });
});

describe("statsPerformPersonDisplayName", () => {
  it("joins first and last name", () => {
    expect(
      statsPerformPersonDisplayName({
        id: "1",
        firstName: "Antoine",
        lastName: "Dupont",
      }),
    ).toBe("Antoine Dupont");
  });
});

describe("mapStatsPerformPlayerStats", () => {
  it("maps carry/tackle/try types into match-performance fields and keeps the raw map", () => {
    const { parsed, map, tries, points } = mapStatsPerformPlayerStats([
      { type: "minsPlayed", value: "72" },
      { type: "carriesMetres", value: 48 },
      { type: "tackles", value: 11 },
      { type: "missedTackles", value: 2 },
      { type: "cleanBreaks", value: 3 },
      { type: "defendersBeaten", value: 5 },
      { type: "tries", value: 1 },
      { type: "points", value: 5 },
      { type: "runs", value: 9 },
    ]);

    expect(parsed.minutesPlayed).toBe(72);
    expect(parsed.metresCarried).toBe(48);
    expect(parsed.carries).toBe(9);
    expect(parsed.tacklesMade).toBe(11);
    expect(parsed.missedTackles).toBe(2);
    expect(parsed.lineBreaks).toBe(3);
    expect(parsed.defendersBeaten).toBe(5);
    expect(tries).toBe(1);
    expect(points).toBe(5);
    expect(map.carriesMetres).toBe(48);
  });
});
