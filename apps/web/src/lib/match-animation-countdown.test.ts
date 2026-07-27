import { describe, expect, it } from "vitest";
import {
  countdownUrgency,
  effectiveKickoffIso,
  estimateServerNowMs,
  formatCountdownDisplay,
  parseCountdownParts,
  remainingMs,
} from "./match-animation-countdown";

describe("match-animation-countdown", () => {
  it("computes remaining from server timestamps", () => {
    const target = Date.parse("2026-07-26T15:00:00.000Z");
    const now = Date.parse("2026-07-26T14:41:28.000Z");
    expect(remainingMs(target, now)).toBe(18 * 60_000 + 32_000);
  });

  it("formats with days when over 24h", () => {
    const parts = parseCountdownParts(2 * 86400_000 + 4 * 3600_000 + 18 * 60_000 + 32_000);
    expect(formatCountdownDisplay(parts)).toBe("2 DAYS 04:18:32");
  });

  it("formats under a day as HH:MM:SS", () => {
    const parts = parseCountdownParts(18 * 60_000 + 32_000);
    expect(formatCountdownDisplay(parts)).toBe("00:18:32");
  });

  it("classifies urgency bands", () => {
    expect(countdownUrgency(700_000)).toBe("normal");
    expect(countdownUrgency(500_000)).toBe("under_10m");
    expect(countdownUrgency(45_000)).toBe("under_1m");
    expect(countdownUrgency(0)).toBe("zero");
  });

  it("uses revised kick-off when delayed", () => {
    expect(
      effectiveKickoffIso({
        scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
        kickOffDelayed: true,
        revisedKickoffAt: "2026-07-26T15:30:00.000Z",
      }),
    ).toBe("2026-07-26T15:30:00.000Z");
  });

  it("returns null when delayed without revised time", () => {
    expect(
      effectiveKickoffIso({
        scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
        kickOffDelayed: true,
        revisedKickoffAt: null,
      }),
    ).toBeNull();
  });

  it("estimates server now from anchor after tab sleep", () => {
    const estimated = estimateServerNowMs({
      serverNowIso: "2026-07-26T14:00:00.000Z",
      clientReceivedAtMs: 1_000_000,
      nowMs: 1_000_000 + 90_000,
    });
    expect(estimated).toBe(Date.parse("2026-07-26T14:01:30.000Z"));
  });
});
