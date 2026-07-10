import { describe, expect, it } from "vitest";
import {
  bettingTableScopeWarnings,
  buildStatTableWarnings,
  SDMS_TRY_DATA_UNAVAILABLE,
} from "./table-stat-data-warnings";

describe("table-stat-data-warnings", () => {
  it("uses no-fixtures warning only when season scope is empty", () => {
    expect(buildStatTableWarnings({ seasonFixtureCount: 0, qualifyingFixtureCount: 0, rowCount: 0 })).toEqual([
      "No completed fixtures in scope.",
    ]);
  });

  it("reports SDMS gap when fixtures exist but try data does not", () => {
    expect(
      buildStatTableWarnings({ seasonFixtureCount: 93, qualifyingFixtureCount: 0, rowCount: 0 }),
    ).toEqual([SDMS_TRY_DATA_UNAVAILABLE]);
  });

  it("combines partial try coverage with SDMS unavailable when nothing qualifies", () => {
    expect(
      bettingTableScopeWarnings({
        completedMatchCount: 93,
        qualifyingMatchCount: 0,
        rows: [],
      }),
    ).toEqual([SDMS_TRY_DATA_UNAVAILABLE]);
  });
});
