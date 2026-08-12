import { describe, expect, it } from "vitest";
import {
  formatImpactChange,
  isImpactImproved,
  impactMetricDef,
} from "./coach-impact-engine";

describe("CoachImpactEngine", () => {
  it("treats lower points against as improvement", () => {
    const def = impactMetricDef("points_against_per_game");
    expect(isImpactImproved(def.direction, 19.8, 14.2)).toBe(true);
    const change = formatImpactChange(def, 19.8, 14.2);
    expect(change.improved).toBe(true);
    expect(change.label).toBe("-5.6");
  });

  it("formats win rate as percentage points", () => {
    const def = impactMetricDef("win_rate");
    const change = formatImpactChange(def, 55, 78);
    expect(change.label).toBe("+23 pts");
    expect(change.improved).toBe(true);
  });

  it("formats world rank as places gained", () => {
    const def = impactMetricDef("world_rank");
    const change = formatImpactChange(def, 7, 1);
    expect(change.label).toBe("▲ 6 places");
    expect(change.raw).toBe(6);
    expect(change.improved).toBe(true);
  });

  it("flags worse world rank correctly", () => {
    const def = impactMetricDef("world_rank");
    const change = formatImpactChange(def, 2, 5);
    expect(change.label).toBe("▼ 3 places");
    expect(change.improved).toBe(false);
  });
});
