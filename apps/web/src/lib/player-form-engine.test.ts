import { describe, expect, it } from "vitest";
import {
  PLAYER_FORM_WEIGHTS,
  computePlayerFormScore,
  formLabelForScore,
  recencyWeightForIndex,
} from "./player-form-engine";
import { recentFormMetricConfig, buildRecentFormMetricDisplays } from "./player-form-metric-config";

describe("player-form-engine", () => {
  it("weights sum to 1", () => {
    const sum = Object.values(PLAYER_FORM_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("recency buckets are 50/30/20", () => {
    expect(recencyWeightForIndex(0, 9)).toBe(0.5);
    expect(recencyWeightForIndex(3, 9)).toBe(0.3);
    expect(recencyWeightForIndex(6, 9)).toBe(0.2);
  });

  it("does not produce form from W/L alone", () => {
    const result = computePlayerFormScore([
      { matchRating: null, minutes: 80, points: 12, result: "W" },
      { matchRating: null, minutes: 80, points: 3, result: "W" },
      { matchRating: null, minutes: 80, points: 0, result: "L" },
    ]);
    expect(result.formScore).toBeNull();
    expect(result.resultStrip).toEqual(["W", "W", "L"]);
    expect(result.matchesUsed).toBe(0);
  });

  it("computes form from ratings with result as small context", () => {
    const result = computePlayerFormScore(
      [
        { matchRating: 8.5, minutes: 80, points: 15, result: "W", kicks: 12, lineBreaks: 1, tryAssists: 1 },
        { matchRating: 7.8, minutes: 80, points: 10, result: "W", kicks: 10, lineBreaks: 0, tryAssists: 0 },
        { matchRating: 6.5, minutes: 60, points: 3, result: "L", kicks: 8, lineBreaks: 0, tryAssists: 0 },
      ],
      { positionName: "Fly-Half" },
    );
    expect(result.formScore).not.toBeNull();
    expect(result.formScore!).toBeGreaterThan(5);
    expect(result.formScore!).toBeLessThanOrEqual(10);
    expect(result.formLabel).toBeTruthy();
    expect(result.appearancesEligible).toBe(3);
    expect(result.matchesUsed).toBe(3);
    expect(result.metricDisplays.find((m) => m.key === "points")?.display).not.toBe("—");
  });

  it("keeps missing metrics as — not 0", () => {
    const result = computePlayerFormScore(
      [{ matchRating: 7.2, minutes: 80, points: null, result: "W" }],
      { positionName: "Fly-Half" },
    );
    const points = result.metricDisplays.find((m) => m.key === "points");
    expect(points?.display).toBe("—");
    expect(points?.value).toBeNull();
    // Goal kicks without attempts → —
    const gk = result.metricDisplays.find((m) => m.key === "goalKicks");
    expect(gk?.display).toBe("—");
  });

  it("formats goal kicks only when attempts known", () => {
    const withAttempts = computePlayerFormScore(
      [
        {
          matchRating: 8,
          minutes: 80,
          points: 14,
          result: "W",
          goalKicksMade: 5,
          goalKickAttempts: 6,
        },
      ],
      { positionName: "Fly-Half" },
    );
    expect(withAttempts.metricDisplays.find((m) => m.key === "goalKicks")?.display).toBe(
      "5/6 (83%)",
    );

    const madeOnly = computePlayerFormScore(
      [
        {
          matchRating: 8,
          minutes: 80,
          points: 14,
          result: "W",
          conversions: 3,
          penalties: 2,
        },
      ],
      { positionName: "Fly-Half" },
    );
    expect(madeOnly.metricDisplays.find((m) => m.key === "goalKicks")?.display).toBe("—");
  });

  it("labels Very Good around 7+", () => {
    expect(formLabelForScore(7.4)).toBe("Very Good");
    expect(formLabelForScore(8.2)).toBe("Outstanding");
  });
});

describe("recentFormMetricConfig", () => {
  it("returns fly-half metrics for Fly-Half", () => {
    const keys = recentFormMetricConfig("Fly-Half").map((m) => m.key);
    expect(keys).toEqual(["points", "goalKicks", "tryAssists", "kicks", "lineBreaks"]);
  });

  it("returns prop-relevant metrics for Prop", () => {
    const keys = recentFormMetricConfig("Loosehead Prop").map((m) => m.key);
    expect(keys).toContain("tackles");
    expect(keys).not.toContain("goalKicks");
  });

  it("buildRecentFormMetricDisplays never fabricates zeros", () => {
    const rows = buildRecentFormMetricDisplays("Fly-Half", {
      points: null,
      goalKickMade: null,
      goalKickAttempts: null,
      tryAssists: null,
      kicks: null,
      lineBreaks: null,
      tries: null,
      tackles: null,
      metres: null,
      carries: null,
      turnovers: null,
      defendersBeaten: null,
      avgMatchRating: null,
    });
    expect(rows.every((r) => r.display === "—")).toBe(true);
  });
});
