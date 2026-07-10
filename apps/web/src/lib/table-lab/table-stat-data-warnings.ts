/** Shown when fixtures exist in season scope but SDMS try stats are missing. */
export const SDMS_TRY_DATA_UNAVAILABLE =
  "Completed fixtures exist, but no verified SDMS try data is available for this table.";

export function buildStatTableWarnings(input: {
  seasonFixtureCount: number;
  qualifyingFixtureCount: number;
  rowCount: number;
  requiresTryData?: boolean;
}): string[] {
  const warnings: string[] = [];
  const requiresTryData = input.requiresTryData ?? true;

  if (input.seasonFixtureCount === 0) {
    warnings.push("No completed fixtures in scope.");
    return warnings;
  }

  if (requiresTryData && input.qualifyingFixtureCount === 0) {
    warnings.push(SDMS_TRY_DATA_UNAVAILABLE);
    return warnings;
  }

  if (input.rowCount === 0) {
    warnings.push("No rows could be calculated for the selected scope.");
  }

  return warnings;
}

export function bettingTableScopeWarnings(built: {
  completedMatchCount: number;
  qualifyingMatchCount: number;
  rows: { length: number };
  triesCoveragePct?: number;
}): string[] {
  const warnings = buildStatTableWarnings({
    seasonFixtureCount: built.completedMatchCount,
    qualifyingFixtureCount: built.qualifyingMatchCount,
    rowCount: built.rows.length,
  });

  if (
    built.completedMatchCount > 0 &&
    built.qualifyingMatchCount > 0 &&
    built.triesCoveragePct != null &&
    built.triesCoveragePct < 100
  ) {
    warnings.push(
      "Some fixtures are missing verified try data — missing matches are excluded rather than counted as zero.",
    );
  }

  return warnings;
}

export function perspectiveHasVerifiedTries(row: {
  triesFor: number | null;
  triesAgainst?: number | null;
}): boolean {
  return row.triesFor != null;
}
