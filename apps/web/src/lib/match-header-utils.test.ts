import { describe, expect, it } from "vitest";
import {
  collectHeaderCards,
  possessionHalvesFromStats,
  resolveHalfTimeScore,
} from "./match-header-utils";
import type { SdmsMatchDetail } from "@rugby365/import-sdk";

describe("resolveHalfTimeScore", () => {
  it("uses half-time event scores when present", () => {
    const ht = resolveHalfTimeScore([
      { type: "try", minute: 12, home_score: 5, away_score: 0 },
      { type: "Half Time", minute: 40, home_score: 17, away_score: 10 },
    ]);
    expect(ht).toEqual({ home: 17, away: 10, minute: 40 });
  });

  it("falls back to last scoring event at or before 40'", () => {
    const ht = resolveHalfTimeScore([
      { type: "try", minute: 8, home_score: 5, away_score: 0 },
      { type: "conversion", minute: 9, home_score: 7, away_score: 0 },
      { type: "try", minute: 55, home_score: 14, away_score: 0 },
    ]);
    expect(ht).toEqual({ home: 7, away: 0, minute: 40 });
  });
});

describe("collectHeaderCards", () => {
  it("reads yellow and red from key events", () => {
    const detail = {
      key_events: [
        { type: "Yellow Card", minute: 22, team_id: "home1", player_name: "A" },
        { type: "Red Card", minute: 70, team_id: "away1", player_name: "B" },
      ],
    } as unknown as SdmsMatchDetail;
    const cards = collectHeaderCards(detail, "home1");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ type: "yellow", side: "home", minute: 22 });
    expect(cards[1]).toMatchObject({ type: "red", side: "away", minute: 70 });
  });
});

describe("possessionHalvesFromStats", () => {
  it("normalises fraction percentages", () => {
    const p = possessionHalvesFromStats({
      possession: {
        home_overall_percentage: 0.56,
        away_overall_percentage: 0.44,
      },
    } as never);
    expect(p.homeOverall).toBeCloseTo(0.56);
    expect(p.awayOverall).toBeCloseTo(0.44);
  });
});
