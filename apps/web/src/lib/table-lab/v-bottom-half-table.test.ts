import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import { buildLeagueStandingsFromPerspectives } from "./rugby-table-metrics-service";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";
import {
  bottomHalfTeamIdsFromStandings,
  buildVBottomHalfTableStandings,
  formatBottomHalfRankRange,
  isOpponentInBottomHalf,
  sortVTopHalfRows,
  topHalfCutoff,
  topHalfTeamIdsFromStandings,
} from "./v-top-half-table-service";

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

function miniLeaguePerspectives(): TeamFixturePerspective[] {
  const teams = Array.from({ length: 10 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
  }));

  const fixtures: TeamFixturePerspective[] = [];
  let fixtureIndex = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtureIndex += 1;
      const home = teams[i]!;
      const away = teams[j]!;
      const homeWins = i < j;
      fixtures.push(
        perspective({
          fixtureId: `f${fixtureIndex}`,
          kickoffAt: new Date(Date.UTC(2026, 0, fixtureIndex)),
          teamId: home.id,
          teamName: home.name,
          opponentId: away.id,
          opponentName: away.name,
          side: "home",
          pointsFor: homeWins ? 30 : 10,
          pointsAgainst: homeWins ? 10 : 30,
        }),
        perspective({
          fixtureId: `f${fixtureIndex}`,
          kickoffAt: new Date(Date.UTC(2026, 0, fixtureIndex)),
          teamId: away.id,
          teamName: away.name,
          opponentId: home.id,
          opponentName: home.name,
          side: "away",
          pointsFor: homeWins ? 10 : 30,
          pointsAgainst: homeWins ? 30 : 10,
        }),
      );
    }
  }
  return fixtures;
}

describe("table v bottom half", () => {
  it("maps type=table-v-bottom-half route param to v_bottom_half id", () => {
    expect(tableIdFromTypeParam("table-v-bottom-half")).toBe("v_bottom_half");
    expect(tableIdFromTypeParam("v-bottom-half")).toBe("v_bottom_half");
  });

  it("uses bottom-half ranks after the shared top-half split for even and odd team counts", () => {
    expect(formatBottomHalfRankRange(topHalfCutoff(10), 10)).toBe("6th–10th");
    expect(formatBottomHalfRankRange(topHalfCutoff(11), 11)).toBe("7th–11th");
    expect(formatBottomHalfRankRange(topHalfCutoff(12), 12)).toBe("7th–12th");
  });

  it("includes only matches against current bottom-half opponents", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 40,
        pointsAgainst: 0,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 0,
        pointsAgainst: 40,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 35,
        pointsAgainst: 14,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t2",
        opponentName: "Saracens",
        side: "away",
        pointsFor: 14,
        pointsAgainst: 35,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
    ];

    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    const saracens = built.rows.find((row) => row.teamName === "Saracens");

    expect(built.bottomHalfRankRangeLabel).toBe("3rd");
    expect(bath?.played).toBe(1);
    expect(saracens?.played).toBe(1);
    expect(built.filterSummary).toContain("3rd");
  });

  it("uses one shared bottom-half group for every team row", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = miniLeaguePerspectives();
    const referenceRows = buildLeagueStandingsFromPerspectives(fixtures, rules);
    const cutoff = topHalfCutoff(referenceRows.length);
    const bottomHalfTeamIds = bottomHalfTeamIdsFromStandings(referenceRows, cutoff);

    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
    });

    for (const row of built.rows) {
      const teamFixtures = built.scoringPerspectives.filter((item) => item.teamId === row.teamId);
      expect(teamFixtures.every((item) => bottomHalfTeamIds.has(item.opponentId))).toBe(true);
    }
  });

  it("filters home and away views separately", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        side: "home",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        side: "away",
        pointsFor: 20,
        pointsAgainst: 18,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "home",
        pointsFor: 18,
        pointsAgainst: 20,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "home",
        pointsFor: 30,
        pointsAgainst: 10,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
    ];

    const home = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
      oppositionPositionRule: "current_position",
    });
    const away = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
      oppositionPositionRule: "current_position",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(away.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(home.filterSummary).toContain("home");
    expect(away.filterSummary).toContain("away");
  });

  it("uses opponent rank immediately before kick-off for position at match", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 20,
        pointsAgainst: 18,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 18,
        pointsAgainst: 20,
      }),
    ];

    const referenceRows = buildLeagueStandingsFromPerspectives(fixtures, rules);
    const cutoff = topHalfCutoff(referenceRows.length);
    const bottomHalfTeamIds = bottomHalfTeamIdsFromStandings(referenceRows, cutoff);
    const lateMatch = fixtures.find((row) => row.fixtureId === "f3" && row.teamId === "t1")!;

    expect(
      isOpponentInBottomHalf({
        perspective: lateMatch,
        rule: "position_at_match",
        topHalfCutoff: cutoff,
        bottomHalfTeamIds,
        referencePerspectives: fixtures,
        rules,
      }),
    ).toBe(true);

    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "position_at_match",
    });

    expect(built.filterSummary).toContain("immediately before kick-off");
    expect(built.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("marks final season position as provisional when the season is incomplete", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 30,
        pointsAgainst: 10,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "final_season_position",
    });

    expect(built.provisionalFinalSeason).toBe(true);
    expect(built.filterSummary).toContain("provisionally ranked");
  });

  it("omits bonus columns when try data is missing", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        triesFor: null,
        triesAgainst: null,
        pointsFor: 20,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        triesFor: null,
        triesAgainst: null,
        pointsFor: 10,
        pointsAgainst: 20,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        pointsFor: 30,
        pointsAgainst: 10,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 30,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.triesFor == null).toBe(true);
    expect(bath?.tryBonusPoints == null).toBe(true);
    expect(bath?.leaguePoints).toBe(4);
  });

  it("sorts by table points, wins, points difference, points for, win %, then team name", () => {
    const sorted = sortVTopHalfRows([
      {
        rank: 0,
        teamId: "a",
        teamName: "Zulu",
        played: 2,
        won: 1,
        drawn: 0,
        lost: 1,
        pointsFor: 40,
        pointsAgainst: 30,
        pointsDiff: 10,
        bonusPoints: 0,
        leaguePoints: 4,
        winPct: 50,
      },
      {
        rank: 0,
        teamId: "b",
        teamName: "Alpha",
        played: 2,
        won: 1,
        drawn: 0,
        lost: 1,
        pointsFor: 45,
        pointsAgainst: 35,
        pointsDiff: 10,
        bonusPoints: 0,
        leaguePoints: 4,
        winPct: 50,
      },
      {
        rank: 0,
        teamId: "c",
        teamName: "Bravo",
        played: 2,
        won: 2,
        drawn: 0,
        lost: 0,
        pointsFor: 30,
        pointsAgainst: 10,
        pointsDiff: 20,
        bonusPoints: 0,
        leaguePoints: 8,
        winPct: 100,
      },
    ]);

    expect(sorted.map((row) => row.teamName)).toEqual(["Bravo", "Alpha", "Zulu"]);
  });

  it("applies minimum matches played after bottom-half filtering", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = miniLeaguePerspectives();
    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
      minMatchesPlayed: 3,
    });

    expect(built.rows.every((row) => row.played >= 3)).toBe(true);
  });

  it("does not overlap top-half and bottom-half groups for odd team counts", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const teams = Array.from({ length: 11 }, (_, index) => ({
      id: `t${index + 1}`,
      name: `Team ${index + 1}`,
    }));
    const fixtures: TeamFixturePerspective[] = [];
    let fixtureIndex = 0;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        fixtureIndex += 1;
        const home = teams[i]!;
        const away = teams[j]!;
        fixtures.push(
          perspective({
            fixtureId: `f${fixtureIndex}`,
            kickoffAt: new Date(Date.UTC(2026, 0, fixtureIndex)),
            teamId: home.id,
            teamName: home.name,
            opponentId: away.id,
            opponentName: away.name,
            side: "home",
            pointsFor: i < j ? 30 : 10,
            pointsAgainst: i < j ? 10 : 30,
          }),
          perspective({
            fixtureId: `f${fixtureIndex}`,
            kickoffAt: new Date(Date.UTC(2026, 0, fixtureIndex)),
            teamId: away.id,
            teamName: away.name,
            opponentId: home.id,
            opponentName: home.name,
            side: "away",
            pointsFor: i < j ? 10 : 30,
            pointsAgainst: i < j ? 30 : 10,
          }),
        );
      }
    }

    const referenceRows = buildLeagueStandingsFromPerspectives(fixtures, rules);
    const cutoff = topHalfCutoff(referenceRows.length);
    const topIds = topHalfTeamIdsFromStandings(referenceRows, cutoff);
    const bottomIds = bottomHalfTeamIdsFromStandings(referenceRows, cutoff);

    expect(cutoff).toBe(6);
    expect(topIds.size).toBe(6);
    expect(bottomIds.size).toBe(5);
    for (const id of topIds) {
      expect(bottomIds.has(id)).toBe(false);
    }
  });
});
