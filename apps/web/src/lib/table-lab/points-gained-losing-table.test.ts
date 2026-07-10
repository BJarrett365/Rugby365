import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import { resolveFixtureLosingPositionState } from "./losing-position-utils";
import {
  buildPointsGainedLosingTableStandings,
  sortPointsGainedLosingRows,
} from "./points-gained-losing-table-service";
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
    minuteFirstBehind: 12,
    maxDeficitWhileTrailing: 7,
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

describe("losing position utils", () => {
  it("detects trailing after the opposition opens the scoring", () => {
    const state = resolveFixtureLosingPositionState({
      homeTeamId: "home",
      awayTeamId: "away",
      events: [
        { eventType: "penalty", teamId: "away", minute: 5, payload: { points: 3 } },
        { eventType: "try", teamId: "home", minute: 55, payload: { points: 5 } },
        { eventType: "conversion", teamId: "home", minute: 56, payload: { points: 2 } },
      ],
    });

    expect(state.scoreTimelineVerified).toBe(true);
    expect(state.homeEverTrailing).toBe(true);
    expect(state.homeMinuteFirstBehind).toBe(5);
    expect(state.homeMaxDeficit).toBe(3);
  });

  it("counts a match once even if the team falls behind several times", () => {
    const state = resolveFixtureLosingPositionState({
      homeTeamId: "home",
      awayTeamId: "away",
      events: [
        { eventType: "penalty", teamId: "away", minute: 5, payload: { points: 3 } },
        { eventType: "try", teamId: "home", minute: 20, payload: { points: 5 } },
        { eventType: "conversion", teamId: "home", minute: 21, payload: { points: 2 } },
        { eventType: "try", teamId: "away", minute: 40, payload: { points: 5 } },
        { eventType: "conversion", teamId: "away", minute: 41, payload: { points: 2 } },
      ],
    });

    expect(state.homeEverTrailing).toBe(true);
    expect(state.homeMaxDeficit).toBe(3);
  });
});

describe("points gained from losing positions", () => {
  it("maps route param to points_gained_losing id", () => {
    expect(tableIdFromTypeParam("points-gained-from-losing-positions")).toBe(
      "points_gained_losing",
    );
  });

  it("sums competition points after trailing and winning", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildPointsGainedLosingTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          pointsFor: 24,
          pointsAgainst: 17,
          triesFor: 4,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          teamName: "Exeter Chiefs",
          side: "away",
          everTrailing: false,
          pointsFor: 17,
          pointsAgainst: 24,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(1);
    expect(bath?.won).toBe(1);
    expect(bath?.leaguePoints).toBe(5);
    expect(bath?.extra?.pointsGained).toBe(5);
    expect(bath?.extra?.tryBonusPointsGained).toBe(1);
  });

  it("includes draws and losing-bonus recoveries", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildPointsGainedLosingTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          pointsFor: 17,
          pointsAgainst: 17,
          triesFor: 2,
          wasWinning: null,
          wasDrawn: true,
        }),
        perspective({
          fixtureId: "f2",
          teamId: "t1",
          teamName: "Bath",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          pointsFor: 17,
          pointsAgainst: 24,
          triesFor: 2,
          wasWinning: false,
          wasLosing: true,
        }),
        perspective({
          fixtureId: "f2",
          teamId: "t2",
          teamName: "Saracens",
          side: "away",
          everTrailing: false,
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          pointsFor: 24,
          pointsAgainst: 17,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(2);
    expect(bath?.drawn).toBe(1);
    expect(bath?.extra?.comebackLossesWithBonus).toBe(1);
    expect(bath?.leaguePoints).toBe(3);
    expect(bath?.extra?.losingBonusPointsGained).toBe(1);
  });

  it("filters behind at half-time and after 60 minutes", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        behindAtHalfTime: true,
        behindAfterSixty: false,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        behindAtHalfTime: false,
        behindAfterSixty: true,
      }),
    ];

    const halfTime = buildPointsGainedLosingTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      losingPositionFilter: "half_time",
    });
    const afterSixty = buildPointsGainedLosingTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      losingPositionFilter: "after_sixty",
    });

    expect(halfTime.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(afterSixty.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("supports home and away views and excludes missing timeline data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        scoreTimelineVerified: true,
      }),
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
        everTrailing: null,
        scoreTimelineVerified: false,
      }),
    ];

    const home = buildPointsGainedLosingTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildPointsGainedLosingTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(all.rows.find((row) => row.teamName === "Bath")?.played).toBe(2);
  });

  it("sorts by points gained by default", () => {
    const sorted = sortPointsGainedLosingRows(
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
          leaguePoints: 5,
          extra: { comebackWinPct: 50, avgPointsGainedPerMatch: 2.5 },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 8,
          extra: { comebackWinPct: 100, avgPointsGainedPerMatch: 8 },
        },
      ],
      "points_gained",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
