import { describe, expect, it } from "vitest";
import { assessFixtureCoverage, confidenceLabel, isTableAvailable } from "./table-confidence-service";
import {
  getRugbyTableDefinition,
  listRugbyTableDefinitions,
  rugbyTableCategories,
} from "./table-definition-service";
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
    ...overrides,
  };
}

describe("table-lab definitions", () => {
  it("registers rugby-specific table types without football labels", () => {
    const labels = listRugbyTableDefinitions().map((row) => row.label);
    expect(labels).toContain("Wins To Nil");
    expect(labels).toContain("Both Teams Scored Tries");
    expect(labels).not.toContain("Clean Sheets");
    expect(labels).not.toContain("Both Teams to Score");
  });

  it("includes all major categories", () => {
    const categories = rugbyTableCategories().map((row) => row.id);
    expect(categories).toEqual(
      expect.arrayContaining([
        "standard",
        "match_period",
        "rugby_scoring",
        "set_piece",
        "attack",
        "defence",
        "discipline",
      ]),
    );
  });

  it("documents required data for each table", () => {
    const full = getRugbyTableDefinition("full_table");
    expect(full?.requiredData).toContain("fixtures");
    expect(full?.minimumData).toEqual(["fixtures", "match_scores"]);
    expect(full?.explanation).toMatch(/league table/i);
    expect(full?.calculationMethod.length).toBeGreaterThan(20);
  });

  it("declares data tiers on every table definition", () => {
    for (const definition of listRugbyTableDefinitions()) {
      expect(definition.minimumData.length).toBeGreaterThan(0);
      expect(Array.isArray(definition.enhancedData)).toBe(true);
      expect(Array.isArray(definition.advancedData)).toBe(true);
    }
  });
});

describe("table-lab confidence", () => {
  it("marks half-time tables unavailable without half-time data", () => {
    const definition = getRugbyTableDefinition("first_half");
    expect(definition).toBeTruthy();
    const coverage = assessFixtureCoverage([perspective()], definition!);
    expect(coverage.confidence).toBe("unavailable");
    expect(isTableAvailable(definition!, coverage)).toBe(false);
  });

  it("allows standard tables with basic results when try stats are missing", () => {
    const definition = getRugbyTableDefinition("full_table");
    const coverage = assessFixtureCoverage(
      [perspective({ triesFor: null, triesAgainst: null })],
      definition!,
    );
    expect(coverage.confidence).not.toBe("unavailable");
    expect(isTableAvailable(definition!, coverage)).toBe(true);
    expect(coverage.warnings.some((warning) => warning.includes("team match stats"))).toBe(false);
  });

  it("reports SDMS unavailable when season fixtures exist but try perspectives are empty", () => {
    const definition = getRugbyTableDefinition("tries_scored");
    const coverage = assessFixtureCoverage([], definition!, { seasonFixtureCount: 93 });
    expect(coverage.fixtureCount).toBe(93);
    expect(coverage.warnings).toContain(
      "Completed fixtures exist, but no verified SDMS try data is available for this table.",
    );
    expect(isTableAvailable(definition!, coverage)).toBe(false);
  });

  it("reports high confidence when SDMS and scores are present", () => {
    const definition = getRugbyTableDefinition("tries_scored");
    const coverage = assessFixtureCoverage(
      [perspective({ triesFor: 3, triesAgainst: 2 })],
      definition!,
    );
    expect(coverage.confidence).toBe("high");
    expect(confidenceLabel(coverage.confidence)).toBe("High");
    expect(isTableAvailable(definition!, coverage)).toBe(true);
  });
});
