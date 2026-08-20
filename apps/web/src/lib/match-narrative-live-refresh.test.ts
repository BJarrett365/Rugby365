import { describe, expect, it } from "vitest";
import {
  buildNarrativeRefreshSignature,
  narrativeProgressBucket,
} from "./match-narrative-live-refresh-utils";

describe("narrative live refresh signature", () => {
  it("uses 1-minute buckets so second-level ticks do not force rebuilds", () => {
    expect(narrativeProgressBucket(0)).toBe(0);
    expect(narrativeProgressBucket(0.9)).toBe(0);
    expect(narrativeProgressBucket(4)).toBe(4);
    expect(narrativeProgressBucket(4.8)).toBe(4);
    expect(narrativeProgressBucket(5)).toBe(5);
    expect(narrativeProgressBucket(14)).toBe(14);
  });

  it("changes when events, score, status, or minute move", () => {
    const base = {
      status: "live",
      period: "first_half",
      homeScore: 0,
      awayScore: 0,
      matchMinute: 10,
      eventCount: 2,
      maxSequence: 2,
    };
    const a = buildNarrativeRefreshSignature(base);
    expect(buildNarrativeRefreshSignature({ ...base, eventCount: 3, maxSequence: 3 })).not.toBe(a);
    expect(buildNarrativeRefreshSignature({ ...base, homeScore: 5 })).not.toBe(a);
    expect(buildNarrativeRefreshSignature({ ...base, status: "half_time" })).not.toBe(a);
    expect(buildNarrativeRefreshSignature({ ...base, matchMinute: 10.4 })).toBe(a);
    expect(buildNarrativeRefreshSignature({ ...base, matchMinute: 11 })).not.toBe(a);
  });
});
