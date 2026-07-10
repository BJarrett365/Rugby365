import { describe, expect, it } from "vitest";
import { isPlayoffRound, isRegularSeasonRound } from "./round-utils";

describe("isPlayoffRound", () => {
  it("treats regular rounds as not playoffs", () => {
    expect(isPlayoffRound("Round 12")).toBe(false);
    expect(isRegularSeasonRound("Round 12")).toBe(true);
  });

  it("detects playoff and knockout rounds", () => {
    expect(isPlayoffRound("Semi-final")).toBe(true);
    expect(isPlayoffRound("Play-off")).toBe(true);
    expect(isPlayoffRound("Final")).toBe(true);
    expect(isRegularSeasonRound("Final")).toBe(false);
  });
});
