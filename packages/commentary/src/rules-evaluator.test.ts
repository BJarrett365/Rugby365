import { describe, it, expect } from "vitest";
import { ruleMatches } from "./rules-evaluator";

describe("ruleMatches", () => {
  const rule = {
    id: "1",
    name: "phase",
    conditions: { event_type: "phase_milestone", zone: "opposition_22", phase_gte: 5 },
    templateKeys: ["a", "b", "c", "d"],
    maxSuggestions: 4,
    outputType: "phase_play_update",
  };

  it("matches phase 7 in opp 22", () => {
    expect(
      ruleMatches(rule, {
        eventType: "phase_milestone",
        payload: { zone: "opposition_22", phase: 7 },
      }),
    ).toBe(true);
  });

  it("rejects wrong zone", () => {
    expect(
      ruleMatches(rule, {
        eventType: "phase_milestone",
        payload: { zone: "midfield", phase: 7 },
      }),
    ).toBe(false);
  });
});
