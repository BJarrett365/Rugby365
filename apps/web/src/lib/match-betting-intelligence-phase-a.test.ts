import { describe, expect, it } from "vitest";
import {
  haversineKm,
  travelDisadvantageFromKm,
  weatherFitSide,
  weightedSquadRating,
} from "./match-betting-intelligence-phase-a";

describe("match-betting-intelligence-phase-a", () => {
  it("computes haversine distance in km", () => {
    // Roughly London → Paris
    const km = haversineKm(51.5, -0.12, 48.86, 2.35);
    expect(km).toBeGreaterThan(300);
    expect(km).toBeLessThan(400);
  });

  it("maps travel km to disadvantage band", () => {
    expect(travelDisadvantageFromKm(50)).toBe(0);
    expect(travelDisadvantageFromKm(200)).toBe(0);
    expect(travelDisadvantageFromKm(8000)).toBe(1);
    expect(travelDisadvantageFromKm(4100)).toBeCloseTo(0.5, 1);
  });

  it("weights starters above bench in squad rating", () => {
    const avg = weightedSquadRating([
      { careerRating: 90, squadRole: "starter", jerseyNumber: 10 },
      { careerRating: 60, squadRole: "bench", jerseyNumber: 22 },
    ]);
    expect(avg).toBeGreaterThan(78);
    expect(avg).toBeLessThan(90);
  });

  it("picks heat/cold climate fit sides", () => {
    expect(
      weatherFitSide({ tempC: 32, homeClimateLat: -12, awayClimateLat: -45 }),
    ).toBe("home");
    expect(
      weatherFitSide({ tempC: 4, homeClimateLat: -12, awayClimateLat: -45 }),
    ).toBe("away");
    expect(
      weatherFitSide({ tempC: 18, homeClimateLat: -12, awayClimateLat: -45 }),
    ).toBeNull();
  });
});
