import { describe, expect, it } from "vitest";
import {
  teamMatchScoringPoints,
  teamStatSectionNumber,
} from "./competition-team-stat-display";

describe("teamMatchScoringPoints", () => {
  it("scores tries, conversions, penalties and drop goals", () => {
    expect(
      teamMatchScoringPoints({ tries: 5, conversions: 3, penalties: 1, dropGoals: 0 }),
    ).toBe(5 * 5 + 3 * 2 + 3);
  });
});

describe("teamStatSectionNumber", () => {
  it("reads nested attack offloads", () => {
    expect(
      teamStatSectionNumber(
        { attack: { offloads: 12, clean_breaks: 4 } },
        ["attack", "offloads"],
      ),
    ).toBe(12);
  });

  it("returns 0 for missing paths", () => {
    expect(teamStatSectionNumber({}, ["attack", "offloads"])).toBe(0);
  });
});
