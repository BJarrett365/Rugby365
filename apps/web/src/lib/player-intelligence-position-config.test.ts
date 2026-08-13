import { describe, expect, it } from "vitest";
import {
  buildRadarMetricValues,
  canDrawRadarPolygon,
  countValidRadarMetrics,
  formatPeerAverageLabel,
  getPositionIntelligenceConfig,
  resolveAppearancePassingPosition,
  resolveIntelligencePositionGroup,
  resolvePassingPitchZoneWeights,
} from "./player-intelligence-position-config";

describe("player-intelligence-position-config", () => {
  it("resolves fly-half axes for Pollard-style positions", () => {
    expect(resolveIntelligencePositionGroup("Fly-Half")).toBe("fly_half");
    const cfg = getPositionIntelligenceConfig("Fly Half");
    expect(cfg.radarAxes.map((a) => a.label)).toEqual([
      "Attack",
      "Playmaking",
      "Kicking",
      "Game Management",
      "Defence",
      "Physical",
    ]);
    expect(cfg.minRadarMetrics).toBe(4);
  });

  it("never coerces null scores to 0", () => {
    const metrics = buildRadarMetricValues({
      axes: getPositionIntelligenceConfig("Fly-Half").radarAxes,
      playerScores: {
        attack: 85,
        playmaking: null,
        kicking: 94,
        gameManagement: 88,
        defence: undefined,
        physical: 74,
      },
    });
    expect(metrics.find((m) => m.key === "playmaking")?.score).toBeNull();
    expect(metrics.find((m) => m.key === "defence")?.score).toBeNull();
    expect(metrics.find((m) => m.key === "attack")?.score).toBe(85);
    expect(countValidRadarMetrics(metrics)).toBe(4);
  });

  it("blocks polygon when fewer than 4/6 metrics are valid", () => {
    const metrics = buildRadarMetricValues({
      axes: getPositionIntelligenceConfig("Fly-Half").radarAxes,
      playerScores: {
        attack: 80,
        playmaking: 82,
        kicking: null,
        gameManagement: null,
        defence: null,
        physical: null,
      },
    });
    expect(canDrawRadarPolygon(metrics, 4)).toBe(false);
  });

  it("allows polygon at exactly 4 valid metrics", () => {
    const metrics = buildRadarMetricValues({
      axes: getPositionIntelligenceConfig("Fly-Half").radarAxes,
      playerScores: {
        attack: 80,
        playmaking: 82,
        kicking: 90,
        gameManagement: 85,
        defence: null,
        physical: null,
      },
    });
    expect(canDrawRadarPolygon(metrics, 4)).toBe(true);
  });

  it("labels peer fallback cohorts explicitly", () => {
    expect(
      formatPeerAverageLabel({
        peerLabel: "Fly-Half",
        competitionName: "URC",
        source: "cohort",
      }),
    ).toBe("Avg Fly-Half (URC)");
    expect(
      formatPeerAverageLabel({
        peerLabel: "Fly-Half",
        competitionName: "United Rugby Championship",
        source: "cohort",
      }),
    ).toBe("Avg Fly-Half (URC)");
    expect(
      formatPeerAverageLabel({
        peerLabel: "Fly-Half",
        source: "static",
      }),
    ).toBe("Avg Fly-Half (Global)");
  });
});

describe("passing pitch zone weights", () => {
  it("puts fly-half (and jersey 10) in middle centre", () => {
    expect(resolvePassingPitchZoneWeights("Fly-Half")).toEqual([
      { key: "middle_centre", weight: 1 },
    ]);
    expect(resolvePassingPitchZoneWeights(null, 10)).toEqual([
      { key: "middle_centre", weight: 1 },
    ]);
  });

  it("maps wings by side and splits unknown-side wing wide", () => {
    expect(resolvePassingPitchZoneWeights("Left Wing")).toEqual([
      { key: "attacking_left", weight: 1 },
    ]);
    expect(resolvePassingPitchZoneWeights("Wing")).toEqual([
      { key: "attacking_left", weight: 0.5 },
      { key: "attacking_right", weight: 0.5 },
    ]);
  });

  it("returns null for unknown position instead of dumping into centre", () => {
    expect(resolvePassingPitchZoneWeights("Replacement", 22)).toBeNull();
    expect(resolvePassingPitchZoneWeights(null, null)).toBeNull();
  });

  it("falls back from bench role to jersey 1–15 then primary", () => {
    expect(
      resolveAppearancePassingPosition({
        matchPositionName: "Replacement",
        jerseyNumber: 10,
        primaryPositionName: "Full-Back",
      }),
    ).toEqual({ positionName: null, jerseyNumber: 10 });
    expect(resolvePassingPitchZoneWeights(null, 10)?.[0]?.key).toBe("middle_centre");
    expect(
      resolveAppearancePassingPosition({
        matchPositionName: "Replacement",
        jerseyNumber: 22,
        primaryPositionName: "Fly-Half",
      }),
    ).toEqual({ positionName: "Fly-Half", jerseyNumber: null });
  });
});
