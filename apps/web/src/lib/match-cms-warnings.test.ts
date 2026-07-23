import { describe, expect, it } from "vitest";
import {
  collectMatchWarnings,
  classifyTodayBucket,
  rowMatchesOpsBucket,
} from "./match-cms-warnings";
import { isFieldLocked } from "./data-integration-overwrite";
import { WHOLE_RECORD_LOCK_FIELD } from "./provider-mapping-types";

describe("collectMatchWarnings", () => {
  it("flags missing core mappings", () => {
    const warnings = collectMatchWarnings({
      competitionId: null,
      seasonId: null,
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: null,
      refereeId: null,
      hasLineups: true,
      hasTeamStats: true,
      hasPlayerStats: true,
      primaryApiMatchId: null,
      status: "scheduled",
    });
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("competition");
    expect(codes).toContain("season");
    expect(codes).toContain("venue");
    expect(codes).toContain("referee");
    expect(codes).toContain("primary_mapping");
    expect(codes).not.toContain("lineups");
  });

  it("flags missing lineups/stats for finished matches", () => {
    const warnings = collectMatchWarnings({
      competitionId: "c",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: "v",
      refereeId: "r",
      hasLineups: false,
      hasTeamStats: false,
      hasPlayerStats: false,
      primaryApiMatchId: "5370",
      status: "full_time",
    });
    expect(warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["lineups", "team_stats", "player_stats"]),
    );
  });
});

describe("today ops buckets", () => {
  it("classifies live and missing venue", () => {
    const row = {
      id: "1",
      kickoffAt: new Date().toISOString(),
      status: "live",
      competitionId: "c",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: null,
      refereeId: "r",
      hasLineups: true,
      hasTeamStats: true,
      hasPlayerStats: true,
      primaryApiMatchId: "1",
      warningCount: 1,
    };
    const buckets = classifyTodayBucket(row);
    expect(buckets).toContain("live");
    expect(buckets).toContain("missing_venue");
    expect(rowMatchesOpsBucket(row, "missing_data")).toBe(true);
  });
});

describe("score locks", () => {
  it("treats whole-record lock as locking scores", () => {
    expect(isFieldLocked("homeScore", new Set([WHOLE_RECORD_LOCK_FIELD]))).toBe(true);
    expect(isFieldLocked("homeScore", new Set(["homeScore"]))).toBe(true);
    expect(isFieldLocked("homeScore", new Set(["status"]))).toBe(false);
  });
});
