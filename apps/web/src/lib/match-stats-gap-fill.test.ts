import { describe, expect, it } from "vitest";
import { inferGapFillMinutes, isStarterSquadRole } from "./match-stats-gap-fill";

describe("isStarterSquadRole", () => {
  it("treats jersey 1–15 as starters", () => {
    expect(isStarterSquadRole(null, 4)).toBe(true);
    expect(isStarterSquadRole(null, 7)).toBe(true);
  });

  it("treats jersey 16+ as replacements", () => {
    expect(isStarterSquadRole(null, 20)).toBe(false);
  });

  it("respects explicit role text", () => {
    expect(isStarterSquadRole("replacement", 4)).toBe(false);
    expect(isStarterSquadRole("starter", 20)).toBe(true);
  });
});

describe("inferGapFillMinutes", () => {
  it("gives full match to starters who were not subbed off", () => {
    expect(inferGapFillMinutes({ starter: true })).toBe(80);
  });

  it("uses sub-off minute for starters", () => {
    expect(inferGapFillMinutes({ starter: true, subOffMinute: 49 })).toBe(49);
  });

  it("infers minutes for used replacements", () => {
    expect(inferGapFillMinutes({ starter: false, subOnMinute: 43 })).toBe(37);
    expect(inferGapFillMinutes({ starter: false, subOnMinute: 43, subOffMinute: 70 })).toBe(27);
  });

  it("returns null for unused bench", () => {
    expect(inferGapFillMinutes({ starter: false })).toBeNull();
  });
});
