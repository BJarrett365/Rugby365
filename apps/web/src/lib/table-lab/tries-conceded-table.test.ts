import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildTriesConcededTableStandings,
  sortTriesConcededRows,
  triesConcededForPeriod,
} from "./tries-conceded-table-service";
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

describe("tries conceded table", () => {
  it("maps route param to tries_conceded id", () => {
    expect(tableIdFromTypeParam("tries-conceded-table")).toBe("tries_conceded");
  });

  it("aggregates total tries conceded and try conceding rate", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildTriesConcededTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesAgainst: 4 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesAgainst: 0,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(2);
    expect(bath?.extra?.triesConceded).toBe(4);
    expect(bath?.extra?.triesConcededPerMatch).toBe(2);
    expect(bath?.extra?.matchesConcedingTry).toBe(1);
    expect(bath?.extra?.tryConcedingRatePct).toBe(50);
    expect(bath?.extra?.matchesConceding2Plus).toBe(1);
    expect(bath?.extra?.matchesConceding4Plus).toBe(1);
  });

  it("counts 2+ through 5+ conceded thresholds", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildTriesConcededTableStandings({
      seasonPerspectives: [
        perspective({ fixtureId: "f1", triesAgainst: 2 }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          triesAgainst: 3,
        }),
        perspective({
          fixtureId: "f3",
          kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
          triesAgainst: 5,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows[0];
    expect(bath?.extra?.matchesConceding2Plus).toBe(3);
    expect(bath?.extra?.matchesConceding3Plus).toBe(2);
    expect(bath?.extra?.matchesConceding4Plus).toBe(1);
    expect(bath?.extra?.matchesConceding5Plus).toBe(1);
  });

  it("uses last-five away logic per team", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        side: "home",
        triesAgainst: 4,
        kickoffAt: new Date("2026-04-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f2",
        side: "away",
        triesAgainst: 1,
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        side: "away",
        triesAgainst: 2,
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f4",
        side: "away",
        triesAgainst: 3,
        kickoffAt: new Date("2026-01-01T15:00:00.000Z"),
      }),
    ];

    const awayLastTwo = buildTriesConcededTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "away",
      matchRangeCount: 2,
    });

    expect(awayLastTwo.rows[0]?.played).toBe(2);
    expect(awayLastTwo.rows[0]?.extra?.triesConceded).toBe(3);
  });

  it("supports home view and excludes missing try data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home", triesAgainst: 3 }),
      perspective({
        fixtureId: "f2",
        side: "away",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        triesAgainst: 2,
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        triesAgainst: null,
      }),
    ];

    const home = buildTriesConcededTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildTriesConcededTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows[0]?.played).toBe(1);
    expect(all.rows[0]?.played).toBe(2);
  });

  it("uses period-specific tries conceded from timed events", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [perspective({ fixtureId: "f1" })];

    expect(triesConcededForPeriod(fixtures[0]!, "first_half")).toBe(1);
    expect(triesConcededForPeriod(fixtures[0]!, "second_half")).toBe(1);
    expect(triesConcededForPeriod(fixtures[0]!, "final_20")).toBe(1);

    const firstHalf = buildTriesConcededTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      period: "first_half",
    });
    const secondHalf = buildTriesConcededTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      period: "second_half",
    });
    const finalTwenty = buildTriesConcededTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      period: "final_20",
    });

    expect(firstHalf.rows[0]?.extra?.triesConceded).toBe(1);
    expect(secondHalf.rows[0]?.extra?.triesConceded).toBe(1);
    expect(finalTwenty.rows[0]?.extra?.triesConceded).toBe(1);
  });

  it("excludes matches without period try timing", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildTriesConcededTableStandings({
      seasonPerspectives: [
        perspective({
          firstHalfTriesAgainst: null,
          secondHalfTriesAgainst: null,
          finalTwentyTriesAgainst: null,
        }),
      ],
      rules,
      tableView: "all",
      period: "first_half",
    });

    expect(built.rows).toHaveLength(0);
  });

  it("sorts by fewest tries conceded by default", () => {
    const sorted = sortTriesConcededRows(
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
          extra: { triesConceded: 6, triesConcededPerMatch: 3, tryConcedingRatePct: 100 },
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
          extra: { triesConceded: 10, triesConcededPerMatch: 5, tryConcedingRatePct: 100 },
        },
      ],
      "fewest_tries_conceded",
    );

    expect(sorted[0]?.teamName).toBe("Alpha");
  });

  it("sorts by highest 3+ conceded rate for betting view", () => {
    const sorted = sortTriesConcededRows(
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
          leaguePoints: 8,
          extra: { triesConceded: 8, threePlusConcededPct: 25 },
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
          leaguePoints: 12,
          extra: { triesConceded: 12, threePlusConcededPct: 75 },
        },
      ],
      "three_plus_conceded_pct",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
  });
});
