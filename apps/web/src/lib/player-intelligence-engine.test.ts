import { describe, expect, it } from "vitest";
import {
  FLY_HALF_WEIGHTS_V1,
  PLAYER_FLY_HALF_MODEL,
  computePlayerIntelligence,
  detectMajorMatchLabel,
  type FlyHalfMatchSample,
} from "./player-intelligence-engine";

function sample(partial: Partial<FlyHalfMatchSample> = {}): FlyHalfMatchSample {
  return {
    fixtureId: "f1",
    matchDate: "2023-01-01",
    competitionName: "Rugby World Cup",
    minutesPlayed: 80,
    points: 12,
    tries: 0,
    conversions: 3,
    penalties: 2,
    dropGoals: 0,
    tryAssists: 1,
    metresCarried: 40,
    tacklesMade: 8,
    tacklesCompleted: 7,
    lineBreaks: 1,
    defendersBeaten: 2,
    matchRating: 7.2,
    kicks: 12,
    kicksFromHand: 10,
    kickFromHandMetres: 320,
    kickPossessionRetained: 4,
    passes: 25,
    offloads: 1,
    badPasses: 1,
    handlingError: 0,
    turnoversConceded: 1,
    missedTackles: 2,
    result: "W",
    majorMatchLabel: "World Cup",
    isCloseMatch: true,
    ...partial,
  };
}

describe("player-intelligence-engine fly-half", () => {
  it("weights sum to 100", () => {
    const sum = Object.values(FLY_HALF_WEIGHTS_V1).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("detects world cup final", () => {
    expect(detectMajorMatchLabel("Rugby World Cup Final")).toBe("World Cup Final");
  });

  it("computes overall without forcing missing dims to 0", () => {
    const result = computePlayerIntelligence({
      positionFamily: "fly_half",
      matches: [sample(), sample({ fixtureId: "f2", kicks: 0, kicksFromHand: 0, kickFromHandMetres: 0 })],
    });
    expect(result.modelVersion).toBe(PLAYER_FLY_HALF_MODEL);
    expect(result.overallRating).not.toBeNull();
    expect(result.metrics.every((m) => m.score === null || m.score > 0)).toBe(true);
  });
});
