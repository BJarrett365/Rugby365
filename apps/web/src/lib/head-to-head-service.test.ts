import { describe, expect, it } from "vitest";
import { buildCompetitionSlots, mergeProviderSnapshot, parseSdmsHeadToHeadRecords } from "./head-to-head-service";

describe("mergeProviderSnapshot", () => {
  it("keeps sdms head-to-head when sport365 sync is applied", () => {
    const merged = mergeProviderSnapshot(
      {
        source: "planet_rugby",
        sdms: {
          headToHead: [{ competition_name: "International Matches", home_team_wins: 1 }],
          lastFiveMeetings: [{ match_id: "abc", home_team_name: "Italy", away_team_name: "New Zealand" }],
        },
      },
      {
        source: "sport365",
        sport365: { headToHead: { totalMeetings: 0, meetings: [], homeWins: 0, awayWins: 0, draws: 0 } },
      },
    );

    expect(merged.sdms).toMatchObject({
      lastFiveMeetings: [{ match_id: "abc" }],
    });
    expect(merged.sport365).toBeTruthy();
  });
});

describe("buildCompetitionSlots", () => {
  it("maps SDMS records into Planet Rugby competition tabs", () => {
    const records = parseSdmsHeadToHeadRecords([
      {
        competition_name: "International Matches",
        home_team_wins: 1,
        away_team_wins: 0,
        home_team_avg_tries: 4,
        away_team_avg_tries: 1,
        home_team_avg_carries: 146,
        away_team_avg_carries: 85,
        home_team_avg_tackles: 104,
        away_team_avg_tackles: 165,
      },
      {
        competition_name: "World Cup",
        home_team_wins: 1,
        away_team_wins: 0,
        home_team_avg_tries: 14,
        away_team_avg_tries: 2,
      },
    ]);

    const slots = buildCompetitionSlots(records);
    expect(slots.map((slot) => slot.competitionName)).toEqual([
      "International Matches",
      "World Cup",
      "Six Nations",
      "Nations Championship",
    ]);
    expect(slots[0]).toMatchObject({
      homeWins: 1,
      homeAvgTries: 4,
      homeAvgCarries: 146,
      hasData: true,
    });
    expect(slots[2].hasData).toBe(false);
  });
});
