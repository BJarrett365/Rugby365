import { describe, expect, it } from "vitest";
import {
  ageAdjustmentFactor,
  buildCoachPlayerDevelopmentBundle,
  calculateCoachDevelopmentScore,
  calculatePlayerDevelopmentRow,
  ceilingFactor,
  resolveBaseline,
  resolveCurrentUnderCoach,
  resolveTrend,
  sampleSizeFactor,
  toDevelopmentScore,
  type CoachPlayerRatedAppearance,
} from "./coach-player-development-engine";

function app(
  partial: Partial<CoachPlayerRatedAppearance> & { rating: number; underCoach: boolean },
): CoachPlayerRatedAppearance {
  return {
    fixtureId: partial.fixtureId ?? crypto.randomUUID(),
    kickoffAt: partial.kickoffAt ?? new Date("2025-01-01"),
    rating: partial.rating,
    minutesPlayed: partial.minutesPlayed ?? 80,
    isStart: partial.isStart ?? true,
    positionName: partial.positionName ?? "Fly-half",
    competitionLevel: partial.competitionLevel ?? null,
    underCoach: partial.underCoach,
  };
}

describe("CoachPlayerDevelopmentEngine", () => {
  it("uses pre-coach last 5 as true baseline when available", () => {
    const tenureStart = new Date("2024-02-01");
    const appearances = [
      ...[6.0, 6.2, 6.1, 6.3, 6.4].map((rating, i) =>
        app({
          rating,
          underCoach: false,
          kickoffAt: new Date(`2023-0${i + 1}-01`),
        }),
      ),
      ...[7.0, 7.2, 7.5, 7.8, 8.0].map((rating, i) =>
        app({
          rating,
          underCoach: true,
          kickoffAt: new Date(`2024-0${i + 3}-01`),
        }),
      ),
    ];
    const baseline = resolveBaseline(appearances, tenureStart);
    expect(baseline.baselineSource).toBe("pre_coach_last_5");
    expect(baseline.baselineSampleSize).toBe(5);
    expect(baseline.baselineRating).toBeCloseTo(6.2, 1);
  });

  it("falls back to tenure-start first 3 when no pre-coach data", () => {
    const appearances = [6.5, 6.8, 7.0, 7.2, 7.5].map((rating, i) =>
      app({
        rating,
        underCoach: true,
        kickoffAt: new Date(`2024-0${i + 1}-01`),
      }),
    );
    const baseline = resolveBaseline(appearances, new Date("2024-01-01"));
    expect(baseline.baselineSource).toBe("tenure_start_first_3");
    expect(baseline.baselineRating).toBeCloseTo((6.5 + 6.8 + 7.0) / 3, 2);
  });

  it("computes displayed change as current − baseline (public number)", () => {
    const tenureStart = new Date("2024-02-01");
    const appearances = [
      ...[7.0, 7.0, 7.0, 7.0, 7.0].map((rating, i) =>
        app({ rating, underCoach: false, kickoffAt: new Date(`2023-0${i + 1}-15`) }),
      ),
      ...[8.0, 8.2, 8.5, 8.7, 9.0].map((rating, i) =>
        app({ rating, underCoach: true, kickoffAt: new Date(`2024-0${i + 3}-15`) }),
      ),
    ];
    const row = calculatePlayerDevelopmentRow({
      playerId: "p1",
      playerName: "Manie Libbok",
      playerSlug: "manie-libbok",
      playerImageUrl: "/x.png",
      position: "Fly-half",
      age: 26,
      appearances,
      tenureStartAt: tenureStart,
      teamWideRatingDelta: 0.2,
    });
    expect(row.baselineRating).toBe(7);
    expect(row.currentRating).not.toBeNull();
    expect(row.displayedChange).toBe(row.rawChange);
    expect(row.displayedChange!).toBeGreaterThan(1);
    expect(row.adjustedDevelopmentScore).not.toBeNull();
    expect(row.eligiblePublic).toBe(true);
  });

  it("ranks by adjusted score, not raw displayed change", () => {
    const make = (name: string, baseline: number, current: number, age: number) => {
      const pre = Array.from({ length: 5 }, (_, i) =>
        app({
          rating: baseline,
          underCoach: false,
          kickoffAt: new Date(`2023-0${i + 1}-01`),
        }),
      );
      const under = Array.from({ length: 6 }, (_, i) =>
        app({
          rating: current,
          underCoach: true,
          kickoffAt: new Date(`2024-0${Math.min(i + 1, 9)}-01`),
        }),
      );
      return calculatePlayerDevelopmentRow({
        playerId: name,
        playerName: name,
        playerSlug: name,
        playerImageUrl: null,
        position: "Centre",
        age,
        appearances: [...pre, ...under],
        tenureStartAt: new Date("2024-01-01"),
        teamWideRatingDelta: 0,
      });
    };
    // Same raw lift (+2), but lower baseline gets more ceiling credit
    const lowBase = make("LowBase", 6.0, 8.0, 22);
    const highBase = make("HighBase", 8.5, 10.5, 29);
    expect(lowBase.displayedChange).toBeCloseTo(highBase.displayedChange!, 0);
    expect(lowBase.adjustedDevelopmentScore!).toBeGreaterThan(highBase.adjustedDevelopmentScore!);
  });

  it("computes recent trend independently of overall change", () => {
    const under = [
      app({ rating: 6.0, underCoach: true, kickoffAt: new Date("2024-01-01") }),
      app({ rating: 7.0, underCoach: true, kickoffAt: new Date("2024-02-01") }),
      app({ rating: 8.5, underCoach: true, kickoffAt: new Date("2024-03-01") }),
      app({ rating: 8.0, underCoach: true, kickoffAt: new Date("2024-04-01") }),
      app({ rating: 7.2, underCoach: true, kickoffAt: new Date("2024-05-01") }),
      app({ rating: 6.8, underCoach: true, kickoffAt: new Date("2024-06-01") }),
    ];
    const trend = resolveTrend(under);
    // prev3 avg 7.17 → last3 avg 7.33 would be stable; make clearer decline:
    expect(["down", "stable", "up"]).toContain(trend.trend);
    const clearer = [
      app({ rating: 7.0, underCoach: true, kickoffAt: new Date("2024-01-01") }),
      app({ rating: 7.5, underCoach: true, kickoffAt: new Date("2024-02-01") }),
      app({ rating: 8.5, underCoach: true, kickoffAt: new Date("2024-03-01") }),
      app({ rating: 7.0, underCoach: true, kickoffAt: new Date("2024-04-01") }),
      app({ rating: 6.5, underCoach: true, kickoffAt: new Date("2024-05-01") }),
      app({ rating: 6.0, underCoach: true, kickoffAt: new Date("2024-06-01") }),
    ];
    expect(resolveTrend(clearer).trend).toBe("down");
  });

  it("requires 3 players for enoughData on public bundle", () => {
    const rows = [1, 2].map((n) =>
      calculatePlayerDevelopmentRow({
        playerId: `p${n}`,
        playerName: `Player ${n}`,
        playerSlug: `p${n}`,
        playerImageUrl: null,
        position: "Prop",
        age: 24,
        appearances: [
          ...Array.from({ length: 5 }, (_, i) =>
            app({ rating: 6, underCoach: false, kickoffAt: new Date(`2023-0${i + 1}-01`) }),
          ),
          ...Array.from({ length: 5 }, (_, i) =>
            app({ rating: 7.5, underCoach: true, kickoffAt: new Date(`2024-0${i + 1}-01`) }),
          ),
        ],
        tenureStartAt: new Date("2024-01-01"),
        teamWideRatingDelta: 0,
      }),
    );
    const bundle = buildCoachPlayerDevelopmentBundle(rows, { playersUsed: 2 });
    expect(bundle.enoughData).toBe(false);
  });

  it("builds coach-level score from player rows", () => {
    const rows = [1, 2, 3, 4].map((n) =>
      calculatePlayerDevelopmentRow({
        playerId: `p${n}`,
        playerName: `Player ${n}`,
        playerSlug: `p${n}`,
        playerImageUrl: null,
        position: "Lock",
        age: 23 + n,
        appearances: [
          ...Array.from({ length: 5 }, (_, i) =>
            app({ rating: 6.5, underCoach: false, kickoffAt: new Date(`2023-0${i + 1}-01`) }),
          ),
          ...Array.from({ length: 6 }, (_, i) =>
            app({ rating: 7.8, underCoach: true, kickoffAt: new Date(`2024-0${Math.min(i + 1, 9)}-01`) }),
          ),
        ],
        tenureStartAt: new Date("2024-01-01"),
        teamWideRatingDelta: 0.1,
        debutGiven: n === 1,
        careerHighUnderCoach: n <= 2,
      }),
    );
    const { score, components } = calculateCoachDevelopmentScore(rows);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(40);
    expect(components.average_adjusted).not.toBeNull();
  });

  it("applies modest age and sample factors", () => {
    expect(Math.abs(ageAdjustmentFactor(21, 2))).toBeLessThanOrEqual(0.2);
    expect(sampleSizeFactor(10, 5)).toBeGreaterThan(sampleSizeFactor(3, 2));
    expect(ceilingFactor(6)).toBeGreaterThan(ceilingFactor(9));
    expect(toDevelopmentScore(0)).toBe(50);
  });

  it("weights recent appearances in current rating", () => {
    const under = [6, 6, 6, 9, 9].map((rating, i) =>
      app({ rating, underCoach: true, kickoffAt: new Date(`2024-0${i + 1}-01`) }),
    );
    const { currentRating } = resolveCurrentUnderCoach(under);
    const plainAvg = (6 + 6 + 6 + 9 + 9) / 5;
    expect(currentRating!).toBeGreaterThan(plainAvg);
  });
});
