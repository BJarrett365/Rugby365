import { describe, expect, it } from "vitest";
import {
  computeSelectionStability,
  countStarterChanges,
  isBenchRole,
  isStarterRole,
  setsEqual,
  type SelectionMatchLineup,
} from "./coach-selection-stability-engine";

function lineup(
  partial: Partial<SelectionMatchLineup> & { starters: string[] },
): SelectionMatchLineup {
  return {
    fixtureId: partial.fixtureId ?? crypto.randomUUID(),
    kickoffAt: partial.kickoffAt ?? new Date("2025-01-01"),
    bench: partial.bench ?? [],
    result: partial.result ?? "W",
    starters: partial.starters,
  };
}

describe("CoachSelectionStabilityEngine", () => {
  it("classifies starter vs bench roles", () => {
    expect(isStarterRole("starting", null)).toBe(true);
    expect(isStarterRole("substitute", 10)).toBe(false);
    expect(isBenchRole("substitute", null)).toBe(true);
    expect(isStarterRole(null, 10)).toBe(true);
    expect(isBenchRole(null, 18)).toBe(true);
  });

  it("counts starter changes between consecutive XVs", () => {
    const prev = new Set(["a", "b", "c", "d", "e"]);
    const next = new Set(["a", "b", "c", "x", "y"]);
    expect(countStarterChanges(prev, next)).toBe(2);
    expect(countStarterChanges(prev, prev)).toBe(0);
    expect(countStarterChanges(prev, next)).toBeLessThanOrEqual(15);
  });

  it("detects identical starting XVs", () => {
    const a = new Set(["1", "2", "3"]);
    const b = new Set(["1", "2", "3"]);
    expect(setsEqual(a, b)).toBe(true);
    expect(setsEqual(a, new Set(["1", "2", "4"]))).toBe(false);
  });

  it("counts unique players across lineups, not row duplicates", () => {
    const shared = Array.from({ length: 15 }, (_, i) => `p${i}`);
    const lineups = Array.from({ length: 5 }, (_, i) =>
      lineup({
        kickoffAt: new Date(`2025-01-0${i + 1}`),
        starters: shared,
        bench: ["b1", "b2"],
      }),
    );
    const result = computeSelectionStability({
      lineups,
      playerBirthDates: new Map(),
      preTenureTeamPlayerIds: new Set(),
      eligibleMatches: 5,
    });
    expect(result.playersUsed).toBe(17);
    expect(result.startersUsed).toBe(15);
    expect(result.benchOnlyPlayers).toBe(2);
    expect(result.avgStartingXvChanges).toBe(0);
    expect(result.unchangedXvPct).toBe(100);
  });

  it("flags calculation error when raw XV changes exceed 15", () => {
    const makeStarters = (prefix: string) =>
      Array.from({ length: 20 }, (_, i) => `${prefix}${i}`);
    const lineups = [
      lineup({ kickoffAt: new Date("2025-01-01"), starters: makeStarters("a") }),
      lineup({ kickoffAt: new Date("2025-01-08"), starters: makeStarters("b") }),
      lineup({ kickoffAt: new Date("2025-01-15"), starters: makeStarters("c") }),
      lineup({ kickoffAt: new Date("2025-01-22"), starters: makeStarters("d") }),
    ];
    const result = computeSelectionStability({
      lineups,
      playerBirthDates: new Map(),
      preTenureTeamPlayerIds: new Set(),
      eligibleMatches: 4,
    });
    expect(result.dataIssues).toContain("xv_changes_exceeds_15");
  });

  it("caps reported avg XV changes at 15 per transition", () => {
    const makeStarters = (prefix: string) =>
      Array.from({ length: 15 }, (_, i) => `${prefix}${i}`);
    const lineups = [
      lineup({ kickoffAt: new Date("2025-01-01"), starters: makeStarters("a") }),
      lineup({ kickoffAt: new Date("2025-01-08"), starters: makeStarters("b") }),
      lineup({ kickoffAt: new Date("2025-01-15"), starters: makeStarters("c") }),
      lineup({ kickoffAt: new Date("2025-01-22"), starters: makeStarters("d") }),
    ];
    const result = computeSelectionStability({
      lineups,
      playerBirthDates: new Map(),
      preTenureTeamPlayerIds: new Set(),
      eligibleMatches: 4,
    });
    expect(result.avgStartingXvChanges).toBe(15);
  });

  it("requires at least 3 transitions for enoughData", () => {
    const starters = Array.from({ length: 15 }, (_, i) => `p${i}`);
    const result = computeSelectionStability({
      lineups: [
        lineup({ kickoffAt: new Date("2025-01-01"), starters }),
        lineup({
          kickoffAt: new Date("2025-01-08"),
          starters: [...starters.slice(0, 14), "swap"],
        }),
      ],
      playerBirthDates: new Map(),
      preTenureTeamPlayerIds: new Set(),
      eligibleMatches: 2,
    });
    expect(result.enoughData).toBe(false);
    expect(result.stabilityScore).toBeNull();
  });

  it("counts debutants excluding pre-tenure team players", () => {
    const starters = Array.from({ length: 15 }, (_, i) => `p${i}`);
    const preTenure = new Set(starters);
    const result = computeSelectionStability({
      lineups: [
        lineup({ kickoffAt: new Date("2025-01-01"), starters }),
        lineup({
          kickoffAt: new Date("2025-01-08"),
          starters: [...starters.slice(0, 14), "new1"],
        }),
        lineup({
          kickoffAt: new Date("2025-01-15"),
          starters: [...starters.slice(0, 13), "new1", "new2"],
        }),
        lineup({
          kickoffAt: new Date("2025-01-22"),
          starters: [...starters.slice(0, 12), "new1", "new2", "new3"],
        }),
      ],
      playerBirthDates: new Map([["p0", "1995-01-01"]]),
      preTenureTeamPlayerIds: preTenure,
      eligibleMatches: 4,
    });
    expect(result.debutants).toBe(3);
    expect(result.enoughData).toBe(true);
  });
});
