import { describe, expect, it } from "vitest";
import type { MarketValueSnapshot } from "./player-market-value-trend-utils";
import {
  aggregateCareerDisplayPoints,
  buildValueTimelineSummary,
  classifyValueTimelineTrend,
  computeAnnualisedGrowthPaPct,
  deriveCareerValueTimeline,
  formatAvgGrowthLabel,
  resolveValueTimelineEmptyState,
} from "./player-value-timeline-utils";

function snap(date: string, value: number, confidence = 0.8): MarketValueSnapshot {
  return {
    snapshotAt: new Date(date),
    marketValueGbp: value,
    confidence,
  };
}

describe("player-value-timeline-utils", () => {
  describe("empty states", () => {
    it("reports VALUE HISTORY BUILDING for 0 snapshots", () => {
      const e = resolveValueTimelineEmptyState(0);
      expect(e.emptyState).toBe("VALUE HISTORY BUILDING");
    });

    it("reports 1 VALUE SNAPSHOT for a single point", () => {
      const e = resolveValueTimelineEmptyState(1);
      expect(e.emptyState).toBe("1 VALUE SNAPSHOT");
    });
  });

  describe("summary with one snapshot (Pollard-thin)", () => {
    it("sets current=highest=lowest and leaves growth/trend blank", () => {
      const summary = buildValueTimelineSummary([snap("2026-08-11T00:00:00.000Z", 35_000)], {
        now: new Date("2026-08-11T12:00:00.000Z"),
      });
      expect(summary.snapshotCount).toBe(1);
      expect(summary.currentGbp).toBe(35_000);
      expect(summary.highestGbp).toBe(35_000);
      expect(summary.lowestGbp).toBe(35_000);
      expect(summary.avgGrowthPaPct).toBeNull();
      expect(summary.avgGrowthLabel).toBe("—");
      expect(summary.trend).toBeNull();
      expect(summary.emptyState).toBe("1 VALUE SNAPSHOT");
    });
  });

  describe("annualised growth", () => {
    it("computes ~18% p/a over multi-year span", () => {
      const pct = computeAnnualisedGrowthPaPct({
        startGbp: 1_600_000,
        endGbp: 3_100_000,
        startAt: new Date("2021-01-01T00:00:00.000Z"),
        endAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      expect(pct).not.toBeNull();
      expect(pct!).toBeGreaterThan(10);
      expect(pct!).toBeLessThan(25);
      expect(formatAvgGrowthLabel(pct)).toMatch(/\+?\d+% p\/a/);
    });

    it("returns null when history is shorter than 6 months", () => {
      const pct = computeAnnualisedGrowthPaPct({
        startGbp: 100_000,
        endGbp: 120_000,
        startAt: new Date("2026-01-01T00:00:00.000Z"),
        endAt: new Date("2026-03-01T00:00:00.000Z"),
      });
      expect(pct).toBeNull();
    });
  });

  describe("trend", () => {
    it("classifies rising from recent window using central thresholds", () => {
      const result = classifyValueTimelineTrend({
        snapshots: [
          snap("2025-09-01T00:00:00.000Z", 100_000),
          snap("2025-12-01T00:00:00.000Z", 108_000),
          snap("2026-03-01T00:00:00.000Z", 115_000),
        ],
        now: new Date("2026-03-15T00:00:00.000Z"),
      });
      expect(result.trend).toBe("Rising");
    });

    it("returns null trend with a single snapshot", () => {
      const result = classifyValueTimelineTrend({
        snapshots: [snap("2026-08-11T00:00:00.000Z", 35_000)],
        now: new Date("2026-08-11T12:00:00.000Z"),
      });
      expect(result.trend).toBeNull();
    });
  });

  describe("career aggregation", () => {
    it("keeps all points when few snapshots", () => {
      const derived = deriveCareerValueTimeline({
        snapshots: [
          snap("2025-01-01T00:00:00.000Z", 1_000_000),
          snap("2026-01-01T00:00:00.000Z", 1_200_000),
        ],
        now: new Date("2026-08-01T00:00:00.000Z"),
      });
      expect(derived.allPoints).toHaveLength(2);
      expect(derived.displayPoints).toHaveLength(2);
      expect(derived.summary.currentGbp).toBe(1_200_000);
    });

    it("never fabricates annual points from thin data", () => {
      const points = aggregateCareerDisplayPoints([
        { dateIso: "2025-06-01T00:00:00.000Z", marketValueGbp: 3_300_000, confidence: 0.8 },
        { dateIso: "2026-06-01T00:00:00.000Z", marketValueGbp: 3_100_000, confidence: 0.9 },
      ]);
      expect(points).toHaveLength(2);
    });

    it("ignores zero / invalid estimates in summary", () => {
      const summary = buildValueTimelineSummary(
        [snap("2024-01-01T00:00:00.000Z", 0), snap("2025-01-01T00:00:00.000Z", 100_000)],
        { now: new Date("2026-01-01T00:00:00.000Z") },
      );
      expect(summary.snapshotCount).toBe(1);
      expect(summary.lowestGbp).toBe(100_000);
    });
  });
});
