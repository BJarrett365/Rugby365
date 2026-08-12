import { describe, expect, it } from "vitest";
import {
  computeCoachPowerIndex,
  POWER_INDEX_WEIGHTS_V1,
  assertIntelligencePowerIndexConsistency,
} from "./coach-power-index-engine";
import type { CoachIntelligenceMetric } from "./coach-intelligence-engine";
import { COACH_INTELLIGENCE_VERSION } from "./coach-intelligence-engine";

function metric(
  key: CoachIntelligenceMetric["key"],
  score: number | null,
  extras: Partial<CoachIntelligenceMetric> = {},
): CoachIntelligenceMetric {
  return {
    key,
    label: key,
    score,
    worldRank: null,
    raw: {},
    confidence: score != null ? 90 : 20,
    sampleSize: 20,
    dataCoverage: score != null ? 100 : 0,
    period: "test",
    calculatedAt: new Date().toISOString(),
    modelVersion: COACH_INTELLIGENCE_VERSION,
    trend: null,
    components: {},
    availableInputs: score != null ? ["x"] : [],
    missingInputs: score != null ? [] : ["x"],
    status: score != null ? "CURRENT" : "INSUFFICIENT",
    ...extras,
  };
}

describe("coach-power-index-engine", () => {
  it("weights sum to 100", () => {
    expect(Object.values(POWER_INDEX_WEIGHTS_V1).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("uses Intelligence scores as single source of truth", () => {
    const intel = [
      metric("results", 90, { components: { opponent_strength: 85 } }),
      metric("attack", 100),
      metric("defence", 66),
      metric("set_piece", 95),
      metric("breakdown", 93),
      metric("kicking", 88),
      metric("discipline", 90),
      metric("selection", 89),
      metric("player_development", 92),
      metric("experience", 95),
      metric("current_form", 97),
      metric("game_management", 94),
      metric("big_match_performance", 98),
      metric("bench_impact", 80),
      metric("squad_depth", 80),
    ];
    const power = computeCoachPowerIndex(intel, { matchesUsed: 20 });
    expect(power.mismatches).toHaveLength(0);
    expect(assertIntelligencePowerIndexConsistency(intel, power)).toHaveLength(0);
    for (const c of power.contributions) {
      if (c.key === "opponent_strength") {
        expect(c.score).toBe(85);
        continue;
      }
      const m = intel.find((x) => x.key === c.key)!;
      expect(c.score).toBe(m.score);
    }
    expect(power.score).not.toBeNull();
    expect(power.contributions.some((c) => c.key === "game_management")).toBe(true);
    expect(power.modifiers.find((m) => m.key === "game_management")).toBeUndefined();
    expect(Math.abs(power.modifierTotal)).toBeLessThanOrEqual(3);
  });

  it("excludes missing metrics and renormalises (never treats as 0)", () => {
    const intel = [
      metric("results", 90, { components: { opponent_strength: 80 } }),
      metric("attack", 100),
      metric("defence", 80),
      metric("set_piece", null),
      metric("breakdown", 70),
      metric("kicking", 70),
      metric("discipline", 70),
      metric("selection", 70),
      metric("player_development", 70),
      metric("experience", 70),
      metric("current_form", 90),
      metric("game_management", 75),
    ];
    const power = computeCoachPowerIndex(intel, { matchesUsed: 10 });
    expect(power.excludedKeys).toContain("set_piece");
    expect(power.contributions.find((c) => c.key === "set_piece")).toBeUndefined();
    expect(power.publishable).toBe(true);
    expect(power.score).not.toBeNull();
    expect(power.score!).toBeGreaterThan(50);
    expect(power.weightedCoverage).toBeLessThan(100);
    expect(power.reweighted).toBe(true);
  });

  it("does not publish below 60% weighted coverage", () => {
    const intel = [metric("kicking", 80)]; // 5% weight only
    const power = computeCoachPowerIndex(intel);
    expect(power.publishable).toBe(false);
    expect(power.score).toBeNull();
    expect(power.confidenceBand).toBe("INSUFFICIENT");
  });
});
