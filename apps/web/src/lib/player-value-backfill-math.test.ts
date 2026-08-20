import { describe, expect, it } from "vitest";
import {
  ageAtDate,
  assessValueBackfillCoverage,
  listMonthEndSnapshots,
  shouldSkipBackfillForExistingSnapshot,
  yearMonthKey,
  type ValueBackfillPresence,
} from "./player-value-backfill-math";
import {
  buildValueTrendYTicks,
  deriveLast24MonthsMarketValueTimeline,
  formatValueTrendYAxisLabel,
  resolveValueTrendEmptyState,
  resolveValueTrendHelperText,
} from "./player-market-value-trend-utils";

function present(overrides: Partial<ValueBackfillPresence> = {}): ValueBackfillPresence {
  return {
    age: true,
    club: true,
    competition: true,
    international: true,
    rating: true,
    form: true,
    position: true,
    contract: false,
    availability: true,
    potential: false,
    ...overrides,
  };
}

describe("player-value-backfill-math", () => {
  it("skips months below coverage threshold or missing core factors", () => {
    const ok = assessValueBackfillCoverage(present());
    expect(ok.canCalculate).toBe(true);
    expect(ok.coveragePct).toBeGreaterThanOrEqual(65);

    const missingRating = assessValueBackfillCoverage(present({ rating: false }));
    expect(missingRating.canCalculate).toBe(false);
    expect(missingRating.coreMissing).toContain("rating");

    const thin = assessValueBackfillCoverage(
      present({
        international: false,
        form: false,
        contract: false,
        availability: false,
        club: false,
      }),
    );
    expect(thin.canCalculate).toBe(false);
    expect(thin.coveragePct).toBeLessThan(65);
  });

  it("never allows BACKFILLED write over a LIVE row in the same month", () => {
    const decision = shouldSkipBackfillForExistingSnapshot({
      candidateMonthKey: "2026-08",
      existing: [
        {
          snapshotType: "LIVE",
          snapshotAt: new Date("2026-08-11T10:22:25.915Z"),
        },
      ],
    });
    expect(decision.skip).toBe(true);
    expect(decision.reason).toBe("live_exists_same_month");
  });

  it("computes time-correct age from DOB + snapshot date", () => {
    // Pollard DOB 1994-03-11 → age 30 on 2024-09-30, age 31 on 2025-03-31
    expect(ageAtDate("1994-03-11", new Date("2024-09-30T23:59:59.999Z"))).toBe(30);
    expect(ageAtDate("1994-03-11", new Date("2025-03-31T23:59:59.999Z"))).toBe(31);
    expect(ageAtDate("1994-03-11", new Date("2025-03-10T12:00:00.000Z"))).toBe(30);
  });

  it("lists month-end snapshots oldest→newest without forcing incomplete current month", () => {
    const ends = listMonthEndSnapshots({
      now: new Date("2026-08-11T12:00:00.000Z"),
      months: 6,
      includeCurrentMonth: false,
    });
    expect(ends).toHaveLength(6);
    expect(yearMonthKey(ends[0]!)).toBe("2026-02");
    expect(yearMonthKey(ends[5]!)).toBe("2026-07");
    expect(ends[5]!.getUTCDate()).toBe(31);
  });
});

describe("value trend limited-history UX helpers", () => {
  it("returns empty/limited copy for 0/1/2–5 and none at 6+", () => {
    expect(resolveValueTrendEmptyState(0)).toBe("INSUFFICIENT HISTORICAL SNAPSHOTS");
    expect(resolveValueTrendEmptyState(1)).toBe("1 VALUE SNAPSHOT");
    expect(resolveValueTrendEmptyState(2)).toBe("LIMITED HISTORY");
    expect(resolveValueTrendEmptyState(5)).toBe("LIMITED HISTORY");
    expect(resolveValueTrendEmptyState(6)).toBeNull();
    expect(resolveValueTrendHelperText(1)).toMatch(/another historical\/current snapshot/i);
  });

  it("marks limitedHistory for 2–5 points and clears at 6+", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const two = deriveLast24MonthsMarketValueTimeline({
      now,
      snapshots: [
        { snapshotAt: new Date("2026-06-01T00:00:00.000Z"), marketValueGbp: 30_000, confidence: 0.7 },
        { snapshotAt: new Date("2026-08-11T00:00:00.000Z"), marketValueGbp: 35_000, confidence: 0.9 },
      ],
    });
    expect(two.limitedHistory).toBe(true);

    const six = deriveLast24MonthsMarketValueTimeline({
      now,
      snapshots: [1, 2, 3, 4, 5, 6].map((m) => ({
        snapshotAt: new Date(`2026-0${m}-28T00:00:00.000Z`),
        marketValueGbp: 30_000 + m * 1000,
        confidence: 0.7,
      })),
    });
    expect(six.pointCount).toBe(6);
    expect(six.limitedHistory).toBe(false);
  });

  it("builds one-point Y-scale around £35k as £0/£20k/£40k/£60k/£80k", () => {
    const { min, max, ticks } = buildValueTrendYTicks([35_000]);
    expect(min).toBe(0);
    expect(max).toBe(80_000);
    expect(ticks).toEqual([0, 20_000, 40_000, 60_000, 80_000]);
    expect(ticks.map(formatValueTrendYAxisLabel)).toEqual(["£0", "£20k", "£40k", "£60k", "£80k"]);
  });
});
