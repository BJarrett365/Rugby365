import { describe, expect, it } from "vitest";
import {
  buildMomentumBuckets,
  exclusivePossessionBars,
  MOMENTUM_BUCKETS,
  resolveMomentumElapsedMinute,
} from "./match-momentum";

describe("resolveMomentumElapsedMinute", () => {
  it("is 0 before kick-off", () => {
    expect(resolveMomentumElapsedMinute({ status: "scheduled", eventMinutes: [12] })).toBe(0);
    expect(resolveMomentumElapsedMinute({ status: "NS" })).toBe(0);
  });

  it("uses clock and events while live", () => {
    expect(
      resolveMomentumElapsedMinute({ status: "live", matchMinute: 18, eventMinutes: [12, 22] }),
    ).toBe(22);
  });

  it("fills the chart after full time", () => {
    expect(resolveMomentumElapsedMinute({ status: "finished", eventMinutes: [74] })).toBe(80);
  });
});

describe("exclusivePossessionBars", () => {
  it("blanks the non-possessing side", () => {
    const homeWin = exclusivePossessionBars(0.62, 0.38);
    expect(homeWin.possession).toBe("home");
    expect(homeWin.home).toBeGreaterThan(0);
    expect(homeWin.away).toBe(0);

    const awayWin = exclusivePossessionBars(0.4, 0.6);
    expect(awayWin.possession).toBe("away");
    expect(awayWin.away).toBeGreaterThan(0);
    expect(awayWin.home).toBe(0);
  });

  it("stays blank when shares are equal", () => {
    expect(exclusivePossessionBars(0.5, 0.5)).toEqual({
      home: 0,
      away: 0,
      possession: null,
    });
  });
});

describe("buildMomentumBuckets", () => {
  it("starts blank and only fills played minutes", () => {
    const buckets = buildMomentumBuckets({
      homeFirst: 0.6,
      awayFirst: 0.4,
      homeSecond: 0.55,
      awaySecond: 0.45,
      elapsedMinute: 10,
    });
    expect(buckets).toHaveLength(MOMENTUM_BUCKETS);
    const filled = buckets.filter((b) => b.possession != null);
    const blank = buckets.filter((b) => b.possession == null);
    expect(filled.length).toBeGreaterThan(0);
    expect(filled.length).toBeLessThan(MOMENTUM_BUCKETS);
    expect(blank.length).toBeGreaterThan(0);
    for (const b of filled) {
      expect(b.home === 0 || b.away === 0).toBe(true);
      expect(b.home > 0 && b.away > 0).toBe(false);
    }
  });

  it("is fully blank before kick-off", () => {
    const buckets = buildMomentumBuckets({
      homeFirst: 0.6,
      awayFirst: 0.4,
      homeSecond: 0.5,
      awaySecond: 0.5,
      elapsedMinute: 0,
    });
    expect(buckets.every((b) => b.home === 0 && b.away === 0)).toBe(true);
  });
});
