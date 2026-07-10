import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildLeagueStandingsFromPerspectives,
  filterBySide,
  matchLeaguePoints,
} from "./rugby-table-metrics-service";
import { tableIdFromTypeParam, tableViewLabel } from "./table-view-utils";
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
    triesFor: 3,
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

describe("full table", () => {
  it("maps type=full-table route param to full_table id", () => {
    expect(tableIdFromTypeParam("full-table")).toBe("full_table");
  });

  it("uses competition-specific scoring rules", () => {
    const top14 = scoringRulesForCompetitionSlug("top-14", "domestic");
    expect(top14.tryBonusThreshold).toBe(3);
    const sixNations = scoringRulesForCompetitionSlug("six-nations", "international");
    expect(sixNations.losingBonusPoints).toBe(0);
  });

  it("calculates try and losing bonus points separately", () => {
    expect(matchLeaguePoints(31, 28, 4)).toMatchObject({
      leaguePoints: 5,
      bonusPoints: 1,
      tryBonusPoints: 1,
      losingBonusPoints: 0,
    });
    expect(matchLeaguePoints(17, 24, 2)).toMatchObject({
      leaguePoints: 1,
      bonusPoints: 1,
      tryBonusPoints: 0,
      losingBonusPoints: 1,
    });
  });

  it("builds all, home and away full tables from completed fixtures", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home", pointsFor: 30, pointsAgainst: 10, triesFor: 5 }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away", pointsFor: 10, pointsAgainst: 30, triesFor: 1 }),
      perspective({ fixtureId: "f2", teamId: "t1", teamName: "Bath", side: "away", pointsFor: 12, pointsAgainst: 12, triesFor: 2 }),
      perspective({ fixtureId: "f2", teamId: "t3", teamName: "Exeter Chiefs", side: "home", pointsFor: 12, pointsAgainst: 12, triesFor: 2 }),
    ];
    const rules = scoringRulesForCompetitionSlug("premiership");

    const all = buildLeagueStandingsFromPerspectives(fixtures, rules);
    const home = buildLeagueStandingsFromPerspectives(filterBySide(fixtures, "home"), rules);
    const away = buildLeagueStandingsFromPerspectives(filterBySide(fixtures, "away"), rules);

    expect(all).toHaveLength(3);
    expect(home).toHaveLength(2);
    expect(away).toHaveLength(2);
    expect(home.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(away.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("sorts by league points, wins, points difference, points for, tries for, team name", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", pointsFor: 20, pointsAgainst: 18, triesFor: 3 }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", pointsFor: 18, pointsAgainst: 20, triesFor: 2 }),
      perspective({ fixtureId: "f2", teamId: "t1", teamName: "Bath", pointsFor: 24, pointsAgainst: 17, triesFor: 4 }),
      perspective({ fixtureId: "f2", teamId: "t3", teamName: "Exeter Chiefs", pointsFor: 17, pointsAgainst: 24, triesFor: 2 }),
      perspective({ fixtureId: "f3", teamId: "t2", teamName: "Saracens", pointsFor: 30, pointsAgainst: 10, triesFor: 5 }),
      perspective({ fixtureId: "f3", teamId: "t3", teamName: "Exeter Chiefs", pointsFor: 10, pointsAgainst: 30, triesFor: 1 }),
    ];

    const rows = buildLeagueStandingsFromPerspectives(fixtures);
    expect(rows[0]?.teamName).toBe("Bath");
    expect(rows[0]?.leaguePoints).toBeGreaterThan(rows[1]?.leaguePoints ?? 0);
    expect(tableViewLabel("all")).toBe("All");
  });

  it("ignores incomplete fixtures when building from perspectives", () => {
    const rows = buildLeagueStandingsFromPerspectives([
      perspective({ teamId: "t1", teamName: "Bath" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.played).toBe(1);
  });

  it("omits try and try-bonus fields when SDMS try stats are missing", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const rows = buildLeagueStandingsFromPerspectives(
      [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          triesFor: null,
          triesAgainst: null,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          teamName: "Saracens",
          triesFor: null,
          triesAgainst: null,
        }),
      ],
      rules,
    );

    expect(rows[0]?.triesFor).toBeNull();
    expect(rows[0]?.triesAgainst).toBeNull();
    expect(rows[0]?.tryBonusPoints).toBeNull();
    expect(rows[0]?.losingBonusPoints).not.toBeNull();
  });
});
