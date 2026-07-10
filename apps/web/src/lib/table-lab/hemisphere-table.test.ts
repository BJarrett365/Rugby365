import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildHemisphereTable,
  filterHemispherePerspectives,
  perspectivePassesView,
} from "./hemisphere-table-service";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective>): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
    teamId: "t1",
    teamName: "England",
    opponentId: "t2",
    opponentName: "South Africa",
    side: "home",
    pointsFor: 24,
    pointsAgainst: 17,
    triesFor: 3,
    triesAgainst: 2,
    firstHalfFor: null,
    firstHalfAgainst: null,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: null,
    concededFirst: null,
    wasWinning: null,
    wasLosing: null,
    wasDrawn: null,
    possessionPct: null,
    territoryPct: null,
    lineoutsWon: null,
    lineoutsLost: null,
    scrumSuccessPct: null,
    scrumPenaltiesWon: null,
    scrumPenaltiesConceded: null,
    carries: null,
    metres: null,
    lineBreaks: null,
    defendersBeaten: null,
    postContactMetres: null,
    tryAssists: null,
    turnoversWon: null,
    tacklesMade: null,
    tacklesCompleted: null,
    dominantTackles: null,
    missedTackles: null,
    penaltiesConceded: null,
    yellowCards: 0,
    redCards: 0,
    opponentLeagueRank: null,
    teamHemisphere: "northern",
    opponentHemisphere: "southern",
    teamType: "international",
    isNeutralVenue: false,
    ...overrides,
  };
}

describe("hemisphere table", () => {
  it("maps type=hemisphere-table route param", () => {
    expect(tableIdFromTypeParam("hemisphere-table")).toBe("hemisphere_table");
  });

  it("aggregates northern v southern matches in summary mode", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "England",
        teamHemisphere: "northern",
        opponentHemisphere: "southern",
        pointsFor: 30,
        pointsAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "South Africa",
        teamHemisphere: "southern",
        opponentHemisphere: "northern",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
    ];

    const { rows } = buildHemisphereTable({
      perspectives: fixtures,
      mode: "summary",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("six-nations"),
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.teamName).toBe("Northern Hemisphere");
    expect(rows[0]?.won).toBe(1);
    expect(rows[1]?.teamName).toBe("Southern Hemisphere");
    expect(rows[1]?.lost).toBe(1);
  });

  it("includes northern v northern matches for both northern teams", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "England",
        opponentId: "t3",
        opponentName: "France",
        teamHemisphere: "northern",
        opponentHemisphere: "northern",
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t3",
        teamName: "France",
        opponentId: "t1",
        opponentName: "England",
        teamHemisphere: "northern",
        opponentHemisphere: "northern",
        pointsFor: 17,
        pointsAgainst: 24,
      }),
    ];

    const { rows } = buildHemisphereTable({
      perspectives: fixtures,
      mode: "breakdown",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("six-nations"),
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.hemisphere === "northern")).toBe(true);
  });

  it("includes southern v southern matches for both southern teams", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "South Africa",
        opponentId: "t4",
        opponentName: "New Zealand",
        teamHemisphere: "southern",
        opponentHemisphere: "southern",
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t4",
        teamName: "New Zealand",
        opponentId: "t2",
        opponentName: "South Africa",
        teamHemisphere: "southern",
        opponentHemisphere: "southern",
        pointsFor: 17,
        pointsAgainst: 24,
      }),
    ];

    const { rows } = buildHemisphereTable({
      perspectives: fixtures,
      mode: "breakdown",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("rugby-championship"),
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.hemisphere === "southern")).toBe(true);
  });

  it("filters away view only", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home" }),
      perspective({ fixtureId: "f2", side: "away", teamId: "t1" }),
    ];

    const awayOnly = filterHemispherePerspectives({
      perspectives: fixtures,
      tableView: "away",
      matchType: "all",
      includeUnknown: false,
    });
    expect(awayOnly.perspectives).toHaveLength(1);
    expect(awayOnly.perspectives[0]?.side).toBe("away");
  });

  it("sorts team breakdown by win pct then wins then points difference", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "England",
        pointsFor: 30,
        pointsAgainst: 10,
        triesFor: 4,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "South Africa",
        teamHemisphere: "southern",
        pointsFor: 10,
        pointsAgainst: 30,
        triesFor: 1,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "England",
        pointsFor: 12,
        pointsAgainst: 12,
        triesFor: 2,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "France",
        teamHemisphere: "northern",
        opponentHemisphere: "northern",
        pointsFor: 12,
        pointsAgainst: 12,
        triesFor: 2,
      }),
    ];

    const { rows } = buildHemisphereTable({
      perspectives: fixtures,
      mode: "breakdown",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("six-nations"),
    });

    expect(rows[0]?.teamName).toBe("England");
    expect(rows[0]?.winPct).toBe(50);
    expect(rows[1]?.winPct).toBe(0);
    expect(rows[1]?.won).toBe(0);
  });

  it("orders hemisphere summary as northern then southern", () => {
    const { rows } = buildHemisphereTable({
      perspectives: [
        perspective({
          teamId: "t2",
          teamName: "South Africa",
          teamHemisphere: "southern",
          pointsFor: 10,
          pointsAgainst: 24,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          teamName: "England",
          teamHemisphere: "northern",
          pointsFor: 24,
          pointsAgainst: 10,
        }),
      ],
      mode: "summary",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("six-nations"),
    });

    expect(rows.map((row) => row.teamName)).toEqual([
      "Northern Hemisphere",
      "Southern Hemisphere",
    ]);
  });

  it("excludes unknown teams unless include unknown is enabled", () => {
    const fixtures = [
      perspective({
        teamId: "t9",
        teamName: "Mystery XV",
        teamHemisphere: "unknown",
        opponentHemisphere: "northern",
      }),
      perspective({
        teamId: "t1",
        teamName: "England",
        opponentId: "t9",
        opponentName: "Mystery XV",
        opponentHemisphere: "unknown",
      }),
    ];

    const excluded = buildHemisphereTable({
      perspectives: fixtures,
      mode: "breakdown",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("six-nations"),
    });
    const included = buildHemisphereTable({
      perspectives: fixtures,
      mode: "breakdown",
      tableView: "all",
      matchType: "all",
      includeUnknown: true,
      rules: scoringRulesForCompetitionSlug("six-nations"),
    });

    expect(excluded.rows).toHaveLength(0);
    expect(excluded.warnings.some((warning) => warning.includes("excluded from this table"))).toBe(
      true,
    );
    expect(included.rows.length).toBeGreaterThan(0);
  });

  it("filters home, away and neutral views", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home", isNeutralVenue: false }),
      perspective({
        fixtureId: "f2",
        side: "away",
        teamId: "t1",
        isNeutralVenue: false,
      }),
      perspective({
        fixtureId: "f3",
        side: "home",
        isNeutralVenue: true,
      }),
    ];

    expect(perspectivePassesView(fixtures[0]!, "home")).toBe(true);
    expect(perspectivePassesView(fixtures[1]!, "home")).toBe(false);
    expect(perspectivePassesView(fixtures[2]!, "neutral")).toBe(true);

    const homeOnly = filterHemispherePerspectives({
      perspectives: fixtures,
      tableView: "home",
      matchType: "all",
      includeUnknown: false,
    });
    expect(homeOnly.perspectives).toHaveLength(2);
  });

  it("calculates win percentage and sorts team breakdown rows", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "England",
        pointsFor: 30,
        pointsAgainst: 10,
        triesFor: 4,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        teamName: "England",
        pointsFor: 12,
        pointsAgainst: 12,
        triesFor: 2,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "South Africa",
        teamHemisphere: "southern",
        pointsFor: 10,
        pointsAgainst: 30,
      }),
    ];

    const { rows } = buildHemisphereTable({
      perspectives: fixtures,
      mode: "breakdown",
      tableView: "all",
      matchType: "international",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    expect(rows[0]?.teamName).toBe("England");
    expect(rows[0]?.winPct).toBe(50);
    expect(rows[0]?.won).toBe(1);
  });

  it("handles missing tries data without failing", () => {
    const { rows } = buildHemisphereTable({
      perspectives: [
        perspective({ triesFor: null, triesAgainst: null }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          teamName: "South Africa",
          teamHemisphere: "southern",
          triesFor: null,
          triesAgainst: null,
          pointsFor: 10,
          pointsAgainst: 24,
        }),
      ],
      mode: "summary",
      tableView: "all",
      matchType: "all",
      includeUnknown: false,
      rules: scoringRulesForCompetitionSlug("premiership"),
    });

    expect(rows[0]?.triesFor).toBeNull();
    expect(rows[0]?.tryBonusPoints).toBeNull();
  });
});
