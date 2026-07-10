import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  bothTeamsScoredAtLeastOneTry,
  bothTeamsScoredAtLeastTries,
  buildBothTeamsScoredTriesTableStandings,
  sortBothTeamsScoredTriesRows,
} from "./both-teams-scored-tries-table-service";
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
    firstHalfFor: 10,
    firstHalfAgainst: 7,
    firstHalfTriesFor: 2,
    firstHalfTriesAgainst: 1,
    secondHalfFor: 14,
    secondHalfAgainst: 10,
    secondHalfTriesFor: 1,
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

describe("both teams scored tries table", () => {
  it("maps route param to both_teams_scored_tries id", () => {
    expect(tableIdFromTypeParam("both-teams-scored-tries")).toBe("both_teams_scored_tries");
  });

  it("classifies yes and no outcomes from verified try totals", () => {
    expect(bothTeamsScoredAtLeastOneTry(perspective({ triesFor: 1, triesAgainst: 1 }))).toBe(true);
    expect(bothTeamsScoredAtLeastOneTry(perspective({ triesFor: 3, triesAgainst: 2 }))).toBe(true);
    expect(bothTeamsScoredAtLeastOneTry(perspective({ triesFor: 4, triesAgainst: 0 }))).toBe(false);
    expect(bothTeamsScoredAtLeastOneTry(perspective({ triesFor: 0, triesAgainst: 2 }))).toBe(false);
    expect(bothTeamsScoredAtLeastOneTry(perspective({ triesFor: 0, triesAgainst: 0 }))).toBe(false);
  });

  it("aggregates yes, no and percentages", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildBothTeamsScoredTriesTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesFor: 3, triesAgainst: 2 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesFor: 4,
          triesAgainst: 0,
        }),
        perspective({
          fixtureId: "f3",
          kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
          triesFor: 1,
          triesAgainst: 1,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows[0];
    expect(bath?.played).toBe(3);
    expect(bath?.extra?.bothTeamsScoredYes).toBe(2);
    expect(bath?.extra?.bothTeamsScoredNo).toBe(1);
    expect(bath?.extra?.bothTeamsScoredYesPct).toBeCloseTo(66.7, 1);
    expect(bath?.extra?.bothTeamsScoredNoPct).toBeCloseTo(33.3, 1);
  });

  it("counts both teams 2+, 3+ and 4+ thresholds", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildBothTeamsScoredTriesTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesFor: 2, triesAgainst: 2 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesFor: 3,
          triesAgainst: 3,
        }),
        perspective({
          fixtureId: "f3",
          kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
          triesFor: 4,
          triesAgainst: 4,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows[0];
    expect(bath?.extra?.bothTeams2Plus).toBe(3);
    expect(bath?.extra?.bothTeams3Plus).toBe(2);
    expect(bath?.extra?.bothTeams4Plus).toBe(1);
    expect(bothTeamsScoredAtLeastTries(perspective({ triesFor: 2, triesAgainst: 2 }), 2)).toBe(true);
    expect(bothTeamsScoredAtLeastTries(perspective({ triesFor: 3, triesAgainst: 2 }), 3)).toBe(false);
  });

  it("uses last-five away logic per team", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        side: "home",
        triesFor: 3,
        triesAgainst: 2,
        kickoffAt: new Date("2026-04-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        side: "away",
        triesFor: 1,
        triesAgainst: 1,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        side: "away",
        triesFor: 4,
        triesAgainst: 0,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f4",
        side: "away",
        triesFor: 2,
        triesAgainst: 2,
        kickoffAt: new Date("2026-01-01T15:00:00.000Z"),
      }),
    ];

    const awayLastTwo = buildBothTeamsScoredTriesTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
      matchRangeCount: 2,
    });

    expect(awayLastTwo.rows[0]?.played).toBe(2);
    expect(awayLastTwo.rows[0]?.extra?.bothTeamsScoredYes).toBe(1);
  });

  it("supports home view and excludes missing try data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home", triesFor: 2, triesAgainst: 1 }),
      perspective({
        fixtureId: "f2",
        side: "away",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        triesFor: 1,
        triesAgainst: 1,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        triesFor: 2,
        triesAgainst: null,
      }),
    ];

    const home = buildBothTeamsScoredTriesTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildBothTeamsScoredTriesTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows[0]?.played).toBe(1);
    expect(all.rows[0]?.played).toBe(2);
  });

  it("sorts by yes % by default", () => {
    const sorted = sortBothTeamsScoredTriesRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 4,
          won: 0,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 2,
          extra: { bothTeamsScoredYes: 2, bothTeamsScoredYesPct: 50, bothTeams2PlusPct: 25 },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 4,
          won: 0,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 3,
          extra: { bothTeamsScoredYes: 3, bothTeamsScoredYesPct: 75, bothTeams2PlusPct: 50 },
        },
      ],
      "yes_pct",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
