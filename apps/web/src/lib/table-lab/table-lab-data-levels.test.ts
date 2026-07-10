import { describe, expect, it } from "vitest";
import {
  assessTableDataLevels,
  buildDataCoverageNote,
  dataTiersForDefinition,
  enrichDefinition,
} from "./table-lab-data-levels";
import { getRugbyTableDefinition } from "./table-definition-service";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective> = {}): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
    teamId: "t1",
    teamName: "Bath",
    opponentId: "t2",
    opponentName: "Exeter Chiefs",
    side: "home",
    pointsFor: 24,
    pointsAgainst: 17,
    triesFor: null,
    triesAgainst: null,
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
    ...overrides,
  };
}

describe("table-lab data levels", () => {
  it("assigns minimum, enhanced and advanced tiers per category", () => {
    const full = dataTiersForDefinition({
      category: "standard",
      requiredData: ["fixtures", "match_scores", "standing_rows"],
    });
    expect(full.minimumData).toEqual(["fixtures", "match_scores"]);
    expect(full.enhancedData).toContain("team_match_stats");

    const carries = dataTiersForDefinition({
      category: "attack",
      requiredData: ["fixtures", "team_match_stats"],
    });
    expect(carries.minimumData).toEqual(["fixtures", "team_match_stats"]);
    expect(carries.advancedData).toContain("match_events");
  });

  it("enriches definitions with data tiers", () => {
    const full = getRugbyTableDefinition("full_table");
    expect(full?.minimumData).toEqual(["fixtures", "match_scores"]);
    expect(full?.enhancedData.length).toBeGreaterThan(0);
  });

  it("reports level 1 when only basic results exist", () => {
    const definition = enrichDefinition({
      id: "full_table",
      slug: "full_table",
      label: "Full Table",
      category: "standard",
      explanation: "test",
      calculationMethod: "test",
      requiredData: ["fixtures", "match_scores"],
    });
    const levels = assessTableDataLevels([perspective()], definition);
    expect(levels.level).toBe(1);
    expect(levels.level1CoveragePct).toBe(100);
    expect(levels.coverageNote).toMatch(/Basic results data available/i);
  });

  it("reports level 2 when try stats exist", () => {
    const definition = getRugbyTableDefinition("full_table")!;
    const levels = assessTableDataLevels(
      [perspective({ triesFor: 3, triesAgainst: 2 })],
      definition,
    );
    expect(levels.level).toBe(2);
    expect(levels.coverageNote).toMatch(/try|bonus|scoring/i);
  });

  it("builds season-aware coverage notes for all-time tables", () => {
    const definition = getRugbyTableDefinition("all_time_premiership")!;
    const note = buildDataCoverageNote({
      definition,
      level: 1,
      level1CoveragePct: 100,
      level2CoveragePct: 40,
      level3CoveragePct: 0,
      fixtureCount: 100,
      seasonYears: [1996, 2005, 2015, 2024],
    });
    expect(note).toMatch(/all 4 seasons/i);
    expect(note).toMatch(/Basic results/i);
  });
});
