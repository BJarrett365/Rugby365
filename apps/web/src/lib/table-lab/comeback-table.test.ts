import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildComebackTableStandings,
  sortComebackRows,
} from "./comeback-table-service";
import { resolveFixtureLosingPositionState } from "./losing-position-utils";
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
    firstHalfFor: 7,
    firstHalfAgainst: 10,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: false,
    concededFirst: true,
    everTrailing: true,
    behindAtHalfTime: true,
    behindAfterSixty: false,
    scoreTimelineVerified: true,
    halfTimeScoreVerified: true,
    sixtyMinuteScoreVerified: true,
    minuteFirstBehind: 5,
    maxDeficitWhileTrailing: 10,
    minuteLastTookLead: 72,
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

describe("comeback table", () => {
  it("maps route param to comeback id", () => {
    expect(tableIdFromTypeParam("comeback-table")).toBe("comeback");
  });

  it("tracks largest deficit across multiple trailing phases", () => {
    const state = resolveFixtureLosingPositionState({
      homeTeamId: "home",
      awayTeamId: "away",
      events: [
        { eventType: "try", teamId: "away", minute: 5, payload: { points: 5 } },
        { eventType: "conversion", teamId: "away", minute: 6, payload: { points: 2 } },
        { eventType: "penalty", teamId: "away", minute: 7, payload: { points: 3 } },
        { eventType: "try", teamId: "home", minute: 30, payload: { points: 5 } },
        { eventType: "conversion", teamId: "home", minute: 31, payload: { points: 2 } },
        { eventType: "try", teamId: "away", minute: 50, payload: { points: 5 } },
        { eventType: "conversion", teamId: "away", minute: 51, payload: { points: 2 } },
        { eventType: "try", teamId: "home", minute: 70, payload: { points: 5 } },
        { eventType: "conversion", teamId: "home", minute: 71, payload: { points: 2 } },
        { eventType: "try", teamId: "home", minute: 72, payload: { points: 5 } },
        { eventType: "conversion", teamId: "home", minute: 73, payload: { points: 2 } },
      ],
    });

    expect(state.homeMaxDeficit).toBe(10);
    expect(state.homeMinuteLastTookLead).toBe(72);
  });

  it("counts comeback wins with competition table points", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildComebackTableStandings({
      seasonPerspectives: [
        perspective({
          pointsFor: 21,
          pointsAgainst: 17,
          triesFor: 3,
          maxDeficitWhileTrailing: 10,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(1);
    expect(bath?.won).toBe(1);
    expect(bath?.drawn).toBe(0);
    expect(bath?.lost).toBe(0);
    expect(bath?.extra?.totalSuccessfulComebacks).toBe(1);
    expect(bath?.extra?.comebackSuccessPct).toBe(100);
    expect(bath?.extra?.largestDeficitOvercome).toBe(10);
    expect(bath?.extra?.tablePointsGained).toBe(4);
    expect(bath?.extra?.latestWinningScoreMinute).toBe(72);
  });

  it("counts comeback draws separately from wins and losses", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildComebackTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          pointsFor: 17,
          pointsAgainst: 17,
          triesFor: 2,
          wasWinning: null,
          wasDrawn: true,
        }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          pointsFor: 17,
          pointsAgainst: 24,
          triesFor: 2,
          wasWinning: false,
          wasLosing: true,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(2);
    expect(bath?.won).toBe(0);
    expect(bath?.drawn).toBe(1);
    expect(bath?.lost).toBe(1);
    expect(bath?.extra?.totalSuccessfulComebacks).toBe(1);
    expect(bath?.extra?.comebackSuccessPct).toBe(50);
    expect(bath?.extra?.comebackDrawPct).toBe(50);
    expect(bath?.extra?.tablePointsGained).toBe(2);
  });

  it("applies minimum deficit filters", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        maxDeficitWhileTrailing: 3,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        maxDeficitWhileTrailing: 10,
      }),
    ];

    const sevenPlus = buildComebackTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      minimumDeficit: 7,
    });

    expect(sevenPlus.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("filters behind at half-time and after 60 minutes", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        behindAtHalfTime: true,
        behindAfterSixty: false,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        behindAtHalfTime: false,
        behindAfterSixty: true,
      }),
    ];

    const halfTime = buildComebackTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      comebackFrom: "half_time",
    });
    const afterSixty = buildComebackTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      comebackFrom: "after_sixty",
    });

    expect(halfTime.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(afterSixty.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("supports home and away views and excludes missing timeline data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        side: "home",
        scoreTimelineVerified: true,
      }),
      perspective({
        fixtureId: "f2",
        side: "away",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        everTrailing: null,
        scoreTimelineVerified: false,
      }),
    ];

    const home = buildComebackTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildComebackTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(all.rows.find((row) => row.teamName === "Bath")?.played).toBe(2);
  });

  it("tracks enhanced comeback tiers on successful recoveries only", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildComebackTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          maxDeficitWhileTrailing: 14,
          behindAtHalfTime: true,
          behindAfterSixty: true,
          pointsFor: 24,
          pointsAgainst: 21,
        }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          maxDeficitWhileTrailing: 10,
          behindAtHalfTime: true,
          pointsFor: 17,
          pointsAgainst: 24,
          wasWinning: false,
          wasLosing: true,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.extra?.comebacksFrom7Plus).toBe(1);
    expect(bath?.extra?.comebacksFrom10Plus).toBe(1);
    expect(bath?.extra?.comebacksFrom14Plus).toBe(1);
    expect(bath?.extra?.secondHalfComebacks).toBe(1);
    expect(bath?.extra?.finalTwentyComebacks).toBe(1);
  });

  it("sorts by comeback wins by default", () => {
    const sorted = sortComebackRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 2,
          won: 1,
          drawn: 1,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 6,
          extra: {
            totalSuccessfulComebacks: 2,
            comebackSuccessPct: 100,
            largestDeficitOvercome: 7,
            tablePointsGained: 6,
          },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 2,
          won: 2,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 8,
          extra: {
            totalSuccessfulComebacks: 2,
            comebackSuccessPct: 100,
            largestDeficitOvercome: 3,
            tablePointsGained: 8,
          },
        },
      ],
      "comeback_wins",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
    expect(sorted[1]?.teamName).toBe("Alpha");
  });
});
