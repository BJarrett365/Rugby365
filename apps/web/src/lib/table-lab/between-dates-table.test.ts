import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildBetweenDatesTableStandings,
  betweenDatesCalculationNote,
  filterByCompletedDateRange,
  parseDateOnlyParam,
  validateBetweenDatesRange,
} from "./between-dates-table-service";
import { leagueTableOptionalColumns } from "./table-lab-column-utils";
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
    triesFor: null,
    triesAgainst: null,
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

describe("table between two dates", () => {
  it("maps type=table-between-dates route param to between_dates id", () => {
    expect(tableIdFromTypeParam("table-between-dates")).toBe("between_dates");
  });

  it("includes start and end dates and excludes matches outside the range", () => {
    const fixtures = [
      perspective({ fixtureId: "f0", kickoffAt: new Date("2025-12-31T15:00:00.000Z") }),
      perspective({ fixtureId: "f1", kickoffAt: new Date("2026-01-01T12:00:00.000Z") }),
      perspective({ fixtureId: "f2", kickoffAt: new Date("2026-03-31T15:00:00.000Z") }),
      perspective({ fixtureId: "f3", kickoffAt: new Date("2026-04-01T15:00:00.000Z") }),
    ];
    const filtered = filterByCompletedDateRange(fixtures, "2026-01-01", "2026-03-31");
    expect(filtered.map((row) => row.fixtureId)).toEqual(["f1", "f2"]);
  });

  it("rejects invalid date ranges", () => {
    expect(validateBetweenDatesRange("2026-03-01", "2026-01-01").valid).toBe(false);
    const built = buildBetweenDatesTableStandings({
      perspectives: [],
      rules: scoringRulesForCompetitionSlug("premiership"),
      startDate: "2026-03-01",
      endDate: "2026-01-01",
      tableView: "all",
    });
    expect(built.rangeValid).toBe(false);
    expect(built.rows).toEqual([]);
  });

  it("builds a table within one season", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        seasonStartYear: 2025,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        seasonStartYear: 2025,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        kickoffAt: new Date("2026-02-10T15:00:00.000Z"),
        seasonStartYear: 2025,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        kickoffAt: new Date("2026-02-10T15:00:00.000Z"),
        seasonStartYear: 2025,
      }),
    ];

    const built = buildBetweenDatesTableStandings({
      perspectives: fixtures,
      rules,
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      tableView: "all",
    });

    expect(built.matchCount).toBe(2);
    expect(built.seasonsIncludedLabel).toBe("2025–26");
    expect(built.rows.find((row) => row.teamName === "Bath")?.played).toBe(2);
  });

  it("supports ranges crossing seasons and calendar years", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2025-12-15T15:00:00.000Z"),
        seasonStartYear: 2025,
        teamId: "t1",
        teamName: "Bath",
        side: "home",
      }),
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2025-12-15T15:00:00.000Z"),
        seasonStartYear: 2025,
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        seasonStartYear: 2025,
        teamId: "t1",
        teamName: "Bath",
        side: "home",
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        seasonStartYear: 2025,
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "away",
      }),
    ];

    const built = buildBetweenDatesTableStandings({
      perspectives: fixtures,
      rules,
      startDate: "2025-12-01",
      endDate: "2026-02-28",
      tableView: "all",
    });

    expect(built.matchCount).toBe(2);
    expect(built.seasonsIncludedLabel).toBe("2025–26");
    expect(betweenDatesCalculationNote("2026-01-01", "2026-03-31")).toMatch(
      /1 January 2026 and 31 March 2026/,
    );
  });

  it("supports home and away views", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        kickoffAt: new Date("2026-01-20T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        kickoffAt: new Date("2026-01-20T15:00:00.000Z"),
      }),
    ];

    const home = buildBetweenDatesTableStandings({
      perspectives: fixtures,
      rules,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      tableView: "home",
    });
    const away = buildBetweenDatesTableStandings({
      perspectives: fixtures,
      rules,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      tableView: "away",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(home.rows.find((row) => row.teamName === "Saracens")).toBeUndefined();
    expect(away.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(away.rows.find((row) => row.teamName === "Exeter Chiefs")).toBeUndefined();
  });

  it("hides enhanced try columns when try data is missing", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home" }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away" }),
    ];
    const built = buildBetweenDatesTableStandings({
      perspectives: fixtures,
      rules,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      tableView: "all",
    });
    expect(leagueTableOptionalColumns(built.rows).showTfTa).toBe(false);
    expect(built.rows[0]?.triesFor).toBeNull();
  });

  it("sorts by league points", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        kickoffAt: new Date("2026-01-05T15:00:00.000Z"),
        pointsFor: 30,
        pointsAgainst: 10,
        triesFor: 4,
        triesAgainst: 1,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        kickoffAt: new Date("2026-01-05T15:00:00.000Z"),
        pointsFor: 10,
        pointsAgainst: 30,
        triesFor: 1,
        triesAgainst: 4,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        kickoffAt: new Date("2026-01-12T15:00:00.000Z"),
        pointsFor: 24,
        pointsAgainst: 17,
        triesFor: 3,
        triesAgainst: 2,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "away",
        kickoffAt: new Date("2026-01-12T15:00:00.000Z"),
        pointsFor: 17,
        pointsAgainst: 24,
        triesFor: 2,
        triesAgainst: 3,
      }),
    ];

    const built = buildBetweenDatesTableStandings({
      perspectives: fixtures,
      rules,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      tableView: "all",
    });

    expect(built.rows[0]?.teamName).toBe("Bath");
    expect(parseDateOnlyParam("2026-01-07", "2026-01-01")).toBe("2026-01-07");
  });
});
