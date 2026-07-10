import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import { scoringRulesForPremiershipSeason } from "./premiership-season-scoring";
import {
  buildWinningBonusPointsTableStandings,
  competitionHasBonusPoints,
  formatScoringRulesBonusSummary,
  maximumWinTablePoints,
  resolveMatchBonusPoints,
  sortWinningBonusPointsRows,
} from "./winning-bonus-points-table-service";
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
    firstHalfTriesFor: 2,
    firstHalfTriesAgainst: 1,
    secondHalfFor: 14,
    secondHalfAgainst: 10,
    secondHalfTriesFor: 2,
    secondHalfTriesAgainst: 1,
    finalTwentyFor: 10,
    finalTwentyAgainst: 7,
    finalTwentyTriesFor: 1,
    finalTwentyTriesAgainst: 1,
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

describe("winning bonus points table", () => {
  it("maps route param to winning_bonus_points id", () => {
    expect(tableIdFromTypeParam("winning-bonus-points-table")).toBe("winning_bonus_points");
  });

  it("awards try bonus and maximum-point win from competition rules", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const resolution = resolveMatchBonusPoints(
      perspective({ pointsFor: 31, pointsAgainst: 17, triesFor: 4 }),
      rules,
    );
    expect(resolution?.tryBonusPoints).toBe(1);
    expect(resolution?.losingBonusPoints).toBe(0);
    expect(resolution?.totalBonusPoints).toBe(1);
    expect(resolution?.isMaximumPointWin).toBe(true);
    expect(maximumWinTablePoints(rules)).toBe(5);
  });

  it("awards losing bonus on close defeat without try bonus", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const resolution = resolveMatchBonusPoints(
      perspective({ pointsFor: 17, pointsAgainst: 24, triesFor: 2 }),
      rules,
    );
    expect(resolution?.tryBonusPoints).toBe(0);
    expect(resolution?.losingBonusPoints).toBe(1);
    expect(resolution?.totalBonusPoints).toBe(1);
    expect(resolution?.isMaximumPointWin).toBe(false);
  });

  it("counts win without bonus point separately from maximum-point win", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildWinningBonusPointsTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", pointsFor: 24, pointsAgainst: 17, triesFor: 2 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          pointsFor: 31,
          pointsAgainst: 17,
          triesFor: 4,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows[0];
    expect(bath?.won).toBe(2);
    expect(bath?.extra?.tryBonusPointsTotal).toBe(1);
    expect(bath?.extra?.maximumPointWins).toBe(1);
    expect(bath?.extra?.bonusPointMatches).toBe(1);
    expect(bath?.extra?.bonusPointRatePct).toBe(50);
  });

  it("uses top 14 try bonus threshold of three tries", () => {
    const rules = scoringRulesForCompetitionSlug("top-14");
    const resolution = resolveMatchBonusPoints(
      perspective({ pointsFor: 27, pointsAgainst: 20, triesFor: 3 }),
      rules,
    );
    expect(resolution?.tryBonusPoints).toBe(1);
  });

  it("marks historic seasons without bonus points as not applicable", () => {
    const rules = scoringRulesForPremiershipSeason(1999);
    expect(competitionHasBonusPoints(rules)).toBe(false);
    const built = buildWinningBonusPointsTableStandings({
      seasonPerspectives: [perspective({ seasonStartYear: 1999 })],
      rules,
      competitionSlug: "premiership",
      tableView: "all",
    });
    expect(built.bonusNotApplicable).toBe(true);
    expect(built.rows).toHaveLength(0);
    expect(formatScoringRulesBonusSummary(rules)).toContain("does not award");
  });

  it("excludes matches missing try data when try bonus rules apply", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildWinningBonusPointsTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesFor: 4 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesFor: null,
        }),
      ],
      rules,
      tableView: "all",
    });

    expect(built.rows[0]?.played).toBe(1);
  });

  it("uses last-five away logic per team", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        side: "home",
        pointsFor: 31,
        triesFor: 4,
        kickoffAt: new Date("2026-04-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        side: "away",
        pointsFor: 24,
        triesFor: 2,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        side: "away",
        pointsFor: 31,
        triesFor: 4,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
    ];

    const awayLastTwo = buildWinningBonusPointsTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
      matchRangeCount: 2,
    });

    expect(awayLastTwo.rows[0]?.played).toBe(2);
    expect(awayLastTwo.rows[0]?.extra?.tryBonusPointsTotal).toBe(1);
  });

  it("sorts by total bonus points by default", () => {
    const sorted = sortWinningBonusPointsRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 3,
          won: 2,
          drawn: 0,
          lost: 1,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 2,
          leaguePoints: 2,
          extra: { totalBonusPoints: 2, tryBonusPointsTotal: 2, maximumPointWins: 1 },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 3,
          won: 2,
          drawn: 0,
          lost: 1,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 4,
          leaguePoints: 4,
          extra: { totalBonusPoints: 4, tryBonusPointsTotal: 3, maximumPointWins: 2 },
        },
      ],
      "total_bonus_points",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
