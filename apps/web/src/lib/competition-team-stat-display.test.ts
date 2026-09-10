import { describe, expect, it } from "vitest";
import {
  mergeTeamMatchStatRows,
  teamAdvancedCoverageComplete,
  teamLeaderboardEmptyMessage,
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
    expect(teamMatchStatsProviderPriority("sdms")).toBeGreaterThan(
      teamMatchStatsProviderPriority("trc_event_rollup"),
    );
  });
});

describe("mergeTeamMatchStatRows", () => {
  it("fills Wikipedia scoring when SDMS shells are all zeros", () => {
    const merged = mergeTeamMatchStatRows([
      {
        sourceProvider: "sdms",
        tries: 0,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        sections: {},
      },
      {
        sourceProvider: "trc_event_rollup",
        tries: 3,
        conversions: 2,
        penalties: 4,
        dropGoals: 0,
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        sections: { scoring: { match_points: 27 } },
      },
    ]);
    expect(merged).toMatchObject({ tries: 3, conversions: 2, penalties: 4 });
    expect(teamStatSectionNumber(merged.sections, ["scoring", "match_points"])).toBe(27);
  });

  it("keeps SDMS Opta metrics and still fills missing scoring", () => {
    const merged = mergeTeamMatchStatRows([
      {
        sourceProvider: "sdms",
        tries: 2,
        conversions: 1,
        penalties: 0,
        dropGoals: 0,
        metres: 480,
        carries: 110,
        tackles: 140,
        turnoversWon: 8,
        sections: { attack: { offloads: 12, clean_breaks: 5, defenders_beaten: 20 } },
      },
      {
        sourceProvider: "trc_event_rollup",
        tries: 2,
        conversions: 1,
        penalties: 3,
        dropGoals: 0,
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        sections: { scoring: { match_points: 19 } },
      },
    ]);
    expect(merged).toMatchObject({
      tries: 2,
      penalties: 3,
      metres: 480,
      tackles: 140,
    });
    expect(teamStatSectionNumber(merged.sections, ["attack", "offloads"])).toBe(12);
    expect(teamStatSectionNumber(merged.sections, ["scoring", "match_points"])).toBe(19);
  });

  it("does not let incomplete SDMS kick counts replace match-sheet penalties", () => {
    const merged = mergeTeamMatchStatRows([
      {
        sourceProvider: "sdms",
        tries: 2,
        conversions: 1,
        penalties: 1,
        dropGoals: 0,
        metres: 400,
        carries: 90,
        tackles: 120,
        turnoversWon: 6,
        sections: {},
      },
      {
        sourceProvider: "trc_event_rollup",
        tries: 2,
        conversions: 2,
        penalties: 4,
        dropGoals: 0,
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        sections: { scoring: { match_points: 24 } },
      },
    ]);
    expect(merged).toMatchObject({
      tries: 2,
      conversions: 2,
      penalties: 4,
      tackles: 120,
    });
  });
});

describe("teamLeaderboardEmptyMessage", () => {
  it("explains untracked Opta metrics when only scoring exists", () => {
    expect(
      teamLeaderboardEmptyMessage({ hasTrackedData: false, teamCount: 4 }),
    ).toBe("These statistics were not recorded for this season.");
  });

  it("explains 2026 was not held", () => {
    expect(
      teamLeaderboardEmptyMessage({ hasTrackedData: false, teamCount: 0, notHeld: true }),
    ).toBe("The Rugby Championship was not held this season.");
  });
});

describe("teamAdvancedCoverageComplete", () => {
  it("rejects Opta boards when a Championship nation is missing", () => {
    expect(
      teamAdvancedCoverageComplete({ teamCount: 4, teamsTracked: 3, participantCount: 4 }),
    ).toBe(false);
  });

  it("accepts 2022-style full Opta coverage", () => {
    expect(
      teamAdvancedCoverageComplete({
        teamCount: 4,
        teamsTracked: 4,
        participantCount: 4,
        matches: 24,
        matchesTracked: 24,
      }),
    ).toBe(true);
  });

  it("rejects a season where one match lacks Opta tracking", () => {
    expect(
      teamAdvancedCoverageComplete({
        teamCount: 4,
        teamsTracked: 4,
        participantCount: 4,
        matches: 24,
        matchesTracked: 23,
      }),
    ).toBe(false);
  });
});
