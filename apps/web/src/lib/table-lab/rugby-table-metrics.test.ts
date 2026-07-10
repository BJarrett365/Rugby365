import { describe, expect, it } from "vitest";
import {
  buildMetricStandings,
  filterBySide,
  finalizeStandingsRows,
  lineoutSuccessPct,
  matchLeaguePoints,
  recentFormPerspectives,
} from "./rugby-table-metrics-service";
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
    firstHalfFor: 10,
    firstHalfAgainst: 7,
    secondHalfFor: 14,
    secondHalfAgainst: 10,
    finalTwentyFor: 7,
    finalTwentyAgainst: 3,
    scoredFirst: true,
    concededFirst: false,
    wasWinning: true,
    wasLosing: false,
    wasDrawn: false,
    possessionPct: 0.54,
    territoryPct: 0.52,
    lineoutsWon: 12,
    lineoutsLost: 2,
    scrumSuccessPct: 0.92,
    scrumPenaltiesWon: 1,
    scrumPenaltiesConceded: 0,
    carries: 86,
    metres: 420,
    lineBreaks: 4,
    defendersBeaten: 18,
    postContactMetres: 55,
    tryAssists: 2,
    turnoversWon: 3,
    tacklesMade: 140,
    tacklesCompleted: 125,
    dominantTackles: 12,
    missedTackles: 15,
    penaltiesConceded: 8,
    yellowCards: 0,
    redCards: 0,
    opponentLeagueRank: null,
    ...overrides,
  };
}

describe("rugby-table-metrics", () => {
  it("awards Premiership-style league and bonus points", () => {
    expect(matchLeaguePoints(24, 17, 4)).toEqual({
      leaguePoints: 5,
      bonusPoints: 1,
      tryBonusPoints: 1,
      losingBonusPoints: 0,
      result: "won",
    });
    expect(matchLeaguePoints(17, 24, 2)).toEqual({
      leaguePoints: 1,
      bonusPoints: 1,
      tryBonusPoints: 0,
      losingBonusPoints: 1,
      result: "lost",
    });
  });

  it("calculates lineout success percentage", () => {
    expect(lineoutSuccessPct(12, 2)).toBe(85.7);
    expect(lineoutSuccessPct(null, 2)).toBeNull();
  });

  it("builds metric standings from team perspectives", () => {
    const rows = buildMetricStandings(
      [
        perspective({ teamId: "t1", teamName: "Bath", triesFor: 4 }),
        perspective({
          fixtureId: "f2",
          teamId: "t2",
          teamName: "Exeter Chiefs",
          triesFor: 2,
          pointsFor: 10,
          pointsAgainst: 20,
        }),
      ],
      (row) => row.triesFor,
    );

    expect(rows[0]?.teamName).toBe("Bath");
    expect(rows[0]?.metricValue).toBe(4);
  });

  it("filters recent form fixtures per team", () => {
    const rows = recentFormPerspectives(
      [
        perspective({ fixtureId: "f1", kickoffAt: new Date("2026-06-01T15:00:00.000Z") }),
        perspective({ fixtureId: "f2", kickoffAt: new Date("2026-06-10T15:00:00.000Z") }),
        perspective({
          fixtureId: "f3",
          teamId: "t2",
          teamName: "Exeter Chiefs",
          kickoffAt: new Date("2026-06-12T15:00:00.000Z"),
        }),
      ],
      1,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.fixtureId).sort()).toEqual(["f2", "f3"]);
  });

  it("filters home perspectives only", () => {
    const rows = filterBySide(
      [perspective({ side: "home" }), perspective({ fixtureId: "f2", side: "away" })],
      "home",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.side).toBe("home");
  });
});
