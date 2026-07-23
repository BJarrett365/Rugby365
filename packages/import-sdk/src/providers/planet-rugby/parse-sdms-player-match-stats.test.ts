import { describe, expect, it } from "vitest";
import {
  aggregatePerformanceStats,
  attackScore,
  buildMatchPerformanceImportKey,
  defenceScore,
  parseMatchPlayerPerformance,
  parseSidePlayerMatchPerformance,
  perMinuteRate,
} from "./parse-sdms-player-match-stats";
import type { SdmsMatchPlayerStats } from "./sdms-match-stats";

const SAMPLE = {
  home: {
    attack: {
      match_id: "v907ry1j",
      carries: [
        { side: "home", player_id: "p1", player_name: "Henry Pollock", value: 16 },
      ],
      detail_list: [
        {
          player_id: "p1",
          player_name: "Henry Pollock",
          minutes_played: 80,
          metres: 38,
          passes: 11,
          offloads: 2,
          try_assists: 1,
          clean_breaks: 2,
          defenders_beaten: 8,
        },
      ],
    },
    defend: {
      match_id: "v907ry1j",
      detail_list: [
        {
          player_id: "p1",
          player_name: "Henry Pollock",
          minutes_played: 80,
          tackles: 15,
          missed_tackles: 1,
          turnovers_won: 1,
        },
      ],
    },
    kicking: {
      match_id: "v907ry1j",
      detail_list: [
        {
          player_id: "p1",
          player_name: "Henry Pollock",
          minutes_played: 80,
          kicks: 3,
          kicks_from_hand: 2,
          kick_from_hand_metres: 40,
          kick_possession_retained: 1,
        },
      ],
    },
    errors: {
      match_id: "v907ry1j",
      detail_list: [
        {
          player_id: "p1",
          player_name: "Henry Pollock",
          minutes_played: 80,
          bad_passes: 1,
          dropped_catch: 0,
          handling_error: 2,
          turnovers_conceded: 1,
        },
      ],
    },
    carries: {
      match_id: "v907ry1j",
      detail_list: [
        {
          player_id: "p1",
          player_name: "Henry Pollock",
          minutes_played: 80,
          runs: 16,
          gain_line: 9,
          carries_metres: 38,
          carries_crossed_gain_line: 9,
          carries_not_made_gain_line: 5,
          carries: 0,
        },
      ],
    },
  },
  away: {
    attack: { match_id: "v907ry1j", detail_list: [] },
    defend: { match_id: "v907ry1j", detail_list: [] },
    kicking: null,
    errors: null,
    carries: null,
  },
} as SdmsMatchPlayerStats;

describe("parse-sdms-player-match-stats", () => {
  it("merges leader arrays and all detail categories for a side", () => {
    const rows = parseSidePlayerMatchPerformance(SAMPLE, "home");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      externalPlayerId: "p1",
      playerName: "Henry Pollock",
      carries: 16,
      metresCarried: 38,
      tacklesCompleted: 15,
      tacklesMade: 16,
      missedTackles: 1,
      tryAssists: 1,
      lineBreaks: 2,
      defendersBeaten: 8,
      turnoversWon: 1,
      passes: 11,
      offloads: 2,
      kicks: 3,
      kicksFromHand: 2,
      kickFromHandMetres: 40,
      kickPossessionRetained: 1,
      badPasses: 1,
      handlingError: 2,
      turnoversConceded: 1,
      runs: 16,
      gainLine: 9,
      carriesMetres: 38,
      carriesCrossedGainLine: 9,
      carriesNotMadeGainLine: 5,
    });
  });

  it("keeps leader carries when carries detail_list.carries is 0", () => {
    const row = parseSidePlayerMatchPerformance(SAMPLE, "home")[0]!;
    expect(row.carries).toBe(16);
    expect(row.runs).toBe(16);
  });

  it("builds stable import keys", () => {
    expect(buildMatchPerformanceImportKey("v907ry1j", "p1")).toBe("v907ry1j:p1");
  });

  it("aggregates match rows into season totals", () => {
    const parsed = parseMatchPlayerPerformance(SAMPLE);
    const totals = aggregatePerformanceStats(
      parsed.map((row) => ({ ...row, tries: 2, points: 10 })),
    );
    expect(totals.appearances).toBe(1);
    expect(totals.carries).toBe(16);
    expect(totals.tries).toBe(2);
    expect(totals.points).toBe(10);
    expect(totals.badPasses).toBe(1);
    expect(totals.kicks).toBe(3);
  });

  it("computes per-minute rates and ranking scores", () => {
    const totals = aggregatePerformanceStats(parseSidePlayerMatchPerformance(SAMPLE, "home"));
    expect(perMinuteRate(totals.carries, totals.minutesPlayed)).toBe(0.2);
    expect(attackScore(totals)).toBeGreaterThan(0);
    expect(defenceScore(totals)).toBeGreaterThan(0);
  });
});
