import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildConcedingFirstTableStandings,
  sortConcedingFirstRows,
} from "./conceding-first-table-service";
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
    pointsFor: 17,
    pointsAgainst: 24,
    triesFor: 2,
    triesAgainst: 4,
    firstHalfFor: null,
    firstHalfAgainst: null,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: false,
    concededFirst: true,
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

describe("table when conceding first", () => {
  it("maps type=table-when-conceding-first route param to conceding_first id", () => {
    expect(tableIdFromTypeParam("table-when-conceding-first")).toBe("conceding_first");
    expect(tableIdFromTypeParam("conceding-first")).toBe("conceding_first");
  });

  it("includes only the team that conceded first and uses the final result", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Northampton Saints",
        opponentId: "t2",
        opponentName: "Bath",
        concededFirst: true,
        scoredFirst: false,
        pointsFor: 17,
        pointsAgainst: 24,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Bath",
        opponentId: "t1",
        opponentName: "Northampton Saints",
        side: "away",
        concededFirst: false,
        scoredFirst: true,
        pointsFor: 24,
        pointsAgainst: 17,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Northampton Saints",
        opponentId: "t3",
        opponentName: "Saracens",
        concededFirst: true,
        scoredFirst: false,
        pointsFor: 31,
        pointsAgainst: 24,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Saracens",
        opponentId: "t1",
        opponentName: "Northampton Saints",
        side: "away",
        concededFirst: false,
        scoredFirst: true,
        pointsFor: 24,
        pointsAgainst: 31,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const built = buildConcedingFirstTableStandings({
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

  it("filters by first conceded score type", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        firstScoreEventType: "try",
        concededFirst: true,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        scoredFirst: true,
        concededFirst: false,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        opponentId: "t3",
        opponentName: "Exeter Chiefs",
        firstScoreEventType: "penalty",
        concededFirst: true,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        opponentId: "t1",
        opponentName: "Bath",
        side: "away",
        scoredFirst: true,
        concededFirst: false,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const tryOnly = buildConcedingFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      firstScoreConcededType: "try",
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

    const built = buildConcedingFirstTableStandings({
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
        concededFirst: true,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        scoredFirst: true,
        concededFirst: false,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        concededFirst: true,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Exeter Chiefs",
        side: "home",
        scoredFirst: true,
        concededFirst: false,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const home = buildConcedingFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const away = buildConcedingFirstTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(away.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("calculates comeback metrics and bonus points when data exists", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildConcedingFirstTableStandings({
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
          scoredFirst: true,
          concededFirst: false,
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
          concededFirst: true,
          scoredFirst: false,
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
          scoredFirst: true,
          concededFirst: false,
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
    expect(bath?.extra?.avgFirstConcededMinute).toBe(10);
    expect(bath?.extra?.comebackWinPct).toBe(100);
    expect(bath?.extra?.comebackWins).toBe(1);
    expect(bath?.extra?.matchesConcedingFirstPct).toBe(50);
    expect(bath?.extra?.pointsGainedAfterConcedingFirst).toBe(5);
  });

  it("sorts by comeback wins when requested", () => {
    const sorted = sortConcedingFirstRows(
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
          extra: { comebackWins: 1, comebackWinPct: 25 },
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
          extra: { comebackWins: 2, comebackWinPct: 100 },
        },
      ],
      "comeback_wins",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
