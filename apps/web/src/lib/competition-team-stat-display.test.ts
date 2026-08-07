import { describe, expect, it } from "vitest";
import {
  teamMatchScoringPoints,
  teamMatchStatsProviderPriority,
  teamStatSectionNumber,
  tryPointsForSeasonYear,
} from "./competition-team-stat-display";

describe("tryPointsForSeasonYear", () => {
  it("uses 4pts before 1992 and 5pts after", () => {
    expect(tryPointsForSeasonYear(1987)).toBe(4);
    expect(tryPointsForSeasonYear(1991)).toBe(4);
    expect(tryPointsForSeasonYear(1995)).toBe(5);
  });
});

describe("teamMatchScoringPoints", () => {
  it("scores tries, conversions, penalties and drop goals (modern)", () => {
    expect(
      teamMatchScoringPoints({ tries: 5, conversions: 3, penalties: 1, dropGoals: 0 }),
    ).toBe(5 * 5 + 3 * 2 + 3);
  });

  it("uses 4pt tries for pre-1992 seasons", () => {
    expect(
      teamMatchScoringPoints(
        { tries: 5, conversions: 3, penalties: 1, dropGoals: 0 },
        { seasonYear: 1987 },
      ),
    ).toBe(5 * 4 + 3 * 2 + 3);
  });

  it("prefers stored match points from sections", () => {
    expect(
      teamMatchScoringPoints(
        { tries: 5, conversions: 0, penalties: 0, dropGoals: 0 },
        { seasonYear: 1987, sections: { scoring: { match_points: 70 } } },
      ),
    ).toBe(70);
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

describe("teamMatchStatsProviderPriority", () => {
  it("ranks SDMS above historical rollup", () => {
    expect(teamMatchStatsProviderPriority("sdms")).toBeGreaterThan(
      teamMatchStatsProviderPriority("rwc_player_rollup"),
    );
  });
});
