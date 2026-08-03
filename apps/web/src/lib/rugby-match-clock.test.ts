import { describe, expect, it } from "vitest";
import {
  formatRugbyMatchClockLabel,
  resolveRugbyMatchClock,
  resolveRugbyMatchPeriod,
  sdmsStatusToPeriod,
} from "./rugby-match-clock";

describe("resolveRugbyMatchPeriod", () => {
  it("maps SDMS status strings", () => {
    expect(resolveRugbyMatchPeriod("First Half", null)).toBe("first_half");
    expect(resolveRugbyMatchPeriod("Half Time", null)).toBe("half_time");
    expect(resolveRugbyMatchPeriod("Halftime", null)).toBe("half_time");
    expect(resolveRugbyMatchPeriod("Second Half", null)).toBe("second_half");
    expect(resolveRugbyMatchPeriod("Result", null)).toBe("full_time");
  });
});

describe("formatRugbyMatchClockLabel", () => {
  it("shows HT and FT", () => {
    expect(formatRugbyMatchClockLabel(40, "half_time")).toBe("HT");
    expect(formatRugbyMatchClockLabel(80, "full_time")).toBe("FT");
  });

  it("shows regulation minutes", () => {
    expect(formatRugbyMatchClockLabel(24, "first_half")).toBe("24'");
    expect(formatRugbyMatchClockLabel(58, "second_half")).toBe("58'");
  });

  it("shows stoppage past 40 and 80", () => {
    expect(formatRugbyMatchClockLabel(42, "first_half")).toBe("40+2'");
    expect(formatRugbyMatchClockLabel(84, "second_half")).toBe("80+4'");
  });
});

describe("resolveRugbyMatchClock", () => {
  it("prefers CMS minute for live first half", () => {
    const clock = resolveRugbyMatchClock({
      status: "live",
      period: "first_half",
      matchMinute: 39,
    });
    expect(clock.label).toBe("39'");
    expect(clock.isLive).toBe(true);
  });

  it("returns HT at half time", () => {
    expect(
      resolveRugbyMatchClock({ status: "half_time", period: "half_time", matchMinute: 40 }).label,
    ).toBe("HT");
  });

  it("returns FT at full time", () => {
    expect(
      resolveRugbyMatchClock({ status: "full_time", period: "full_time", matchMinute: 80 }).label,
    ).toBe("FT");
  });
});

describe("sdmsStatusToPeriod", () => {
  it("normalises provider statuses", () => {
    expect(sdmsStatusToPeriod("First Half")).toBe("first_half");
    expect(sdmsStatusToPeriod("Half Time")).toBe("half_time");
  });
});
