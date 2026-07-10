import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildOnThisDateTableStandings,
  endOfDateUtc,
  filterByCompletedOnOrBefore,
  formatAsOfDateLabel,
  parseAsOfDateParam,
  resolveScoringRulesForSeasonTable,
  shiftDateOnly,
  tableOnDateCalculationNote,
} from "./on-this-date-table-service";
import {
  deductionsForTeamSeasonAsOf,
  scoringRulesForPremiershipSeason,
} from "./premiership-season-scoring";
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

describe("table on this date", () => {
  it("maps type=table-on-this-date route param to on_this_date id", () => {
    expect(tableIdFromTypeParam("table-on-this-date")).toBe("on_this_date");
  });

  it("parses and shifts as-of dates", () => {
    expect(parseAsOfDateParam("2026-01-07")).toBe("2026-01-07");
    expect(shiftDateOnly("2026-01-07", 1)).toBe("2026-01-08");
    expect(formatAsOfDateLabel("2026-01-07")).toBe("7 January 2026");
    expect(tableOnDateCalculationNote("2026-01-07")).toMatch(/7 January 2026/);
  });

  it("excludes matches completed after the selected date", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", kickoffAt: new Date("2026-01-05T15:00:00.000Z") }),
      perspective({ fixtureId: "f2", kickoffAt: new Date("2026-01-10T15:00:00.000Z") }),
      perspective({ fixtureId: "f3", kickoffAt: new Date("2026-01-15T15:00:00.000Z") }),
    ];
    const filtered = filterByCompletedOnOrBefore(fixtures, endOfDateUtc("2026-01-10"));
    expect(filtered.map((row) => row.fixtureId)).toEqual(["f1", "f2"]);
  });

  it("includes a match completed on the selected date", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        kickoffAt: new Date("2026-01-07T17:30:00.000Z"),
        pointsFor: 31,
        pointsAgainst: 24,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        kickoffAt: new Date("2026-01-07T17:30:00.000Z"),
        pointsFor: 24,
        pointsAgainst: 31,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        kickoffAt: new Date("2026-01-20T15:00:00.000Z"),
        pointsFor: 10,
        pointsAgainst: 20,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        kickoffAt: new Date("2026-01-20T15:00:00.000Z"),
        pointsFor: 20,
        pointsAgainst: 10,
      }),
    ];

    const built = buildOnThisDateTableStandings({
      perspectives: fixtures,
      rules,
      asOfDateOnly: "2026-01-07",
      tableView: "all",
    });

    expect(built.matchCount).toBe(1);
    expect(built.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(built.rows.find((row) => row.teamName === "Exeter Chiefs")).toBeUndefined();
    expect(built.tableStatus).toBe("calculated");
  });

  it("supports home and away views", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        kickoffAt: new Date("2026-01-07T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        kickoffAt: new Date("2026-01-07T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        kickoffAt: new Date("2026-01-14T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        kickoffAt: new Date("2026-01-14T15:00:00.000Z"),
      }),
    ];

    const home = buildOnThisDateTableStandings({
      perspectives: fixtures,
      rules,
      asOfDateOnly: "2026-01-31",
      tableView: "home",
    });
    const away = buildOnThisDateTableStandings({
      perspectives: fixtures,
      rules,
      asOfDateOnly: "2026-01-31",
      tableView: "away",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(home.rows.find((row) => row.teamName === "Saracens")).toBeUndefined();
    expect(home.rows.find((row) => row.teamName === "Exeter Chiefs")?.played).toBe(1);
    expect(away.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(away.rows.find((row) => row.teamName === "Exeter Chiefs")).toBeUndefined();
  });

  it("hides enhanced try columns when try data is missing", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home" }),
      perspective({ fixtureId: "f1", teamId: "t2", teamName: "Saracens", side: "away" }),
    ];
    const built = buildOnThisDateTableStandings({
      perspectives: fixtures,
      rules,
      asOfDateOnly: "2026-12-31",
      tableView: "all",
    });
    const optional = leagueTableOptionalColumns(built.rows);
    expect(optional.showTfTa).toBe(false);
    expect(built.rows[0]?.triesFor).toBeNull();
  });

  it("uses historic Premiership scoring rules for older seasons", () => {
    const rules2000 = resolveScoringRulesForSeasonTable({
      competitionSlug: "premiership",
      seasonStartYear: 2000,
    });
    expect(rules2000.tryBonusPoints).toBe(0);
    expect(scoringRulesForPremiershipSeason(2000).winPoints).toBe(4);
    expect(scoringRulesForPremiershipSeason(1996).winPoints).toBe(2);
  });

  it("applies Premiership deductions only after the configured effective date", () => {
    const before = deductionsForTeamSeasonAsOf(
      "saracens",
      2019,
      endOfDateUtc("2019-10-01"),
    );
    const after = deductionsForTeamSeasonAsOf(
      "saracens",
      2019,
      endOfDateUtc("2019-12-01"),
    );
    expect(before.points).toBe(0);
    expect(after.points).toBe(105);
  });

  it("applies deductions in the built table and re-ranks", () => {
    const rules = scoringRulesForPremiershipSeason(2019);
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Saracens",
        side: "home",
        kickoffAt: new Date("2019-12-15T15:00:00.000Z"),
        pointsFor: 30,
        pointsAgainst: 10,
        triesFor: 4,
        triesAgainst: 1,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Bath",
        side: "away",
        kickoffAt: new Date("2019-12-15T15:00:00.000Z"),
        pointsFor: 10,
        pointsAgainst: 30,
        triesFor: 1,
        triesAgainst: 4,
      }),
    ];

    const built = buildOnThisDateTableStandings({
      perspectives: fixtures,
      rules,
      asOfDateOnly: "2019-12-31",
      tableView: "all",
      seasonStartYear: 2019,
      applyPremiershipDeductions: true,
    });

    const saracens = built.rows.find((row) => row.teamName === "Saracens");
    expect(saracens?.leaguePoints).toBe(0);
    expect(saracens?.extra?.pointsDeducted).toBe(105);
  });

  it("sorts by league points then wins", () => {
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

    const built = buildOnThisDateTableStandings({
      perspectives: fixtures,
      rules,
      asOfDateOnly: "2026-01-31",
      tableView: "all",
    });

    expect(built.rows[0]?.teamName).toBe("Bath");
    expect(built.rows[0]?.rank).toBe(1);
  });
});
