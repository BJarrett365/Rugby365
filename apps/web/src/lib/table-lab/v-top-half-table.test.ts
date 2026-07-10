import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import { buildLeagueStandingsFromPerspectives } from "./rugby-table-metrics-service";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";
import {
  buildVTopHalfTableStandings,
  formatTopHalfRankRange,
  isOpponentInTopHalf,
  isSeasonIncompleteFromStandings,
  parseOppositionPositionRule,
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
  const teams = [
    { id: "t1", name: "Alpha" },
    { id: "t2", name: "Bravo" },
    { id: "t3", name: "Charlie" },
    { id: "t4", name: "Delta" },
    { id: "t5", name: "Echo" },
    { id: "t6", name: "Foxtrot" },
    { id: "t7", name: "Golf" },
    { id: "t8", name: "Hotel" },
    { id: "t9", name: "India" },
    { id: "t10", name: "Juliet" },
  ];

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

describe("table v top half", () => {
  it("maps type=table-v-top-half route param to v_top_half id", () => {
    expect(tableIdFromTypeParam("table-v-top-half")).toBe("v_top_half");
    expect(tableIdFromTypeParam("v-top-half")).toBe("v_top_half");
  });

  it("uses ceil(n/2) for even and odd team counts", () => {
    expect(topHalfCutoff(10)).toBe(5);
    expect(topHalfCutoff(11)).toBe(6);
    expect(formatTopHalfRankRange(5)).toBe("1st–5th");
    expect(formatTopHalfRankRange(6)).toBe("1st–6th");
  });

  it("parses opposition position rule params", () => {
    expect(parseOppositionPositionRule(null)).toBe("current_position");
    expect(parseOppositionPositionRule("at_match")).toBe("position_at_match");
    expect(parseOppositionPositionRule("final")).toBe("final_season_position");
  });

  it("includes only matches against current top-half opponents", () => {
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

    const built = buildVTopHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    const worcester = built.rows.find((row) => row.teamName === "Worcester");

    expect(built.topHalfCutoff).toBe(2);
    expect(bath?.played).toBe(1);
    expect(worcester?.played).toBe(2);
    expect(built.filterSummary).toContain("1st–2nd");
  });

  it("uses one shared top-half group for every team row", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = miniLeaguePerspectives();
    const referenceRows = buildLeagueStandingsFromPerspectives(fixtures, rules);
    const cutoff = topHalfCutoff(referenceRows.length);
    const topHalfTeamIds = topHalfTeamIdsFromStandings(referenceRows, cutoff);

    const built = buildVTopHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
    });

    for (const row of built.rows) {
      const teamFixtures = built.scoringPerspectives.filter((item) => item.teamId === row.teamId);
      expect(teamFixtures.every((item) => topHalfTeamIds.has(item.opponentId))).toBe(true);
    }
  });

  it("filters home and away views separately", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        side: "home",
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
        opponentId: "t2",
        opponentName: "Saracens",
        side: "away",
        pointsFor: 20,
        pointsAgainst: 18,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "home",
        pointsFor: 18,
        pointsAgainst: 20,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Worcester",
        side: "home",
        pointsFor: 40,
        pointsAgainst: 0,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 0,
        pointsAgainst: 40,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
    ];

    const home = buildVTopHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
      oppositionPositionRule: "current_position",
    });
    const away = buildVTopHalfTableStandings({
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
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
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
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 25,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t2",
        opponentName: "Saracens",
        side: "away",
        pointsFor: 10,
        pointsAgainst: 25,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        pointsFor: 20,
        pointsAgainst: 18,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        pointsFor: 18,
        pointsAgainst: 20,
      }),
    ];

    const referenceRows = buildLeagueStandingsFromPerspectives(fixtures, rules);
    const cutoff = topHalfCutoff(referenceRows.length);
    const topHalfTeamIds = topHalfTeamIdsFromStandings(referenceRows, cutoff);
    const lateMatch = fixtures.find((row) => row.fixtureId === "f3" && row.teamId === "t1")!;

    const includedAtMatch = isOpponentInTopHalf({
      perspective: lateMatch,
      rule: "position_at_match",
      topHalfCutoff: cutoff,
      topHalfTeamIds,
      referencePerspectives: fixtures,
      rules,
    });

    expect(includedAtMatch).toBe(true);

    const earlyMatch = fixtures.find((row) => row.fixtureId === "f1" && row.teamId === "t1")!;
    expect(
      isOpponentInTopHalf({
        perspective: earlyMatch,
        rule: "position_at_match",
        topHalfCutoff: cutoff,
        topHalfTeamIds,
        referencePerspectives: fixtures,
        rules,
      }),
    ).toBe(false);

    const built = buildVTopHalfTableStandings({
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

    const referenceRows = buildLeagueStandingsFromPerspectives(fixtures, rules);
    expect(isSeasonIncompleteFromStandings(referenceRows)).toBe(true);

    const built = buildVTopHalfTableStandings({
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
        opponentId: "t2",
        opponentName: "Saracens",
        triesFor: null,
        triesAgainst: null,
        pointsFor: 20,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
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
        opponentId: "t3",
        opponentName: "Worcester",
        pointsFor: 25,
        pointsAgainst: 15,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Worcester",
        opponentId: "t2",
        opponentName: "Saracens",
        side: "away",
        pointsFor: 15,
        pointsAgainst: 25,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const built = buildVTopHalfTableStandings({
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
    expect(sorted[0]?.rank).toBe(1);
  });

  it("applies minimum matches played after top-half filtering", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = miniLeaguePerspectives();
    const built = buildVTopHalfTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      oppositionPositionRule: "current_position",
      minMatchesPlayed: 3,
    });

    expect(built.rows.every((row) => row.played >= 3)).toBe(true);
  });
});
