import { describe, expect, it } from "vitest";
import {
  ERA_INTENSITY_FACTOR,
  estimatePlayerMatchStats,
  inferJerseyFromPosition,
  inferMinutes,
  priorForJersey,
  resolveJersey,
  teamStrengthFromRecord,
  type PositionPrior80,
} from "./rwc-historical-stat-estimator";

function samplePriors() {
  const map = new Map<number, PositionPrior80>();
  map.set(7, {
    jersey: 7,
    sampleSize: 40,
    tackles: 14,
    metres: 26,
    carries: 9,
    lineBreaks: 0.25,
    defendersBeaten: 1.3,
    turnoversWon: 1.0,
    tryAssists: 0.1,
    dominantTackles: 1.0,
    postContactMetres: 11,
    touches: 15,
  });
  map.set(14, {
    jersey: 14,
    sampleSize: 35,
    tackles: 5,
    metres: 70,
    carries: 9,
    lineBreaks: 1.5,
    defendersBeaten: 3.2,
    turnoversWon: 0.25,
    tryAssists: 0.35,
    dominantTackles: 0.15,
    postContactMetres: 18,
    touches: 14,
  });
  return map;
}

describe("rwc-historical-stat-estimator", () => {
  it("infers jersey from position labels", () => {
    expect(inferJerseyFromPosition("Scrum-half")).toBe(9);
    expect(inferJerseyFromPosition("Fly-half")).toBe(10);
    expect(inferJerseyFromPosition("Openside flanker")).toBe(7);
    expect(inferJerseyFromPosition("Fullback")).toBe(15);
  });

  it("assumes 80 minutes for starting XV and limited bench minutes", () => {
    expect(inferMinutes({ jerseyNumber: 7, squadRole: "starting" })).toBe(80);
    expect(inferMinutes({ jerseyNumber: 16, squadRole: "substitute" })).toBe(25);
    expect(inferMinutes({ jerseyNumber: 7, squadRole: "starting", minutesPlayed: 55 })).toBe(55);
  });

  it("estimates more metres for a wing who scored in a blowout than a flanker in a low-score loss", () => {
    const priors = samplePriors();
    const wing = estimatePlayerMatchStats(
      {
        jerseyNumber: 14,
        positionName: "Wing",
        squadRole: "starting",
        tries: 2,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
        points: 8,
        teamScore: 70,
        oppositionScore: 6,
        teamStrength: 1.8,
        oppositionStrength: 0.6,
      },
      priors,
    );
    const flanker = estimatePlayerMatchStats(
      {
        jerseyNumber: 7,
        positionName: "Flanker",
        squadRole: "starting",
        tries: 0,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
        points: 0,
        teamScore: 6,
        oppositionScore: 70,
        teamStrength: 0.6,
        oppositionStrength: 1.8,
      },
      priors,
    );

    expect(wing.metresCarried).toBeGreaterThan(flanker.metresCarried);
    expect(flanker.tacklesCompleted).toBeGreaterThan(wing.tacklesCompleted);
    expect(wing.confidence).toBeGreaterThanOrEqual(50);
    expect(wing.reasoning).toContain("rwc_historical_position_prior_v1");
    expect(wing.lineBreaks).toBeGreaterThan(0);
    expect(ERA_INTENSITY_FACTOR).toBeLessThan(1);
  });

  it("is deterministic for identical inputs", () => {
    const priors = samplePriors();
    const input = {
      jerseyNumber: 14,
      positionName: "Wing",
      squadRole: "starting",
      tries: 1,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      points: 4,
      teamScore: 30,
      oppositionScore: 12,
      teamStrength: 1.2,
      oppositionStrength: 0.9,
    };
    expect(estimatePlayerMatchStats(input, priors)).toEqual(estimatePlayerMatchStats(input, priors));
  });

  it("maps bench jerseys onto XV position priors", () => {
    const priors = samplePriors();
    const prior = priorForJersey(20, priors); // maps toward forward pack
    expect(prior.jersey).toBeGreaterThanOrEqual(1);
    expect(prior.jersey).toBeLessThanOrEqual(15);
    expect(resolveJersey({ jerseyNumber: null, positionName: "Hooker", squadRole: "substitute" })).toBe(2);
  });

  it("computes relative team strength from points for/against", () => {
    expect(teamStrengthFromRecord(200, 40, 6)).toBeGreaterThan(teamStrengthFromRecord(40, 200, 6));
  });
});
