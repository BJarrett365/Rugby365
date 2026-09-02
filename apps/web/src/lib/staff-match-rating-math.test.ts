import { describe, expect, it } from "vitest";
import {
  computeCoachMatchRating,
  computeRefereeMatchRating,
  shouldFillCurrentCoachesForKickoff,
  staffPerformanceTrend,
} from "./staff-match-rating-math";

describe("computeCoachMatchRating", () => {
  it("rates a home win higher than a home loss", () => {
    const win = computeCoachMatchRating({
      side: "home",
      homeScore: 32,
      awayScore: 18,
      teamTries: 4,
      oppTries: 2,
      teamMetres: 450,
      oppMetres: 300,
      teamTackles: 140,
      teamTurnoversWon: 7,
      yellowCards: 0,
      redCards: 0,
    });
    const loss = computeCoachMatchRating({
      side: "home",
      homeScore: 12,
      awayScore: 40,
      teamTries: 1,
      oppTries: 5,
      teamMetres: 220,
      oppMetres: 480,
      teamTackles: 90,
      teamTurnoversWon: 2,
      yellowCards: 2,
      redCards: 1,
    });
    expect(win.rating).toBeGreaterThan(loss.rating);
    expect(win.rating).toBeGreaterThanOrEqual(6);
    expect(loss.rating).toBeLessThan(6);
  });
});

describe("computeRefereeMatchRating", () => {
  it("rewards competitive contests with balanced cards", () => {
    const rating = computeRefereeMatchRating({
      homeScore: 27,
      awayScore: 24,
      yellowCards: 3,
      redCards: 0,
      penaltyEvents: 14,
    });
    expect(rating.rating).toBeGreaterThanOrEqual(6.5);
    expect(rating.positiveImpacts.length).toBeGreaterThan(0);
  });
});

describe("staffPerformanceTrend", () => {
  it("marks first rating as new", () => {
    expect(staffPerformanceTrend(null, 7.2)).toEqual({ trend: "new", change: null });
  });

  it("detects upward movement", () => {
    expect(staffPerformanceTrend(6.5, 7.2)).toEqual({ trend: "up", change: 0.7 });
  });
});

describe("shouldFillCurrentCoachesForKickoff", () => {
  it("fills recent fixtures and skips archive World Cups", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    expect(shouldFillCurrentCoachesForKickoff(new Date("2026-08-01T12:00:00Z"), now)).toBe(true);
    expect(shouldFillCurrentCoachesForKickoff(new Date("1987-06-20T12:00:00Z"), now)).toBe(false);
    expect(shouldFillCurrentCoachesForKickoff(new Date("2023-10-28T12:00:00Z"), now)).toBe(false);
    expect(shouldFillCurrentCoachesForKickoff(null, now)).toBe(false);
  });
});
