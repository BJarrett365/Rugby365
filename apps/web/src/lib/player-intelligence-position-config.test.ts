import { describe, expect, it } from "vitest";
import {
  buildRadarMetricValues,
  canDrawRadarPolygon,
  countValidRadarMetrics,
  formatPeerAverageLabel,
  getPositionIntelligenceConfig,
  resolveIntelligencePositionGroup,
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
        source: "static",
      }),
    ).toBe("Avg Fly-Half (Global)");
  });
});
