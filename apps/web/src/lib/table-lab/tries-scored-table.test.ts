import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildTriesScoredTableStandings,
  sortTriesScoredRows,
  triesForPeriod,
} from "./tries-scored-table-service";
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

describe("tries scored table", () => {
  it("maps route param to tries_scored id", () => {
    expect(tableIdFromTypeParam("tries-scored-table")).toBe("tries_scored");
  });

  it("aggregates total tries and try scoring rate", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildTriesScoredTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesFor: 4 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesFor: 0,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(2);
    expect(bath?.extra?.triesScored).toBe(4);
    expect(bath?.extra?.triesPerMatch).toBe(2);
    expect(bath?.extra?.matchesWithTry).toBe(1);
    expect(bath?.extra?.tryScoringRatePct).toBe(50);
    expect(bath?.extra?.matchesWith2Plus).toBe(1);
    expect(bath?.extra?.matchesWith4Plus).toBe(1);
    expect(bath?.extra?.tryBonusPointsTotal).toBe(1);
  });

  it("counts 2+ through 5+ try thresholds", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildTriesScoredTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesFor: 2 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesFor: 3,
        }),
        perspective({
          fixtureId: "f3",
          kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
          triesFor: 5,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows[0];
    expect(bath?.extra?.matchesWith2Plus).toBe(3);
    expect(bath?.extra?.matchesWith3Plus).toBe(2);
    expect(bath?.extra?.matchesWith4Plus).toBe(1);
    expect(bath?.extra?.matchesWith5Plus).toBe(1);
  });

  it("uses last-five away logic per team", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home", triesFor: 4, kickoffAt: new Date("2026-04-01T15:00:00.000Z") }),
      perspective({ fixtureId: "f2", side: "away", triesFor: 1, kickoffAt: new Date("2026-03-01T15:00:00.000Z") }),
      perspective({ fixtureId: "f3", side: "away", triesFor: 2, kickoffAt: new Date("2026-02-01T15:00:00.000Z") }),
      perspective({ fixtureId: "f4", side: "away", triesFor: 3, kickoffAt: new Date("2026-01-01T15:00:00.000Z") }),
    ];

    const awayLastTwo = buildTriesScoredTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
      matchRangeCount: 2,
    });

    expect(awayLastTwo.rows[0]?.played).toBe(2);
    expect(awayLastTwo.rows[0]?.extra?.triesScored).toBe(3);
  });

  it("supports home view and excludes missing try data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home", triesFor: 3 }),
      perspective({
        fixtureId: "f2",
        side: "away",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        triesFor: 2,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        triesFor: null,
      }),
    ];

    const home = buildTriesScoredTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildTriesScoredTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows[0]?.played).toBe(1);
    expect(all.rows[0]?.played).toBe(2);
  });

  it("uses period-specific try counts from timed events", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [perspective({ fixtureId: "f1" })];

    expect(triesForPeriod(fixtures[0]!, "first_half")).toBe(2);
    expect(triesForPeriod(fixtures[0]!, "second_half")).toBe(2);
    expect(triesForPeriod(fixtures[0]!, "final_20")).toBe(1);

    const firstHalf = buildTriesScoredTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      period: "first_half",
    });
    const secondHalf = buildTriesScoredTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      period: "second_half",
    });
    const finalTwenty = buildTriesScoredTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      period: "final_20",
    });

    expect(firstHalf.rows[0]?.extra?.triesScored).toBe(2);
    expect(secondHalf.rows[0]?.extra?.triesScored).toBe(2);
    expect(finalTwenty.rows[0]?.extra?.triesScored).toBe(1);
  });

  it("excludes matches without period try timing", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildTriesScoredTableStandings({
      seasonPerspectives: [
        perspective({
          firstHalfTriesFor: null,
          secondHalfTriesFor: null,
          finalTwentyTriesFor: null,
        }),
      ],
      rules,
      tableView: "all",
      period: "first_half",
    });

    expect(built.rows).toHaveLength(0);
  });

  it("sorts by total tries scored by default", () => {
    const sorted = sortTriesScoredRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 2,
          won: 0,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 6,
          extra: { triesScored: 6, triesPerMatch: 3, tryScoringRatePct: 100 },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 2,
          won: 0,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 10,
          extra: { triesScored: 10, triesPerMatch: 5, tryScoringRatePct: 100 },
        },
      ],
      "tries_scored",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
