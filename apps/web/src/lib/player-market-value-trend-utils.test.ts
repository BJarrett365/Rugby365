import { describe, expect, it } from "vitest";
import {
  classifyValueTrend90d,
  deriveLast24MonthsMarketValueTimeline,
  deriveMarketValue30dMovement,
  deriveMarketValue30dMovementAtDate,
  resolveValueTrendEmptyState,
  shouldSaveValueSnapshot,
  type MarketValueSnapshot,
} from "./player-market-value-trend-utils";

function iso(d: string): Date {
  return new Date(d);
}

describe("player-market-value-trend-utils", () => {
  describe("shouldSaveValueSnapshot", () => {
    it("saves first snapshot when no prior history exists", () => {
      const decision = shouldSaveValueSnapshot({
        previousValueGbp: null,
        nextValueGbp: 100_000,
        lastSnapshotAt: null,
      });
      expect(decision.shouldSave).toBe(true);
      expect(decision.reason).toBe("first_snapshot");
    });

    it("saves when value change exceeds 2% threshold", () => {
      const decision = shouldSaveValueSnapshot({
        previousValueGbp: 100_000,
        nextValueGbp: 103_000,
        lastSnapshotAt: iso("2026-08-01T00:00:00.000Z"),
        now: iso("2026-08-05T00:00:00.000Z"),
      });
      expect(decision.shouldSave).toBe(true);
      expect(decision.reason).toBe("value_change_threshold");
    });

    it("skips when change is below threshold in same month", () => {
      const decision = shouldSaveValueSnapshot({
        previousValueGbp: 100_000,
        nextValueGbp: 101_000,
        lastSnapshotAt: iso("2026-08-01T00:00:00.000Z"),
        now: iso("2026-08-05T00:00:00.000Z"),
      });
      expect(decision.shouldSave).toBe(false);
    });

    it("saves on scheduled monthly boundary", () => {
      const decision = shouldSaveValueSnapshot({
        previousValueGbp: 100_000,
        nextValueGbp: 100_500,
        lastSnapshotAt: iso("2026-07-15T00:00:00.000Z"),
        now: iso("2026-08-05T00:00:00.000Z"),
      });
      expect(decision.shouldSave).toBe(true);
      expect(decision.reason).toBe("scheduled_monthly");
    });

    it("saves immediately for material events", () => {
      const decision = shouldSaveValueSnapshot({
        previousValueGbp: 100_000,
        nextValueGbp: 100_100,
        lastSnapshotAt: iso("2026-08-01T00:00:00.000Z"),
        now: iso("2026-08-02T00:00:00.000Z"),
        materialEvent: true,
      });
      expect(decision.shouldSave).toBe(true);
      expect(decision.reason).toBe("material_event");
    });
  });

  describe("resolveValueTrendEmptyState", () => {
    it("returns correct copy for 0, 1, 2–5 and 6+", () => {
      expect(resolveValueTrendEmptyState(0)).toBe("INSUFFICIENT HISTORICAL SNAPSHOTS");
      expect(resolveValueTrendEmptyState(1)).toBe("1 VALUE SNAPSHOT");
      expect(resolveValueTrendEmptyState(2)).toBe("LIMITED HISTORY");
      expect(resolveValueTrendEmptyState(5)).toBe("LIMITED HISTORY");
      expect(resolveValueTrendEmptyState(6)).toBeNull();
    });
  });

  it("computes 30-day market value change from stored snapshots", () => {
    const now = iso("2026-08-11T12:00:00.000Z");
    const snapshots: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T12:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.6 },
      { snapshotAt: iso("2026-07-12T12:00:00.000Z"), marketValueGbp: 80_000, confidence: 0.55 },
    ];

    const movement = deriveMarketValue30dMovement({ snapshots, now, toleranceDays: 15 });
    expect(movement.state).toBe("OK");
    expect(movement.changePct).toBe(25);
    expect(movement.movementLabel).toMatch(/▲ \+25%/);
  });

  it("flags 30-day change as insufficient when earlier snapshot missing", () => {
    const now = iso("2026-08-11T12:00:00.000Z");
    const snapshots: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T12:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.6 },
      { snapshotAt: iso("2026-06-01T12:00:00.000Z"), marketValueGbp: 80_000, confidence: 0.55 },
    ];

    const movement = deriveMarketValue30dMovement({ snapshots, now, toleranceDays: 15 });
    expect(movement.state).toBe("INSUFFICIENT");
    expect(movement.changePct).toBeNull();
  });

  it("classifies 90-day trend as rising/stable/falling", () => {
    const now = iso("2026-08-11T12:00:00.000Z");
    const rising: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T00:00:00.000Z"), marketValueGbp: 120_000, confidence: 0.6 },
      { snapshotAt: iso("2026-05-12T00:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.6 },
    ];
    expect(classifyValueTrend90d({ snapshots: rising, now }).trend).toBe("Rising");

    const stable: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T00:00:00.000Z"), marketValueGbp: 102_000, confidence: 0.6 },
      { snapshotAt: iso("2026-05-12T00:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.6 },
    ];
    expect(classifyValueTrend90d({ snapshots: stable, now }).trend).toBe("Stable");

    const falling: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T00:00:00.000Z"), marketValueGbp: 90_000, confidence: 0.6 },
      { snapshotAt: iso("2026-05-12T00:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.6 },
    ];
    expect(classifyValueTrend90d({ snapshots: falling, now }).trend).toBe("Falling");
  });

  it("derives timeline state from point count without fabricating points", () => {
    const now = iso("2026-08-11T12:00:00.000Z");
    const onePoint: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T00:00:00.000Z"), marketValueGbp: 130_000, confidence: 0.5 },
    ];
    const one = deriveLast24MonthsMarketValueTimeline({ snapshots: onePoint, now });
    expect(one.state).toBe("INSUFFICIENT");
    expect(one.pointCount).toBe(1);
    expect(one.points).toHaveLength(1);

    const threePoints: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-02-01T00:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.5 },
      { snapshotAt: iso("2026-05-01T00:00:00.000Z"), marketValueGbp: 110_000, confidence: 0.5 },
      { snapshotAt: iso("2026-08-11T00:00:00.000Z"), marketValueGbp: 130_000, confidence: 0.5 },
    ];
    const ok = deriveLast24MonthsMarketValueTimeline({ snapshots: threePoints, now });
    expect(ok.state).toBe("OK");
    expect(ok.limitedHistory).toBe(true); // 3 points still < 6
    expect(ok.points[1]?.changeSincePreviousPct).toBe(10);
  });

  it("computes per-point 30-day change for tooltip metadata", () => {
    const snapshots: MarketValueSnapshot[] = [
      { snapshotAt: iso("2026-08-11T00:00:00.000Z"), marketValueGbp: 100_000, confidence: 0.6 },
      { snapshotAt: iso("2026-07-12T00:00:00.000Z"), marketValueGbp: 80_000, confidence: 0.55 },
    ];
    const pct = deriveMarketValue30dMovementAtDate({
      snapshots,
      anchor: iso("2026-08-11T00:00:00.000Z"),
      toleranceDays: 15,
    });
    expect(pct).toBe(25);
  });
});
