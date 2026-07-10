import type {
  RugbyTableConfidence,
  RugbyTableDataSource,
  RugbyTableDefinition,
  TeamFixturePerspective,
} from "./table-types";
import { SDMS_TRY_DATA_UNAVAILABLE } from "./table-stat-data-warnings";

export type AssessFixtureCoverageOptions = {
  /** Completed fixtures in full season scope (before stat filters). */
  seasonFixtureCount?: number;
};

export type DataCoverageReport = {
  fixtureCount: number;
  evaluatedFixtureCount: number;
  coverageBySource: Partial<Record<RugbyTableDataSource, number>>;
  dataCoveragePct: number;
  confidence: RugbyTableConfidence;
  warnings: string[];
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function buildCoverageBySource(
  perspectives: TeamFixturePerspective[],
  fixtureCount: number,
): Partial<Record<RugbyTableDataSource, number>> {
  const coverageBySource: Partial<Record<RugbyTableDataSource, number>> = {
    fixtures: fixtureCount > 0 ? 100 : 0,
  };

  if (fixtureCount === 0) return coverageBySource;

  const completed = perspectives.filter(
    (row) => row.pointsFor + row.pointsAgainst > 0 || row.pointsFor === 0,
  );
  coverageBySource.match_scores = pct(completed.length, perspectives.length);

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
  coverageBySource.team_match_stats = pct(
    Math.max(withTries.length, withCarries.length, withAdvanced.length),
    perspectives.length,
  );

  const withHalfTime = perspectives.filter(
    (row) => hasValue(row.firstHalfFor) && hasValue(row.firstHalfAgainst),
  );
  coverageBySource.half_time_scores = pct(withHalfTime.length, perspectives.length);

  const withEvents = perspectives.filter((row) => hasValue(row.scoredFirst));
  coverageBySource.match_events = pct(withEvents.length, perspectives.length);

  coverageBySource.competition_scoring_rules = 100;
  coverageBySource.standing_rows = 0;

  return coverageBySource;
}

function confidenceFromCoveragePct(dataCoveragePct: number): RugbyTableConfidence {
  if (dataCoveragePct >= 85) return "high";
  if (dataCoveragePct >= 55) return "medium";
  if (dataCoveragePct > 0) return "low";
  return "unavailable";
}

export function assessFixtureCoverage(
  perspectives: TeamFixturePerspective[],
  definition: RugbyTableDefinition,
  options?: AssessFixtureCoverageOptions,
): DataCoverageReport {
  const fixtureCount =
    options?.seasonFixtureCount ?? new Set(perspectives.map((row) => row.fixtureId)).size;
  const warnings: string[] = [];
  const minimumData = definition.minimumData;
  const coverageBySource = buildCoverageBySource(perspectives, fixtureCount);

  if (fixtureCount === 0) {
    return {
      fixtureCount: 0,
      evaluatedFixtureCount: 0,
      coverageBySource,
      dataCoveragePct: 0,
      confidence: "unavailable",
      warnings: ["No completed fixtures in scope."],
    };
  }

  const requiresTryStats =
    minimumData.includes("team_match_stats") &&
    definition.category === "rugby_scoring" &&
    (definition.id === "tries_scored" ||
      definition.id === "tries_conceded" ||
      definition.id === "both_teams_scored_tries" ||
      definition.id === "winning_bonus_points" ||
      definition.id === "try_bonus_point");

  if (
    requiresTryStats &&
    perspectives.length === 0 &&
    (options?.seasonFixtureCount ?? 0) > 0
  ) {
    return {
      fixtureCount,
      evaluatedFixtureCount: 0,
      coverageBySource,
      dataCoveragePct: 0,
      confidence: "unavailable",
      warnings: [SDMS_TRY_DATA_UNAVAILABLE],
    };
  }

  const requiredCoverage = minimumData.map((source) => coverageBySource[source] ?? 0);
  const dataCoveragePct =
    requiredCoverage.length > 0
      ? Math.round((requiredCoverage.reduce((sum, value) => sum + value, 0) / requiredCoverage.length) * 10) /
        10
      : 0;

  for (const source of minimumData) {
    const sourceCoverage = coverageBySource[source] ?? 0;
    if (sourceCoverage < 100 && source !== "competition_scoring_rules" && source !== "standing_rows") {
      warnings.push(
        `${source.replaceAll("_", " ")} available for ${sourceCoverage}% of team-fixtures in scope.`,
      );
    }
  }

  let confidence = confidenceFromCoveragePct(dataCoveragePct);

  if (definition.category === "match_period") {
    const halfTime = coverageBySource.half_time_scores ?? 0;
    const events = coverageBySource.match_events ?? 0;
    if (halfTime < 20 && events < 20) {
      confidence = "unavailable";
      warnings.push("Half-time scores or timed match events are not available for enough matches.");
    }
  } else if (
    minimumData.includes("team_match_stats") &&
    (coverageBySource.team_match_stats ?? 0) < 20
  ) {
    confidence = "unavailable";
    warnings.push("SDMS team match stats are required but missing for most fixtures.");
  } else if (
    minimumData.includes("match_events") &&
    (coverageBySource.match_events ?? 0) < 20
  ) {
    confidence = "unavailable";
    warnings.push("Match events are required but missing for most fixtures.");
  }

  return {
    fixtureCount,
    evaluatedFixtureCount: perspectives.length,
    coverageBySource,
    dataCoveragePct,
    confidence,
    warnings,
  };
}

export function isTableAvailable(
  definition: RugbyTableDefinition,
  coverage: DataCoverageReport,
): boolean {
  if (coverage.fixtureCount === 0) return false;

  if (definition.category === "match_period") {
    return (
      (coverage.coverageBySource.half_time_scores ?? 0) >= 20 ||
      (coverage.coverageBySource.match_events ?? 0) >= 20
    );
  }

  if (
    definition.minimumData.includes("team_match_stats") &&
    (coverage.coverageBySource.team_match_stats ?? 0) < 20
  ) {
    return false;
  }

  if (
    definition.minimumData.includes("match_events") &&
    (coverage.coverageBySource.match_events ?? 0) < 20
  ) {
    return false;
  }

  if (
    definition.minimumData.includes("match_scores") &&
    (coverage.coverageBySource.match_scores ?? 0) <= 0
  ) {
    return false;
  }

  return coverage.confidence !== "unavailable";
}

export function confidenceLabel(confidence: RugbyTableConfidence): string {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Unavailable";
  }
}
