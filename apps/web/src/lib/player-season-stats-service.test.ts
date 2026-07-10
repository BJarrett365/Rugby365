import { describe, expect, it } from "vitest";
import { calculatePlayerAge, normalizeSocialAccounts } from "./player-profile-utils";
import {
  buildSeasonStatsFilterOptions,
  filterPlayerSeasonStatsRows,
  type PlayerSeasonStatsRow,
} from "./player-season-stats-service";
import { aggregatePerformanceStats, attackScore, defenceScore } from "@rugby365/import-sdk";

function sampleRow(overrides: Partial<PlayerSeasonStatsRow> = {}): PlayerSeasonStatsRow {
  return {
    id: "1",
    playerId: "p1",
    seasonId: "s1",
    seasonLabel: "2025/26",
    competitionId: "c1",
    competitionName: "Premiership",
    teamId: "t1",
    teamName: "Saints",
    appearances: 10,
    minutesPlayed: 600,
    tries: 3,
    points: 15,
    carries: 40,
    metresCarried: 200,
    tacklesMade: 50,
    tacklesCompleted: 45,
    dominantTackles: 5,
    turnoversWon: 2,
    tryAssists: 1,
    lineBreaks: 4,
    defendersBeaten: 8,
    touches: 60,
    postContactMetres: 0,
    ruckArrivalEffectiveness: 0,
    attackRank: 5,
    defenceRank: 12,
    carriesPerMinute: 0.07,
    tacklesPerMinute: 0.08,
    averages: {
      appearances: 5,
      minutesPlayed: 60,
      tries: 0.6,
      points: 3,
      carries: 8,
      metresCarried: 40,
      tacklesMade: 10,
      tacklesCompleted: 9,
      dominantTackles: 1,
      turnoversWon: 0.4,
      tryAssists: 0.2,
      lineBreaks: 0.8,
      defendersBeaten: 1.6,
      touches: 12,
      postContactMetres: 0,
      ruckArrivalEffectiveness: 0,
    },
    ...overrides,
  };
}

describe("player-profile-utils", () => {
  it("calculates age from birth date", () => {
    expect(calculatePlayerAge("1995-06-20", new Date("2026-06-20"))).toBe(31);
    expect(calculatePlayerAge("1995-12-31", new Date("2026-06-20"))).toBe(30);
  });

  it("normalizes social account fields", () => {
    expect(
      normalizeSocialAccounts({
        twitter: " https://x.com/player ",
        instagram: "",
        website: "https://example.com",
      }),
    ).toEqual({
      twitter: "https://x.com/player",
      instagram: null,
      facebook: null,
      tiktok: null,
      website: "https://example.com",
    });
  });
});

describe("player match stat aggregation helpers", () => {
  it("builds unique season and competition filter options", () => {
    const options = buildSeasonStatsFilterOptions([
      { seasonId: "s1", seasonLabel: "2025/26", competitionId: "c1", competitionName: "Premiership" },
      { seasonId: "s2", seasonLabel: "2024/25", competitionId: "c1", competitionName: "Premiership" },
      { seasonId: "s1", seasonLabel: "2025/26", competitionId: "c2", competitionName: "Champions Cup" },
    ]);

    expect(options.seasons.map((s) => s.label)).toEqual(["2025/26", "2024/25"]);
    expect(options.competitions.map((c) => c.name)).toEqual(["Champions Cup", "Premiership"]);
  });

  it("filters player rows by season and competition", () => {
    const rows = [
      sampleRow({ id: "1", seasonId: "s1", competitionId: "c1" }),
      sampleRow({ id: "2", seasonId: "s2", competitionId: "c1", seasonLabel: "2024/25" }),
      sampleRow({ id: "3", seasonId: "s1", competitionId: "c2", competitionName: "Champions Cup" }),
    ];

    expect(filterPlayerSeasonStatsRows(rows, { seasonId: "s1" })).toHaveLength(2);
    expect(filterPlayerSeasonStatsRows(rows, { competitionId: "c2" })).toHaveLength(1);
    expect(filterPlayerSeasonStatsRows(rows, { seasonId: "s1", competitionId: "c1" })).toHaveLength(1);
  });
});

describe("player-season-stats aggregation", () => {
  it("sums core and attack/defence metrics across appearances", () => {
    const totals = aggregatePerformanceStats([
      {
        externalPlayerId: "p1",
        playerName: "A",
        side: "home",
        minutesPlayed: 40,
        carries: 5,
        metresCarried: 20,
        tacklesMade: 6,
        tacklesCompleted: 5,
        missedTackles: 1,
        dominantTackles: 1,
        turnoversWon: 1,
        tryAssists: 1,
        lineBreaks: 1,
        defendersBeaten: 2,
        touches: 7,
        postContactMetres: 0,
        ruckArrivalEffectiveness: 0,
        passes: 2,
        offloads: 0,
        tries: 1,
        points: 5,
      },
      {
        externalPlayerId: "p1",
        playerName: "A",
        side: "home",
        minutesPlayed: 40,
        carries: 7,
        metresCarried: 30,
        tacklesMade: 4,
        tacklesCompleted: 4,
        missedTackles: 0,
        dominantTackles: 0,
        turnoversWon: 0,
        tryAssists: 0,
        lineBreaks: 0,
        defendersBeaten: 1,
        touches: 8,
        postContactMetres: 0,
        ruckArrivalEffectiveness: 0,
        passes: 1,
        offloads: 0,
        tries: 0,
        points: 0,
      },
    ]);

    expect(totals.appearances).toBe(2);
    expect(totals.carries).toBe(12);
    expect(totals.metresCarried).toBe(50);
    expect(totals.tacklesCompleted).toBe(9);
    expect(attackScore(totals)).toBeGreaterThan(defenceScore({ ...totals, appearances: 2 }));
  });
});
