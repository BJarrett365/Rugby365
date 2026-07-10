import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import { resolveFirstScoringEvent } from "./first-score-utils";
import {
  buildScoringFirstTableStandings,
  sortScoringFirstRows,
} from "./scoring-first-table-service";
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
    firstHalfFor: null,
    firstHalfAgainst: null,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: true,
    concededFirst: false,
    firstScoreEventType: "try",
    firstScoreMinute: 12,
    firstScoreVerified: true,
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

describe("first score utils", () => {
  it("treats try as the opening score and ignores a later conversion", () => {
    const result = resolveFirstScoringEvent([
      { eventType: "try", minute: 8, sequenceNo: 1, teamId: "home" },
      { eventType: "conversion", minute: 9, sequenceNo: 2, teamId: "home" },
      { eventType: "penalty", minute: 30, sequenceNo: 3, teamId: "away" },
    ]);

    expect(result.verified).toBe(true);
    expect(result.teamId).toBe("home");
    expect(result.eventType).toBe("try");
    expect(result.minute).toBe(8);
  });

  it("supports penalty goal, drop goal and penalty try opening scores", () => {
    expect(resolveFirstScoringEvent([{ eventType: "penalty", minute: 5, teamId: "a" }]).eventType).toBe(
      "penalty",
    );
    expect(resolveFirstScoringEvent([{ eventType: "drop_goal", minute: 5, teamId: "a" }]).eventType).toBe(
      "drop_goal",
    );
    expect(
      resolveFirstScoringEvent([{ eventType: "penalty_try", minute: 5, teamId: "a" }]).eventType,
    ).toBe("penalty_try");
  });

  it("marks simultaneous opening scores as unverified", () => {
    const result = resolveFirstScoringEvent([
      { eventType: "try", minute: 10, sequenceNo: 1, teamId: "home" },
      { eventType: "penalty", minute: 10, sequenceNo: 2, teamId: "away" },
    ]);

    expect(result.verified).toBe(false);
    expect(result.teamId).toBeNull();
  });

  it("returns verified null opening score for 0-0 matches", () => {
    const result = resolveFirstScoringEvent([]);
    expect(result).toEqual({
      teamId: null,
      eventType: null,
      minute: null,
      verified: true,
    });
  });
});

describe("table when scoring first", () => {
  it("maps type=table-when-scoring-first route param to scoring_first id", () => {
    expect(tableIdFromTypeParam("table-when-scoring-first")).toBe("scoring_first");
    expect(tableIdFromTypeParam("scoring-first")).toBe("scoring_first");
  });

  it("includes only the team that scored first and uses the final result", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Northampton Saints",
        opponentId: "t2",
        opponentName: "Bath",
        scoredFirst: true,
        concededFirst: false,
        pointsFor: 24,
        pointsAgainst: 17,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Bath",
        opponentId: "t1",
        opponentName: "Northampton Saints",
        side: "away",
        scoredFirst: false,
        concededFirst: true,
        pointsFor: 17,
        pointsAgainst: 24,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Northampton Saints",
        opponentId: "t3",
        opponentName: "Saracens",
        scoredFirst: true,
        concededFirst: false,
        pointsFor: 10,
        pointsAgainst: 20,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Northampton Saints",
        side: "away",
        scoredFirst: false,
        concededFirst: true,
        pointsFor: 20,
        pointsAgainst: 10,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const built = buildScoringFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    const northampton = built.rows.find((row) => row.teamName === "Northampton Saints");
    const bath = built.rows.find((row) => row.teamName === "Bath");

    expect(northampton?.played).toBe(2);
    expect(northampton?.won).toBe(1);
    expect(northampton?.lost).toBe(1);
    expect(bath).toBeUndefined();
  });

  it("filters by first score type", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        firstScoreEventType: "try",
        scoredFirst: true,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        scoredFirst: false,
        concededFirst: true,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Exeter Chiefs",
        firstScoreEventType: "penalty",
        scoredFirst: true,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        scoredFirst: false,
        concededFirst: true,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const tryOnly = buildScoringFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      firstScoreType: "try",
    });

    expect(tryOnly.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("excludes 0-0 matches and ambiguous first-score fixtures", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f0",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t2",
        opponentName: "Saracens",
        scoredFirst: null,
        concededFirst: null,
        firstScoreEventType: null,
        firstScoreMinute: null,
        firstScoreVerified: true,
        pointsFor: 0,
        pointsAgainst: 0,
      }),
      perspective({
        fixtureId: "f0",
        teamId: "t2",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        scoredFirst: null,
        concededFirst: null,
        firstScoreVerified: true,
        pointsFor: 0,
        pointsAgainst: 0,
      }),
      perspective({
        fixtureId: "f9",
        teamId: "t1",
        teamName: "Bath",
        scoredFirst: null,
        concededFirst: null,
        firstScoreVerified: false,
      }),
      perspective({
        fixtureId: "f9",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        scoredFirst: null,
        concededFirst: null,
        firstScoreVerified: false,
      }),
    ];

    const built = buildScoringFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(built.rows).toHaveLength(0);
    expect(built.ambiguousFixtureCount).toBe(1);
  });

  it("supports home and away views", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        scoredFirst: true,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        scoredFirst: false,
        concededFirst: true,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        scoredFirst: true,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        scoredFirst: false,
        concededFirst: true,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const home = buildScoringFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const away = buildScoringFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(away.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("calculates betting metrics and bonus points when data exists", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildScoringFirstTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "Bath",
          pointsFor: 31,
          pointsAgainst: 24,
          triesFor: 4,
          triesAgainst: 3,
          firstScoreMinute: 10,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          teamName: "Saracens",
          side: "away",
          scoredFirst: false,
          concededFirst: true,
          pointsFor: 24,
          pointsAgainst: 31,
        }),
        perspective({
          fixtureId: "f2",
          teamId: "t2",
          teamName: "Saracens",
          opponentId: "t1",
          opponentName: "Bath",
          side: "home",
          scoredFirst: false,
          concededFirst: true,
          pointsFor: 20,
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
          scoredFirst: false,
          concededFirst: true,
          pointsFor: 10,
          pointsAgainst: 20,
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.leaguePoints).toBe(5);
    expect(bath?.tryBonusPoints).toBe(1);
    expect(bath?.extra?.avgFirstScoreMinute).toBe(10);
    expect(bath?.extra?.leadConvertedWinPct).toBe(100);
    expect(bath?.extra?.matchesScoringFirstPct).toBe(50);
    expect(bath?.extra?.avgWinningMargin).toBe(7);
  });

  it("sorts by win % when requested", () => {
    const sorted = sortScoringFirstRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 4,
          won: 2,
          drawn: 0,
          lost: 2,
          pointsFor: 80,
          pointsAgainst: 70,
          pointsDiff: 10,
          bonusPoints: 0,
          leaguePoints: 8,
          winPct: 50,
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 2,
          won: 2,
          drawn: 0,
          lost: 0,
          pointsFor: 50,
          pointsAgainst: 20,
          pointsDiff: 30,
          bonusPoints: 0,
          leaguePoints: 8,
          winPct: 100,
          extra: { matchesScoringFirstPct: 40 },
        },
      ],
      "win_pct",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
