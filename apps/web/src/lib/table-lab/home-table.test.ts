import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  applyHomeTablePostProcessing,
  buildHomeTableStandings,
  homeWinPct,
  parseMinMatchesPlayed,
} from "./home-table-service";
import { buildLeagueStandingsFromPerspectives, filterBySide } from "./rugby-table-metrics-service";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective>): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
    teamId: "t1",
    teamName: "Bath",
    opponentId: "t2",
    opponentName: "Exeter Chiefs",
    side: "home",
    pointsFor: 24,
    pointsAgainst: 17,
    triesFor: 4,
    triesAgainst: 2,
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

describe("home table", () => {
  it("maps type=home-table route param to home_table id", () => {
    expect(tableIdFromTypeParam("home-table")).toBe("home_table");
  });

  it("includes home matches only and excludes away fixtures", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home", pointsFor: 30, pointsAgainst: 10 }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away", pointsFor: 10, pointsAgainst: 30 }),
      perspective({ fixtureId: "f2", teamId: "t1", teamName: "Bath", side: "away", pointsFor: 12, pointsAgainst: 20 }),
      perspective({ fixtureId: "f2", teamId: "t3", teamName: "Exeter Chiefs", side: "home", pointsFor: 20, pointsAgainst: 12 }),
    ];

    const { rows } = buildHomeTableStandings({ perspectives: fixtures, rules });
    const bath = rows.find((row) => row.teamName === "Bath");
    const saracens = rows.find((row) => row.teamName === "Saracens");
    const exeter = rows.find((row) => row.teamName === "Exeter Chiefs");

    expect(bath?.played).toBe(1);
    expect(bath?.won).toBe(1);
    expect(saracens).toBeUndefined();
    expect(exeter?.played).toBe(1);
    expect(filterBySide(fixtures, "home")).toHaveLength(2);
  });

  it("calculates bonus points and points difference from home results", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const { rows } = buildHomeTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          side: "home",
          pointsFor: 31,
          pointsAgainst: 28,
          triesFor: 4,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          teamName: "Saracens",
          side: "away",
          pointsFor: 28,
          pointsAgainst: 31,
          triesFor: 3,
        }),
      ],
      rules,
    });

    const bath = rows.find((row) => row.teamName === "Bath");
    expect(bath?.pointsDiff).toBe(3);
    expect(bath?.tryBonusPoints).toBe(1);
    expect(bath?.bonusPoints).toBe(1);
    expect(bath?.leaguePoints).toBe(5);
  });

  it("sorts by league points, wins, points difference, points for, tries for, team name", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home", pointsFor: 20, pointsAgainst: 18, triesFor: 3 }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away", pointsFor: 18, pointsAgainst: 20, triesFor: 2 }),
      perspective({ fixtureId: "f2", teamId: "t1", teamName: "Bath", side: "home", pointsFor: 24, pointsAgainst: 17, triesFor: 4 }),
      perspective({ fixtureId: "f2", teamId: "t3", teamName: "Exeter Chiefs", side: "away", pointsFor: 17, pointsAgainst: 24, triesFor: 2 }),
      perspective({ fixtureId: "f3", teamId: "t2", teamName: "Saracens", side: "home", pointsFor: 30, pointsAgainst: 10, triesFor: 5 }),
      perspective({ fixtureId: "f3", teamId: "t3", teamName: "Exeter Chiefs", side: "away", pointsFor: 10, pointsAgainst: 30, triesFor: 1 }),
    ];

    const homeOnly = buildLeagueStandingsFromPerspectives(filterBySide(fixtures, "home"), rules);
    const { rows } = buildHomeTableStandings({ perspectives: fixtures, rules });

    expect(rows.map((row) => row.teamName)).toEqual(homeOnly.map((row) => row.teamName));
    expect(rows[0]?.teamName).toBe("Bath");
  });

  it("omits teams with no home matches", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const { rows } = buildHomeTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          side: "away",
          pointsFor: 24,
          pointsAgainst: 17,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          teamName: "Saracens",
          side: "home",
          pointsFor: 17,
          pointsAgainst: 24,
        }),
      ],
      rules,
    });

    expect(rows.find((row) => row.teamName === "Bath")).toBeUndefined();
    expect(rows.find((row) => row.teamName === "Saracens")).toBeDefined();
  });

  it("filters by minimum home matches played", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home" }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away" }),
      perspective({ fixtureId: "f2", teamId: "t1", teamName: "Bath", side: "home" }),
      perspective({ fixtureId: "f2", teamId: "t3", teamName: "Exeter Chiefs", side: "away" }),
      perspective({ fixtureId: "f3", teamId: "t2", teamName: "Saracens", side: "home" }),
      perspective({ fixtureId: "f3", teamId: "t3", teamName: "Exeter Chiefs", side: "away" }),
    ];

    const { rows } = buildHomeTableStandings({
      perspectives: fixtures,
      rules,
      minMatchesPlayed: 2,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.teamName).toBe("Bath");
    expect(rows[0]?.played).toBe(2);
  });

  it("calculates home win percentage", () => {
    expect(homeWinPct(2, 4)).toBe(50);
    const { rows } = buildHomeTableStandings({
      perspectives: [
        perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home", pointsFor: 24, pointsAgainst: 10 }),
        perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away", pointsFor: 10, pointsAgainst: 24 }),
        perspective({ fixtureId: "f2", teamId: "t1", teamName: "Bath", side: "home", pointsFor: 12, pointsAgainst: 15 }),
        perspective({ fixtureId: "f2", teamId: "t3", teamName: "Exeter Chiefs", side: "away", pointsFor: 15, pointsAgainst: 12 }),
      ],
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    const bath = rows.find((row) => row.teamName === "Bath");
    expect(bath?.winPct).toBe(50);
  });

  it("enriches synced rows with home win percentage", () => {
    const rows = applyHomeTablePostProcessing([
      {
        rank: 1,
        teamId: "t1",
        teamName: "Bath",
        played: 3,
        won: 2,
        drawn: 0,
        lost: 1,
        pointsFor: 60,
        pointsAgainst: 40,
        pointsDiff: 20,
        bonusPoints: 2,
        leaguePoints: 10,
      },
    ]);

    expect(rows[0]?.winPct).toBeCloseTo(66.7, 1);
  });

  it("parses minimum matches played safely", () => {
    expect(parseMinMatchesPlayed("3")).toBe(3);
    expect(parseMinMatchesPlayed(0)).toBe(1);
    expect(parseMinMatchesPlayed("bad")).toBe(1);
    expect(parseMinMatchesPlayed(99)).toBe(50);
  });
});
