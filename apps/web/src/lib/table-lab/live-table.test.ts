import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildLiveTableStandings,
  formatMovementLabel,
  isLiveFixtureStatus,
  isScheduledFixtureStatus,
  liveResultFromScores,
  liveTableCalculationNote,
  movementFromRanks,
  parseLiveTableBoolean,
} from "./live-table-service";
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

describe("live table", () => {
  const rules = scoringRulesForCompetitionSlug("premiership");

  it("maps type=live-table route param to live_table id", () => {
    expect(tableIdFromTypeParam("live-table")).toBe("live_table");
  });

  it("parses live table boolean filters with defaults", () => {
    expect(parseLiveTableBoolean(null, true)).toBe(true);
    expect(parseLiveTableBoolean("no", true)).toBe(false);
    expect(parseLiveTableBoolean("yes", false)).toBe(true);
  });

  it("treats kick-off 0–0 as a draw for live scoring", () => {
    expect(liveResultFromScores(0, 0)).toBe("drawn");
  });

  it("treats home lead as a live win for the home team", () => {
    expect(liveResultFromScores(7, 0)).toBe("won");
    expect(liveResultFromScores(0, 7)).toBe("lost");
  });

  it("treats away lead as a live win for the away team", () => {
    expect(liveResultFromScores(10, 13)).toBe("lost");
    expect(liveResultFromScores(13, 10)).toBe("won");
  });

  it("returns to draw when scores level during live play", () => {
    expect(liveResultFromScores(10, 10)).toBe("drawn");
  });

  it("includes live matches in standings and completed matches use final scores", () => {
    const fixtures = [
      perspective({
        fixtureId: "done",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 30,
        pointsAgainst: 10,
        isLive: false,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "done",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
        isLive: false,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "live",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 0,
        pointsAgainst: 0,
        isLive: true,
        countsTowardStandings: true,
        fixtureStatus: "live",
        matchClockLabel: "Live",
      }),
      perspective({
        fixtureId: "live",
        teamId: "t3",
        teamName: "Harlequins",
        side: "away",
        pointsFor: 0,
        pointsAgainst: 0,
        isLive: true,
        countsTowardStandings: true,
        fixtureStatus: "live",
        matchClockLabel: "Live",
      }),
    ];

    const built = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: true,
    });

    const bath = built.rows.find((row) => row.teamId === "t1");
    expect(bath?.played).toBe(2);
    expect(bath?.drawn).toBe(1);
    expect(built.liveFixtureCount).toBe(1);
    expect(built.preMatchRows.find((row) => row.teamId === "t1")?.played).toBe(1);
  });

  it("ignores scheduled fixtures for standings", () => {
    const fixtures = [
      perspective({
        fixtureId: "sched",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 0,
        pointsAgainst: 0,
        isScheduled: true,
        countsTowardStandings: false,
      }),
      perspective({
        fixtureId: "sched",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 0,
        pointsAgainst: 0,
        isScheduled: true,
        countsTowardStandings: false,
      }),
    ];

    const built = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: false,
    });

    expect(built.rows).toEqual([]);
    expect(built.scheduledFixtureCount).toBe(1);
  });

  it("only applies live bonus points when try data exists", () => {
    const fixtures = [
      perspective({
        fixtureId: "live",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 28,
        pointsAgainst: 24,
        triesFor: 4,
        triesAgainst: 3,
        isLive: true,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "live",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 24,
        pointsAgainst: 28,
        triesFor: 2,
        triesAgainst: 4,
        isLive: true,
        countsTowardStandings: true,
      }),
    ];

    const withTries = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: false,
    });
    const bathWithTries = withTries.rows.find((row) => row.teamId === "t1");
    expect(bathWithTries?.tryBonusPoints).toBe(1);

    const withoutTries = buildLiveTableStandings({
      perspectives: fixtures.map((row) => ({ ...row, triesFor: null, triesAgainst: null })),
      rules,
      tableView: "all",
      showMovement: false,
    });
    const bathNoTries = withoutTries.rows.find((row) => row.teamId === "t1");
    expect(bathNoTries?.tryBonusPoints ?? 0).toBe(0);
    expect(bathNoTries?.losingBonusPoints ?? 0).toBe(0);
  });

  it("attaches last-five form sequence newest-first", () => {
    const fixtures = [
      perspective({
        fixtureId: "m1",
        kickoffAt: new Date("2026-01-01T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 20,
        pointsAgainst: 10,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "m1",
        kickoffAt: new Date("2026-01-01T15:00:00.000Z"),
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 20,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "m2",
        kickoffAt: new Date("2026-01-08T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        pointsFor: 7,
        pointsAgainst: 14,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "m2",
        kickoffAt: new Date("2026-01-08T15:00:00.000Z"),
        teamId: "t2",
        teamName: "Saracens",
        side: "home",
        pointsFor: 14,
        pointsAgainst: 7,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "m3",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 15,
        pointsAgainst: 15,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "m3",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 15,
        pointsAgainst: 15,
        countsTowardStandings: true,
      }),
    ];

    const { rows } = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: false,
    });
    const bath = rows.find((row) => row.teamId === "t1");
    expect(bath?.formSequence).toEqual(["D", "L", "W"]);
  });

  it("shows movement compared with the pre-match table", () => {
    expect(movementFromRanks(3, 5)).toBe("up");
    expect(movementFromRanks(7, 6)).toBe("down");
    expect(movementFromRanks(4, 4)).toBe("same");
    expect(formatMovementLabel(3, 5, "up")).toBe("3rd ↑ from 5th");
    expect(formatMovementLabel(4, 4, "same")).toBe("4th —");
  });

  it("filters home and away views", () => {
    const fixtures = [
      perspective({
        fixtureId: "h",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 20,
        pointsAgainst: 10,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "h",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 20,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "a",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        pointsFor: 15,
        pointsAgainst: 12,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "a",
        teamId: "t3",
        teamName: "Harlequins",
        side: "home",
        pointsFor: 12,
        pointsAgainst: 15,
        countsTowardStandings: true,
      }),
    ];

    const home = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "home",
      showMovement: false,
    });
    const bathHome = home.rows.find((row) => row.teamId === "t1");
    expect(bathHome?.played).toBe(1);

    const away = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "away",
      showMovement: false,
    });
    const bathAway = away.rows.find((row) => row.teamId === "t1");
    expect(bathAway?.played).toBe(1);
  });

  it("sorts by league points then tie-breakers", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 24,
        pointsAgainst: 17,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 17,
        pointsAgainst: 24,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Harlequins",
        side: "home",
        pointsFor: 31,
        pointsAgainst: 14,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t4",
        teamName: "Gloucester",
        side: "away",
        pointsFor: 14,
        pointsAgainst: 31,
        countsTowardStandings: true,
      }),
    ];

    const built = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: false,
    });
    expect(built.rows.map((row) => row.teamName)).toEqual([
      "Harlequins",
      "Bath",
      "Saracens",
      "Gloucester",
    ]);
  });

  it("does not duplicate team rows when standings are rebuilt", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        pointsFor: 24,
        pointsAgainst: 17,
        countsTowardStandings: true,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        pointsFor: 17,
        pointsAgainst: 24,
        countsTowardStandings: true,
      }),
    ];

    const first = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: true,
    });
    const second = buildLiveTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
      showMovement: true,
    });
    expect(first.rows.length).toBe(second.rows.length);
    expect(new Set(first.rows.map((row) => row.teamId)).size).toBe(first.rows.length);
  });

  it("recognises live and scheduled fixture statuses", () => {
    expect(isLiveFixtureStatus("live")).toBe(true);
    expect(isLiveFixtureStatus("first_half")).toBe(true);
    expect(isScheduledFixtureStatus("scheduled")).toBe(true);
    expect(isLiveFixtureStatus("postponed")).toBe(false);
  });

  it("exposes calculation note text", () => {
    expect(liveTableCalculationNote()).toContain("completed matches");
  });

  it("shows enhanced columns only when try data exists", () => {
    const withTries = buildLiveTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          side: "home",
          pointsFor: 24,
          pointsAgainst: 17,
          triesFor: 3,
          triesAgainst: 2,
          countsTowardStandings: true,
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
          countsTowardStandings: true,
        }),
      ],
      rules,
      tableView: "all",
      showMovement: false,
    });
    expect(leagueTableOptionalColumns(withTries.rows).showTfTa).toBe(true);
  });
});
