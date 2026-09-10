import { describe, expect, it } from "vitest";
import { buildLiveTableStandings } from "./live-table-service";
import { rugbyChampionshipScoringRules } from "./competition-scoring-rules-catalog";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective>): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2014-08-16T08:00:00.000Z"),
    teamId: "t1",
    teamName: "New Zealand",
    opponentId: "t2",
    opponentName: "Australia",
    side: "home",
    pointsFor: 0,
    pointsAgainst: 0,
    triesFor: 0,
    triesAgainst: 0,
    firstHalfFor: null,
    firstHalfAgainst: null,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: null,
    concededFirst: null,
    wasWinning: null,
    wasLosing: null,
    wasDrawn: null,
    possessionPct: null,
    territoryPct: null,
    lineoutsWon: null,
    lineoutsLost: null,
    scrumSuccessPct: null,
    scrumPenaltiesWon: null,
    scrumPenaltiesConceded: null,
    carries: null,
    metres: null,
    lineBreaks: null,
    defendersBeaten: null,
    postContactMetres: null,
    tryAssists: null,
    turnoversWon: null,
    tacklesMade: null,
    tacklesCompleted: null,
    dominantTackles: null,
    missedTackles: null,
    penaltiesConceded: null,
    yellowCards: 0,
    redCards: 0,
    opponentLeagueRank: null,
    ...overrides,
  };
}

function pair(input: {
  id: string;
  date: string;
  homeId: string;
  home: string;
  awayId: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
}): TeamFixturePerspective[] {
  const kickoffAt = new Date(`${input.date}T08:00:00.000Z`);
  return [
    perspective({
      fixtureId: input.id,
      kickoffAt,
      teamId: input.homeId,
      teamName: input.home,
      opponentId: input.awayId,
      opponentName: input.away,
      side: "home",
      pointsFor: input.homeScore,
      pointsAgainst: input.awayScore,
      triesFor: input.homeTries,
      triesAgainst: input.awayTries,
    }),
    perspective({
      fixtureId: input.id,
      kickoffAt,
      teamId: input.awayId,
      teamName: input.away,
      opponentId: input.homeId,
      opponentName: input.home,
      side: "away",
      pointsFor: input.awayScore,
      pointsAgainst: input.homeScore,
      triesFor: input.awayTries,
      triesAgainst: input.homeTries,
    }),
  ];
}

describe("Rugby Championship standings", () => {
  it("uses four-try bonus through 2015 and three-try lead from 2016", () => {
    expect(rugbyChampionshipScoringRules(2014)).toMatchObject({
      winPoints: 4,
      drawPoints: 2,
      tryBonusThreshold: 4,
      tryBonusLead: null,
      losingBonusPoints: 1,
    });
    expect(rugbyChampionshipScoringRules(2016)).toMatchObject({
      tryBonusLead: 3,
      losingBonusPoints: 1,
    });
  });

  it("calculates the verified 2014 final table from match results", () => {
    const nz = "nz";
    const sa = "sa";
    const aus = "aus";
    const arg = "arg";
    const perspectives = [
      ...pair({
        id: "m1",
        date: "2014-08-16",
        homeId: aus,
        home: "Australia",
        awayId: nz,
        away: "New Zealand",
        homeScore: 12,
        awayScore: 12,
        homeTries: 0,
        awayTries: 0,
      }),
      ...pair({
        id: "m2",
        date: "2014-08-16",
        homeId: sa,
        home: "South Africa",
        awayId: arg,
        away: "Argentina",
        homeScore: 13,
        awayScore: 6,
        homeTries: 1,
        awayTries: 0,
      }),
      ...pair({
        id: "m3",
        date: "2014-08-23",
        homeId: nz,
        home: "New Zealand",
        awayId: aus,
        away: "Australia",
        homeScore: 51,
        awayScore: 20,
        homeTries: 6,
        awayTries: 2,
      }),
      ...pair({
        id: "m4",
        date: "2014-08-23",
        homeId: arg,
        home: "Argentina",
        awayId: sa,
        away: "South Africa",
        homeScore: 31,
        awayScore: 33,
        homeTries: 3,
        awayTries: 3,
      }),
      ...pair({
        id: "m5",
        date: "2014-09-06",
        homeId: nz,
        home: "New Zealand",
        awayId: arg,
        away: "Argentina",
        homeScore: 28,
        awayScore: 9,
        homeTries: 4,
        awayTries: 0,
      }),
      ...pair({
        id: "m6",
        date: "2014-09-06",
        homeId: aus,
        home: "Australia",
        awayId: sa,
        away: "South Africa",
        homeScore: 24,
        awayScore: 23,
        homeTries: 2,
        awayTries: 1,
      }),
      ...pair({
        id: "m7",
        date: "2014-09-13",
        homeId: nz,
        home: "New Zealand",
        awayId: sa,
        away: "South Africa",
        homeScore: 14,
        awayScore: 10,
        homeTries: 1,
        awayTries: 1,
      }),
      ...pair({
        id: "m8",
        date: "2014-09-13",
        homeId: aus,
        home: "Australia",
        awayId: arg,
        away: "Argentina",
        homeScore: 32,
        awayScore: 25,
        homeTries: 3,
        awayTries: 3,
      }),
      ...pair({
        id: "m9",
        date: "2014-09-27",
        homeId: sa,
        home: "South Africa",
        awayId: aus,
        away: "Australia",
        homeScore: 28,
        awayScore: 10,
        homeTries: 4,
        awayTries: 1,
      }),
      ...pair({
        id: "m10",
        date: "2014-09-27",
        homeId: arg,
        home: "Argentina",
        awayId: nz,
        away: "New Zealand",
        homeScore: 13,
        awayScore: 34,
        homeTries: 1,
        awayTries: 4,
      }),
      ...pair({
        id: "m11",
        date: "2014-10-04",
        homeId: sa,
        home: "South Africa",
        awayId: nz,
        away: "New Zealand",
        homeScore: 27,
        awayScore: 25,
        homeTries: 3,
        awayTries: 3,
      }),
      ...pair({
        id: "m12",
        date: "2014-10-04",
        homeId: arg,
        home: "Argentina",
        awayId: aus,
        away: "Australia",
        homeScore: 21,
        awayScore: 17,
        homeTries: 2,
        awayTries: 2,
      }),
    ];

    const { rows } = buildLiveTableStandings({
      perspectives,
      rules: rugbyChampionshipScoringRules(2014),
      tableView: "all",
      showMovement: false,
    });

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      teamName: "New Zealand",
      played: 6,
      won: 4,
      drawn: 1,
      lost: 1,
      pointsFor: 164,
      pointsAgainst: 91,
      pointsDiff: 73,
      bonusPoints: 4,
      leaguePoints: 22,
    });
    expect(rows[1]).toMatchObject({
      teamName: "South Africa",
      played: 6,
      won: 4,
      drawn: 0,
      lost: 2,
      pointsFor: 134,
      pointsAgainst: 110,
      pointsDiff: 24,
      bonusPoints: 3,
      leaguePoints: 19,
    });
    expect(rows[2]).toMatchObject({
      teamName: "Australia",
      played: 6,
      won: 2,
      drawn: 1,
      lost: 3,
      pointsFor: 115,
      pointsAgainst: 160,
      pointsDiff: -45,
      bonusPoints: 1,
      leaguePoints: 11,
    });
    expect(rows[3]).toMatchObject({
      teamName: "Argentina",
      played: 6,
      won: 1,
      drawn: 0,
      lost: 5,
      pointsFor: 105,
      pointsAgainst: 157,
      pointsDiff: -52,
      bonusPoints: 3,
      leaguePoints: 7,
    });
  });

  it("awards the 2016+ try bonus only when a side finishes three tries ahead", () => {
    const rules = rugbyChampionshipScoringRules(2016);
    const { rows: noBonus } = buildLiveTableStandings({
      perspectives: pair({
        id: "m1",
        date: "2016-08-20",
        homeId: "nz",
        home: "New Zealand",
        awayId: "aus",
        away: "Australia",
        homeScore: 42,
        awayScore: 8,
        homeTries: 5,
        awayTries: 3,
      }),
      rules,
      tableView: "all",
      showMovement: false,
    });
    expect(noBonus.find((row) => row.teamName === "New Zealand")?.bonusPoints).toBe(0);

    const { rows: withBonus } = buildLiveTableStandings({
      perspectives: pair({
        id: "m1",
        date: "2016-08-20",
        homeId: "nz",
        home: "New Zealand",
        awayId: "aus",
        away: "Australia",
        homeScore: 42,
        awayScore: 8,
        homeTries: 6,
        awayTries: 3,
      }),
      rules,
      tableView: "all",
      showMovement: false,
    });
    expect(withBonus.find((row) => row.teamName === "New Zealand")?.bonusPoints).toBe(1);
    expect(withBonus.find((row) => row.teamName === "New Zealand")?.leaguePoints).toBe(5);
  });

  it("awards the 2016+ try-lead bonus when the opponent scores no tries", () => {
    const { rows } = buildLiveTableStandings({
      perspectives: pair({
        id: "m1",
        date: "2016-10-08",
        homeId: "sa",
        home: "South Africa",
        awayId: "nz",
        away: "New Zealand",
        homeScore: 15,
        awayScore: 57,
        homeTries: 0,
        awayTries: 9,
      }),
      rules: rugbyChampionshipScoringRules(2016),
      tableView: "all",
      showMovement: false,
    });
    expect(rows.find((row) => row.teamName === "New Zealand")).toMatchObject({
      bonusPoints: 1,
      leaguePoints: 5,
    });
  });

  it("attributes the 2014 Pretoria result to South Africa and Argentina correctly", () => {
    const { rows } = buildLiveTableStandings({
      perspectives: pair({
        id: "m2",
        date: "2014-08-16",
        homeId: "sa",
        home: "South Africa",
        awayId: "arg",
        away: "Argentina",
        homeScore: 13,
        awayScore: 6,
        homeTries: 1,
        awayTries: 0,
      }),
      rules: rugbyChampionshipScoringRules(2014),
      tableView: "all",
      showMovement: false,
    });
    expect(rows.find((row) => row.teamName === "South Africa")).toMatchObject({
      played: 1,
      won: 1,
      pointsFor: 13,
      pointsAgainst: 6,
      leaguePoints: 4,
    });
    expect(rows.find((row) => row.teamName === "Argentina")).toMatchObject({
      played: 1,
      lost: 1,
      pointsFor: 6,
      pointsAgainst: 13,
      bonusPoints: 1,
      leaguePoints: 1,
    });
  });

  it("does not invent zero standings when a season has no matches", () => {
    const { rows } = buildLiveTableStandings({
      perspectives: [],
      rules: rugbyChampionshipScoringRules(2026),
      tableView: "all",
      showMovement: false,
    });
    expect(rows).toEqual([]);
  });
});
