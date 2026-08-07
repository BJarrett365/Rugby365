import { describe, expect, it } from "vitest";
import { isRealCompareRosterTeamName } from "./compare-roster-team-name";

describe("isRealCompareRosterTeamName", () => {
  it("keeps real nations and clubs", () => {
    expect(isRealCompareRosterTeamName("France")).toBe(true);
    expect(isRealCompareRosterTeamName("New Zealand")).toBe(true);
    expect(isRealCompareRosterTeamName("South Africa")).toBe(true);
    expect(isRealCompareRosterTeamName("Bath")).toBe(true);
  });

  it("rejects World Cup draw / stage placeholders", () => {
    expect(isRealCompareRosterTeamName("1st Pool A")).toBe(false);
    expect(isRealCompareRosterTeamName("2nd Pool F")).toBe(false);
    expect(isRealCompareRosterTeamName("3rd Pool A/E/F")).toBe(false);
    expect(isRealCompareRosterTeamName("1st")).toBe(false);
    expect(isRealCompareRosterTeamName("Quarter-finals")).toBe(false);
    expect(isRealCompareRosterTeamName("Pool stage")).toBe(false);
    expect(isRealCompareRosterTeamName("Final")).toBe(false);
    expect(isRealCompareRosterTeamName("Winners")).toBe(false);
    expect(isRealCompareRosterTeamName("Runners-up")).toBe(false);
    expect(isRealCompareRosterTeamName("Champions")).toBe(false);
    expect(isRealCompareRosterTeamName("N/A")).toBe(false);
    expect(isRealCompareRosterTeamName("Pool A")).toBe(false);
  });
});
