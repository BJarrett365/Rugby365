import { describe, expect, it } from "vitest";
import { summariseStatsPerformMatches, summariseStatsPerformSquads } from "./stats-perform-sdapi-client";

describe("summariseStatsPerformMatches", () => {
  it("maps home/away names and totals from a match payload", () => {
    const rows = summariseStatsPerformMatches({
      matches: [
        {
          matchInfo: {
            id: "abc",
            date: "2026-09-01",
            time: "19:00:00Z",
            competition: { name: "Premiership" },
            contestants: [
              { position: "home", name: "Bath Rugby" },
              { position: "away", name: "Leicester Tigers" },
            ],
          },
          liveData: {
            matchDetails: {
              matchStatus: "Played",
              scores: { total: { home: 27, away: 20 } },
            },
          },
        },
      ],
    });

    expect(rows).toEqual([
      {
        id: "abc",
        date: "2026-09-01",
        time: "19:00:00Z",
        status: "Played",
        competition: "Premiership",
        home: "Bath Rugby",
        away: "Leicester Tigers",
        homeScore: 27,
        awayScore: 20,
      },
    ]);
  });

  it("returns an empty list for unexpected payloads", () => {
    expect(summariseStatsPerformMatches(null)).toEqual([]);
    expect(summariseStatsPerformMatches({})).toEqual([]);
  });

  it("maps contestant (singular) and a single match object", () => {
    const rows = summariseStatsPerformMatches({
      matchInfo: {
        id: "fx1",
        date: "2025-05-11Z",
        contestant: [
          { position: "home", name: "Montpellier Hérault Rugby" },
          { position: "away", name: "Union Bordeaux Bègles" },
        ],
        competition: { name: "Top 14" },
      },
      liveData: {
        matchDetails: {
          matchStatus: "Played",
          scores: { total: { home: "46", away: "27" } },
        },
      },
    });
    expect(rows[0]).toMatchObject({
      id: "fx1",
      home: "Montpellier Hérault Rugby",
      away: "Union Bordeaux Bègles",
      homeScore: 46,
      awayScore: 27,
      competition: "Top 14",
    });
  });

  it("counts squad players from the documented squads payload", () => {
    const summary = summariseStatsPerformSquads({
      competition: { name: "Rugby Europe Championship" },
      tournamentCalendar: { value: "Rugby Europe Championship 2023" },
      squad: [
        { contestantName: "Georgia", person: [{}, {}, {}] },
        { contestantName: "Romania", person: [{}, {}] },
      ],
    });
    expect(summary.competition).toBe("Rugby Europe Championship");
    expect(summary.tournamentCalendar).toBe("Rugby Europe Championship 2023");
    expect(summary.squads).toEqual([
      { contestantName: "Georgia", playerCount: 3 },
      { contestantName: "Romania", playerCount: 2 },
    ]);
  });
});
