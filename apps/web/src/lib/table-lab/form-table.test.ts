import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildFormTableStandings,
  flattenRecentFormMatches,
  formResultForPerspective,
  parseFormMatchCount,
  recentFormMatchesByTeam,
} from "./form-table-service";
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

describe("form table", () => {
  it("maps type=form-table route param to form_table id", () => {
    expect(tableIdFromTypeParam("form-table")).toBe("form_table");
  });

  it("parses custom match counts with bounds", () => {
    expect(parseFormMatchCount("7")).toBe(7);
    expect(parseFormMatchCount("0")).toBe(5);
    expect(parseFormMatchCount("99")).toBe(50);
  });

  it("selects last N matches per team for all, home and away views", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        kickoffAt: new Date("2026-01-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        kickoffAt: new Date("2026-01-08T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t1",
        side: "home",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f4",
        teamId: "t1",
        side: "away",
        kickoffAt: new Date("2026-01-22T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f5",
        teamId: "t1",
        side: "away",
        kickoffAt: new Date("2026-01-29T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f6",
        teamId: "t1",
        side: "home",
        kickoffAt: new Date("2026-02-05T15:00:00.000Z"),
      }),
    ];

    const all = flattenRecentFormMatches(recentFormMatchesByTeam(fixtures, 3, "all"));
    const away = flattenRecentFormMatches(recentFormMatchesByTeam(fixtures, 5, "away"));

    expect(all.map((row) => row.fixtureId)).toEqual(["f6", "f5", "f4"]);
    expect(away.map((row) => row.fixtureId)).toEqual(["f5", "f4", "f2"]);
    expect(away).toHaveLength(3);
  });

  it("does not take overall last N and then filter away — venue filter comes first", () => {
    const fixtures = [
      perspective({
        fixtureId: "f-home-recent",
        teamId: "t1",
        side: "home",
        kickoffAt: new Date("2026-06-20T15:00:00.000Z"),
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f-away-1",
        teamId: "t1",
        side: "away",
        kickoffAt: new Date("2026-06-10T15:00:00.000Z"),
        pointsFor: 10,
        pointsAgainst: 20,
      }),
      perspective({
        fixtureId: "f-away-2",
        teamId: "t1",
        side: "away",
        kickoffAt: new Date("2026-06-05T15:00:00.000Z"),
        pointsFor: 24,
        pointsAgainst: 17,
      }),
    ];

    const wrongOrder = flattenRecentFormMatches(
      recentFormMatchesByTeam(fixtures, 2, "all"),
    ).filter((row) => row.side === "away");
    const correct = flattenRecentFormMatches(recentFormMatchesByTeam(fixtures, 2, "away"));

    expect(wrongOrder.map((row) => row.fixtureId)).toEqual(["f-away-1"]);
    expect(correct.map((row) => row.fixtureId)).toEqual(["f-away-1", "f-away-2"]);
  });

  it("orders matches by kickoff then fixture id", () => {
    const sameKickoff = new Date("2026-03-01T15:00:00.000Z");
    const fixtures = [
      perspective({ fixtureId: "f-a", teamId: "t1", kickoffAt: sameKickoff }),
      perspective({ fixtureId: "f-z", teamId: "t1", kickoffAt: sameKickoff }),
      perspective({
        fixtureId: "f-m",
        teamId: "t1",
        kickoffAt: sameKickoff,
        pointsFor: 12,
        pointsAgainst: 12,
      }),
    ];

    const selected = recentFormMatchesByTeam(fixtures, 2, "all").get("t1") ?? [];
    expect(selected.map((row) => row.fixtureId)).toEqual(["f-z", "f-m"]);
  });

  it("builds form sequences with most recent result first", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        kickoffAt: new Date("2026-01-01T15:00:00.000Z"),
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        kickoffAt: new Date("2026-01-08T15:00:00.000Z"),
        pointsFor: 12,
        pointsAgainst: 12,
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t1",
        kickoffAt: new Date("2026-01-15T15:00:00.000Z"),
        pointsFor: 10,
        pointsAgainst: 20,
      }),
    ];

    const { rows } = buildFormTableStandings({
      perspectives: fixtures,
      matchCount: 3,
      tableView: "all",
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    expect(rows[0]?.formSequence).toEqual(["L", "D", "W"]);
    expect(formResultForPerspective(fixtures[2]!)).toBe("L");
  });

  it("supports last 3, 5, 10 and custom match counts", () => {
    const fixtures = Array.from({ length: 12 }, (_, index) =>
      perspective({
        fixtureId: `f${index + 1}`,
        teamId: "t1",
        kickoffAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T15:00:00.000Z`),
        pointsFor: 20,
        pointsAgainst: 10,
      }),
    );

    for (const count of [3, 5, 10, 7]) {
      const { rows } = buildFormTableStandings({
        perspectives: fixtures,
        matchCount: count,
        tableView: "all",
        rules: scoringRulesForCompetitionSlug("premiership"),
      });
      expect(rows[0]?.matchesUsed).toBe(Math.min(count, fixtures.length));
      expect(rows[0]?.matchesRequested).toBe(count);
    }
  });

  it("includes teams with fewer matches than requested", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", kickoffAt: new Date("2026-01-01T15:00:00.000Z") }),
      perspective({
        fixtureId: "f2",
        teamId: "t2",
        teamName: "Saracens",
        kickoffAt: new Date("2026-01-08T15:00:00.000Z"),
      }),
    ];

    const { rows } = buildFormTableStandings({
      perspectives: fixtures,
      matchCount: 5,
      tableView: "all",
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.matchesUsed).toBe(1);
      expect(row.matchesRequested).toBe(5);
      expect(row.played).toBe(1);
    }
  });

  it("applies competition-specific bonus points", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        pointsFor: 31,
        pointsAgainst: 28,
        triesFor: 4,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        pointsFor: 28,
        pointsAgainst: 31,
        triesFor: 3,
      }),
    ];

    const { rows } = buildFormTableStandings({
      perspectives: fixtures,
      matchCount: 1,
      tableView: "all",
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    const bath = rows.find((row) => row.teamName === "Bath");
    const saracens = rows.find((row) => row.teamName === "Saracens");
    expect(bath?.tryBonusPoints).toBe(1);
    expect(saracens?.losingBonusPoints).toBe(1);
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

    const { rows } = buildFormTableStandings({
      perspectives: fixtures,
      matchCount: 5,
      tableView: "all",
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    expect(rows[0]?.teamName).toBe("Bath");
    expect(rows[0]?.leaguePoints).toBeGreaterThan(rows[1]?.leaguePoints ?? 0);
  });

  it("returns a date range label from selected matches", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", kickoffAt: new Date("2026-01-01T15:00:00.000Z") }),
      perspective({ fixtureId: "f2", teamId: "t1", kickoffAt: new Date("2026-02-01T15:00:00.000Z") }),
      perspective({
        fixtureId: "f3",
        teamId: "t2",
        teamName: "Saracens",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
    ];

    const { dateRangeLabel } = buildFormTableStandings({
      perspectives: fixtures,
      matchCount: 2,
      tableView: "all",
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    expect(dateRangeLabel).toContain("–");
  });
});
