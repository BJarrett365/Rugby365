import type {
  RugbyTableCategory,
  RugbyTableDataSource,
  RugbyTableDefinition,
  TeamFixturePerspective,
} from "./table-types";

export type TableDataLevel = 1 | 2 | 3;

export type TableDataLevelAssessment = {
  level: TableDataLevel;
  level1CoveragePct: number;
  level2CoveragePct: number;
  level3CoveragePct: number;
  coverageNote: string;
};

const LEVEL_1_SOURCES: RugbyTableDataSource[] = ["fixtures", "match_scores"];

const LEVEL_2_SOURCES: RugbyTableDataSource[] = [
  "competition_scoring_rules",
  "team_match_stats",
  "standing_rows",
];

const LEVEL_3_SOURCES: RugbyTableDataSource[] = [
  "match_events",
  "half_time_scores",
  "sixty_minute_scores",
];

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function dataTiersForDefinition(input: {
  category: RugbyTableCategory;
  requiredData: RugbyTableDataSource[];
}): {
  minimumData: RugbyTableDataSource[];
  enhancedData: RugbyTableDataSource[];
  advancedData: RugbyTableDataSource[];
} {
  switch (input.category) {
    case "standard":
      return {
        minimumData: ["fixtures", "match_scores"],
        enhancedData: ["competition_scoring_rules", "standing_rows", "team_match_stats"],
        advancedData: [],
      };
    case "rugby_scoring":
      return {
        minimumData: ["fixtures", "match_scores", "competition_scoring_rules"],
        enhancedData: ["team_match_stats", "standing_rows"],
        advancedData: [],
      };
    case "match_period":
      return {
        minimumData: ["fixtures", "match_scores"],
        enhancedData: ["half_time_scores", "match_events"],
        advancedData: [],
      };
    case "set_piece":
    case "attack":
    case "defence":
    case "possession_territory":
      return {
        minimumData: ["fixtures", "team_match_stats"],
        enhancedData: ["match_scores"],
        advancedData: ["match_events"],
      };
    case "discipline":
      return {
        minimumData: ["fixtures", "match_events"],
        enhancedData: ["team_match_stats"],
        advancedData: [],
      };
    case "opposition":
    case "game_state":
      return {
        minimumData: ["fixtures", "match_scores"],
        enhancedData: ["competition_scoring_rules", "match_events"],
        advancedData: ["team_match_stats"],
      };
    default:
      return {
        minimumData: input.requiredData.filter((source) => LEVEL_1_SOURCES.includes(source)),
        enhancedData: input.requiredData.filter((source) => LEVEL_2_SOURCES.includes(source)),
        advancedData: input.requiredData.filter((source) => LEVEL_3_SOURCES.includes(source)),
      };
  }
}

function sourceCoverage(
  source: RugbyTableDataSource,
  perspectives: TeamFixturePerspective[],
  fixtureCount: number,
): number {
  if (fixtureCount === 0) return 0;
  if (source === "fixtures") return 100;
  if (source === "competition_scoring_rules" || source === "standing_rows") return 100;

  if (source === "match_scores") {
    const withScores = perspectives.filter(
      (row) => row.pointsFor + row.pointsAgainst > 0 || row.pointsFor === 0,
    );
    return pct(withScores.length, perspectives.length);
  }

  if (source === "team_match_stats") {
    const withTries = perspectives.filter(
      (row) => hasValue(row.triesFor) || hasValue(row.triesAgainst),
    );
    const withCarries = perspectives.filter((row) => hasValue(row.carries));
    const withAdvanced = perspectives.filter(
      (row) =>
        hasValue(row.lineoutsWon) ||
        hasValue(row.possessionPct) ||
        hasValue(row.tacklesMade) ||
        hasValue(row.penaltiesConceded),
    );
    const numerator = Math.max(withTries.length, withCarries.length, withAdvanced.length);
    return pct(numerator, perspectives.length);
  }

  if (source === "half_time_scores") {
    return pct(
      perspectives.filter(
        (row) => hasValue(row.firstHalfFor) && hasValue(row.firstHalfAgainst),
      ).length,
      perspectives.length,
    );
  }

  if (source === "sixty_minute_scores") {
    return pct(
      perspectives.filter(
        (row) =>
          row.sixtyMinuteScoreVerified === true ||
          (hasValue(row.scoreAtSixtyFor) && hasValue(row.scoreAtSixtyAgainst)),
      ).length,
      perspectives.length,
    );
  }

  if (source === "match_events") {
    return pct(
      perspectives.filter((row) => hasValue(row.scoredFirst)).length,
      perspectives.length,
    );
  }

  return 0;
}

function tierCoverage(
  sources: RugbyTableDataSource[],
  perspectives: TeamFixturePerspective[],
  fixtureCount: number,
): number {
  if (!sources.length) return 100;
  const values = sources.map((source) => sourceCoverage(source, perspectives, fixtureCount));
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function tryDataFromSeasonLabel(seasonYears: number[]): string | null {
  if (!seasonYears.length) return null;
  const withTries = seasonYears.filter((year) => year >= 2001);
  if (!withTries.length) return null;
  const first = withTries[0]!;
  const endShort = String((first + 1) % 100).padStart(2, "0");
  return `${first}/${endShort}`;
}

function rugbyScoringDataCoverage(perspectives: TeamFixturePerspective[]): number {
  const withTries = perspectives.filter(
    (row) => hasValue(row.triesFor) || hasValue(row.triesAgainst),
  );
  return pct(withTries.length, perspectives.length);
}

function advancedStatsDataCoverage(perspectives: TeamFixturePerspective[]): number {
  const withAdvanced = perspectives.filter(
    (row) =>
      hasValue(row.carries) ||
      hasValue(row.tacklesMade) ||
      hasValue(row.possessionPct) ||
      hasValue(row.lineoutsWon) ||
      hasValue(row.penaltiesConceded) ||
      hasValue(row.scoredFirst),
  );
  return pct(withAdvanced.length, perspectives.length);
}

export function assessTableDataLevels(
  perspectives: TeamFixturePerspective[],
  definition: RugbyTableDefinition,
  options?: { seasonYears?: number[] },
): TableDataLevelAssessment {
  const fixtureCount = new Set(perspectives.map((row) => row.fixtureId)).size;
  const level1CoveragePct = tierCoverage(definition.minimumData, perspectives, fixtureCount);
  const level2CoveragePct = definition.enhancedData.length
    ? rugbyScoringDataCoverage(perspectives)
    : 0;
  const level3CoveragePct = definition.advancedData.length
    ? advancedStatsDataCoverage(perspectives)
    : 0;

  let level: TableDataLevel = 1;
  if (level3CoveragePct >= 20 && definition.advancedData.length > 0) level = 3;
  else if (level2CoveragePct >= 20 && definition.enhancedData.length > 0) level = 2;

  const coverageNote = buildDataCoverageNote({
    definition,
    level,
    level1CoveragePct,
    level2CoveragePct,
    level3CoveragePct,
    fixtureCount,
    seasonYears: options?.seasonYears,
  });

  return {
    level,
    level1CoveragePct,
    level2CoveragePct,
    level3CoveragePct,
    coverageNote,
  };
}

export function buildDataCoverageNote(input: {
  definition: RugbyTableDefinition;
  level: TableDataLevel;
  level1CoveragePct: number;
  level2CoveragePct: number;
  level3CoveragePct: number;
  fixtureCount: number;
  seasonYears?: number[];
}): string {
  if (input.fixtureCount === 0) {
    return "No completed fixtures in scope.";
  }

  const seasonCount = input.seasonYears?.length;
  const seasonPhrase =
    seasonCount != null && seasonCount > 0
      ? `all ${seasonCount} season${seasonCount === 1 ? "" : "s"} in range`
      : "matches in scope";

  if (input.level === 1 || input.level2CoveragePct < 20) {
    if (input.definition.id === "all_time_premiership" && input.seasonYears?.length) {
      const tryFrom = tryDataFromSeasonLabel(input.seasonYears);
      if (tryFrom && input.level2CoveragePct < 80) {
        return `Basic results data available for ${seasonPhrase}. Detailed try data is partial — rely on scoring columns only where try stats exist.`;
      }
    }
    return `Basic results data available for ${seasonPhrase}. Rugby scoring and advanced stat columns appear only when underlying data exists.`;
  }

  if (input.level === 2) {
    const tryFrom = tryDataFromSeasonLabel(input.seasonYears ?? []);
    if (tryFrom) {
      return `Basic results data available for ${seasonPhrase}. Try and bonus breakdown columns shown where SDMS try data exists (typically reliable from ${tryFrom}).`;
    }
    return `Results and rugby scoring data available for most ${seasonPhrase}. Advanced stat columns appear when SDMS match stats exist.`;
  }

  return `Full data depth available for ${seasonPhrase}, including match events and detailed statistics where collected.`;
}

export function enrichDefinition(definition: Omit<RugbyTableDefinition, "minimumData" | "enhancedData" | "advancedData"> & {
  minimumData?: RugbyTableDataSource[];
  enhancedData?: RugbyTableDataSource[];
  advancedData?: RugbyTableDataSource[];
}): RugbyTableDefinition {
  const tiers =
    definition.minimumData != null
      ? {
          minimumData: definition.minimumData,
          enhancedData: definition.enhancedData ?? [],
          advancedData: definition.advancedData ?? [],
        }
      : dataTiersForDefinition(definition);

  return {
    ...definition,
    ...tiers,
  };
}
