import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import { resolveFixtureLosingPositionState } from "./losing-position-utils";
import {
  buildPointsLostWinningTableStandings,
  pointsLostFromWinningPosition,
  sortPointsLostWinningRows,
} from "./points-lost-winning-table-service";
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
    firstHalfFor: 10,
    firstHalfAgainst: 7,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: true,
    concededFirst: false,
    everLeading: true,
    aheadAtHalfTime: true,
    aheadAfterSixty: true,
    scoreTimelineVerified: true,
    halfTimeScoreVerified: true,
    sixtyMinuteScoreVerified: true,
    minuteFirstAhead: 8,
    maxLeadMargin: 7,
    latestLeadLostMinute: null,
    wasWinning: true,
    wasLosing: false,
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

describe("points lost from winning positions", () => {
  it("maps route param to points_lost_winning id", () => {
    expect(tableIdFromTypeParam("points-lost-from-winning-positions")).toBe("points_lost_winning");
  });

  it("detects leading after opening score", () => {
    const state = resolveFixtureLosingPositionState({
      homeTeamId: "home",
      awayTeamId: "away",
      events: [{ eventType: "penalty", teamId: "home", minute: 5, payload: { points: 3 } }],
    });

    expect(state.homeEverLeading).toBe(true);
    expect(state.homeMinuteFirstAhead).toBe(5);
  });

  it("calculates points lost without inventing an expected try bonus", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    expect(
      pointsLostFromWinningPosition(31, 24, 4, rules),
    ).toBe(0);
    expect(
      pointsLostFromWinningPosition(17, 17, 2, rules),
    ).toBe(2);
    expect(
      pointsLostFromWinningPosition(17, 24, 2, rules),
    ).toBe(3);
    expect(
      pointsLostFromWinningPosition(10, 24, 1, rules),
    ).toBe(4);
  });

  it("counts draw and loss points lost separately", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const drawOnly = buildPointsLostWinningTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f2",
          pointsFor: 17,
          pointsAgainst: 17,
          triesFor: 2,
          wasDrawn: true,
        }),
      ],
      rules,
      tableView: "all",
    });
    expect(drawOnly.rows[0]?.extra?.pointsLost).toBe(2);
  });

  it("aggregates points lost and lead protection metrics", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildPointsLostWinningTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          pointsFor: 24,
          pointsAgainst: 17,
        }),
        perspective({
          fixtureId: "f2",
          teamId: "t1",
          teamName: "Bath",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          pointsFor: 17,
          pointsAgainst: 17,
          triesFor: 2,
          wasWinning: null,
          wasDrawn: true,
        }),
        perspective({
          fixtureId: "f3",
          teamId: "t1",
          teamName: "Bath",
          kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
          pointsFor: 17,
          pointsAgainst: 24,
          triesFor: 2,
          wasWinning: false,
          wasLosing: true,
          latestLeadLostMinute: 72,
          maxLeadMargin: 10,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(3);
    expect(bath?.won).toBe(1);
    expect(bath?.drawn).toBe(1);
    expect(bath?.lost).toBe(1);
    expect(bath?.extra?.pointsLost).toBe(5);
    expect(bath?.extra?.leadProtectionPct).toBeCloseTo(33.3, 1);
    expect(bath?.extra?.losingBonusRecovered).toBe(1);
    expect(bath?.extra?.largestLeadLost).toBe(10);
  });

  it("filters ahead at half-time and after 60 minutes", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        aheadAtHalfTime: true,
        aheadAfterSixty: false,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        aheadAtHalfTime: false,
        aheadAfterSixty: true,
      }),
    ];

    const halfTime = buildPointsLostWinningTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      winningPositionFilter: "half_time",
    });
    const afterSixty = buildPointsLostWinningTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      winningPositionFilter: "after_sixty",
    });

    expect(halfTime.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(afterSixty.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("supports home view and excludes missing timeline data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", teamId: "t1", teamName: "Bath", side: "home" }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        teamId: "t1",
        teamName: "Bath",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        everLeading: null,
        scoreTimelineVerified: false,
      }),
    ];

    const home = buildPointsLostWinningTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildPointsLostWinningTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(all.rows.find((row) => row.teamName === "Bath")?.played).toBe(2);
  });

  it("sorts by highest points lost by default", () => {
    const sorted = sortPointsLostWinningRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 2,
          won: 1,
          drawn: 0,
          lost: 1,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 3,
          extra: { pointsLost: 3, leadProtectionPct: 50 },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 2,
          won: 0,
          drawn: 0,
          lost: 2,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 7,
          extra: { pointsLost: 7, leadProtectionPct: 0 },
        },
      ],
      "points_lost",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
