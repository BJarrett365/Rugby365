import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildCalendarYearTableStandings,
  calendarYearCalculationNote,
  parseCalendarYear,
  seasonsIncludedFromPerspectives,
} from "./calendar-year-table-service";
import { filterByCalendarYear } from "./rugby-table-metrics-service";
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

describe("calendar year table", () => {
  it("maps type=calendar-year-table route param to calendar_year id", () => {
    expect(tableIdFromTypeParam("calendar-year-table")).toBe("calendar_year");
  });

  it("defaults invalid calendar year to the current year", () => {
    const current = new Date().getFullYear();
    expect(parseCalendarYear(undefined)).toBe(current);
    expect(parseCalendarYear("not-a-year")).toBe(current);
  });

  it("filters fixtures to a single calendar year inclusive", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", kickoffAt: new Date("2025-12-31T23:00:00.000Z") }),
      perspective({ fixtureId: "f2", kickoffAt: new Date("2026-01-15T15:00:00.000Z") }),
      perspective({ fixtureId: "f3", kickoffAt: new Date("2026-12-31T12:00:00.000Z") }),
      perspective({ fixtureId: "f4", kickoffAt: new Date("2027-01-01T00:00:00.000Z") }),
    ];
    const filtered = filterByCalendarYear(fixtures, 2026);
    expect(filtered.map((row) => row.fixtureId)).toEqual(["f2", "f3"]);
  });

  it("includes matches from two rugby seasons when the calendar year crosses seasons", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        seasonStartYear: 2025,
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 20,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        seasonStartYear: 2025,
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 20,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-09-01T15:00:00.000Z"),
        seasonStartYear: 2026,
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        pointsFor: 15,
        pointsAgainst: 18,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-09-01T15:00:00.000Z"),
        seasonStartYear: 2026,
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        pointsFor: 18,
        pointsAgainst: 15,
      }),
    ];

    const built = buildCalendarYearTableStandings({
      perspectives: fixtures,
      rules,
      calendarYear: 2026,
      tableView: "all",
    });

    expect(built.matchCount).toBe(2);
    expect(built.seasonsIncludedLabel).toBe("2025–26, 2026–27");
    expect(built.rows.find((row) => row.teamName === "Bath")?.played).toBe(2);
  });

  it("supports home and away views", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        pointsFor: 12,
        pointsAgainst: 20,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        pointsFor: 20,
        pointsAgainst: 12,
      }),
    ];

    const home = buildCalendarYearTableStandings({
      perspectives: fixtures,
      rules,
      calendarYear: 2026,
      tableView: "home",
    });
    const away = buildCalendarYearTableStandings({
      perspectives: fixtures,
      rules,
      calendarYear: 2026,
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
    const built = buildCalendarYearTableStandings({
      perspectives: fixtures,
      rules,
      calendarYear: 2026,
      tableView: "all",
    });
    const optional = leagueTableOptionalColumns(built.rows);
    expect(optional.showTfTa).toBe(false);
    expect(optional.showTbp).toBe(false);
    expect(built.rows[0]?.triesFor).toBeNull();
  });

  it("shows enhanced columns when try data exists", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        triesFor: 4,
        triesAgainst: 2,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        triesFor: 2,
        triesAgainst: 4,
      }),
    ];
    const built = buildCalendarYearTableStandings({
      perspectives: fixtures,
      rules,
      calendarYear: 2026,
      tableView: "all",
    });
    const optional = leagueTableOptionalColumns(built.rows);
    expect(optional.showTfTa).toBe(true);
    expect(built.rows[0]?.triesFor).toBe(4);
  });

  it("sorts by league points, wins, points difference, points for, tries for, team name", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 24,
        pointsAgainst: 17,
        triesFor: 3,
        triesAgainst: 2,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 17,
        pointsAgainst: 24,
        triesFor: 2,
        triesAgainst: 3,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 30,
        pointsAgainst: 10,
        triesFor: 4,
        triesAgainst: 1,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
        triesFor: 1,
        triesAgainst: 4,
      }),
    ];

    const built = buildCalendarYearTableStandings({
      perspectives: fixtures,
      rules,
      calendarYear: 2026,
      tableView: "all",
    });

    expect(built.rows[0]?.teamName).toBe("Bath");
    expect(built.rows[0]?.rank).toBe(1);
    expect(built.rows[1]?.teamName).toBe("Saracens");
  });

  it("builds season labels and calculation note for the UI", () => {
    const label = seasonsIncludedFromPerspectives([
      perspective({ seasonStartYear: 2024 }),
      perspective({ seasonStartYear: 2025 }),
    ]);
    expect(label).toBe("2024–25, 2025–26");
    expect(calendarYearCalculationNote(2026)).toBe(
      "This table uses matches played between 1 January 2026 and 31 December 2026.",
    );
  });
});
