import { describe, expect, it } from "vitest";
import {
  buildRatingHistorySummary,
  computeRatingHistoryTrend,
  extractRatingMetricSeries,
  formatRatingTrendLabel,
  resolveRatingHistoryEmptyState,
  RATING_HISTORY_Y_MAX,
  RATING_HISTORY_Y_MIN,
} from "./player-rating-history-utils";

describe("player-rating-history-utils", () => {
  describe("empty states", () => {
    it("covers 0 / 1 / 2 snapshots", () => {
      expect(resolveRatingHistoryEmptyState(0).emptyState).toBe("RATING HISTORY BUILDING");
      expect(resolveRatingHistoryEmptyState(1).emptyState).toBe("1 RATING SNAPSHOT");
      expect(resolveRatingHistoryEmptyState(2).emptyState).toBe("LIMITED RATING HISTORY");
      expect(resolveRatingHistoryEmptyState(3).emptyState).toBeNull();
    });
  });

  describe("summary + trend", () => {
    it("computes best / average / lowest and trend vs prior 5", () => {
      const summary = buildRatingHistorySummary([
        { dateIso: "2021-01-01T00:00:00.000Z", value: 70 },
        { dateIso: "2022-01-01T00:00:00.000Z", value: 75 },
        { dateIso: "2023-01-01T00:00:00.000Z", value: 80 },
        { dateIso: "2024-01-01T00:00:00.000Z", value: 82 },
        { dateIso: "2025-01-01T00:00:00.000Z", value: 85 },
        { dateIso: "2026-01-01T00:00:00.000Z", value: 88 },
      ]);
      expect(summary.best).toBe(88);
      expect(summary.lowest).toBe(70);
      expect(summary.average).toBe(80);
      // current 88 − avg(70,75,80,82,85)=78.4 → +10
      expect(summary.trend).toBe(10);
      expect(formatRatingTrendLabel(summary.trend)).toBe("+10 ↑");
    });

    it("leaves trend blank with a single snapshot", () => {
      const summary = buildRatingHistorySummary([
        { dateIso: "2026-08-11T00:00:00.000Z", value: 72 },
      ]);
      expect(summary.best).toBe(72);
      expect(summary.average).toBe(72);
      expect(summary.lowest).toBe(72);
      expect(summary.trend).toBeNull();
      expect(summary.trendLabel).toBe("—");
    });

    it("uses fixed Y bounds constants (no micro-zoom)", () => {
      expect(RATING_HISTORY_Y_MIN).toBe(40);
      expect(RATING_HISTORY_Y_MAX).toBe(100);
    });
  });

  describe("metric extraction", () => {
    it("skips match_performance rows for overall ability series", () => {
      const series = extractRatingMetricSeries(
        [
          {
            date: "2025-01-01T00:00:00.000Z",
            overall: 72,
            attack: 70,
            defence: 60,
            kicking: 80,
            playmaking: 75,
            gameManagement: 78,
            physical: 65,
            form: 70,
            seriesKind: "overall_ability",
          },
          {
            date: "2025-02-01T00:00:00.000Z",
            overall: 68,
            attack: null,
            defence: null,
            kicking: null,
            playmaking: null,
            gameManagement: null,
            physical: null,
            form: null,
            seriesKind: "match_performance",
          },
        ],
        "overall",
      );
      expect(series).toHaveLength(1);
      expect(series[0]!.value).toBe(72);
    });

    it("reads dimension series without recalculating", () => {
      const series = extractRatingMetricSeries(
        [
          {
            date: "2025-01-01T00:00:00.000Z",
            overall: 80,
            attack: 85,
            defence: 60,
            kicking: 90,
            playmaking: 82,
            gameManagement: 88,
            physical: 70,
            form: 75,
            seriesKind: "overall_ability",
          },
        ],
        "kicking",
      );
      expect(series).toHaveLength(1);
      expect(series[0]!.value).toBe(90);
    });
  });

  describe("computeRatingHistoryTrend", () => {
    it("returns null for fewer than 2 values", () => {
      expect(computeRatingHistoryTrend([80])).toBeNull();
    });
  });
});
