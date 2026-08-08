import { describe, expect, it } from "vitest";
import { computeCareerRecord, type CoachEligibleMatch } from "./coach-career-record-service";
import {
  computeCoachMetrics,
  computeOverallRating,
  computePowerIndex,
  POWER_INDEX_WEIGHTS,
} from "./coach-rating-service";
import {
  compareProposedHonours,
  parseWikipediaHonourLines,
} from "./coach-wikipedia-honours-parse";

function match(
  partial: Partial<CoachEligibleMatch> & { forScore: number; againstScore: number },
): CoachEligibleMatch {
  const margin = partial.forScore - partial.againstScore;
  return {
    id: partial.id ?? "m",
    slug: "m",
    kickoffAt: partial.kickoffAt ?? new Date(),
    competitionName: null,
    teamId: "t",
    teamName: "Team",
    opponentName: "Opp",
    forScore: partial.forScore,
    againstScore: partial.againstScore,
    result: margin > 0 ? "W" : margin < 0 ? "L" : "D",
    margin,
    side: "home",
  };
}

describe("computeCareerRecord", () => {
  it("reconciles P = W+D+L and computes win rate", () => {
    const matches = [
      match({ forScore: 20, againstScore: 10 }),
      match({ forScore: 10, againstScore: 10 }),
      match({ forScore: 5, againstScore: 15 }),
      match({ forScore: 30, againstScore: 0 }),
    ];
    const rec = computeCareerRecord(matches);
    expect(rec.played).toBe(4);
    expect(rec.wins).toBe(2);
    expect(rec.draws).toBe(1);
    expect(rec.losses).toBe(1);
    expect(rec.reconciled).toBe(true);
    expect(rec.winRate).toBe(50);
    expect(rec.biggestWin?.margin).toBe(30);
    expect(rec.biggestLoss?.margin).toBe(-10);
    expect(rec.longestWinStreak).toBe(1);
  });

  it("tracks current and longest win streaks", () => {
    const matches = [
      match({ forScore: 1, againstScore: 0 }),
      match({ forScore: 1, againstScore: 0 }),
      match({ forScore: 0, againstScore: 1 }),
      match({ forScore: 1, againstScore: 0 }),
      match({ forScore: 1, againstScore: 0 }),
      match({ forScore: 1, againstScore: 0 }),
    ];
    const rec = computeCareerRecord(matches);
    expect(rec.longestWinStreak).toBe(3);
    expect(rec.currentWinStreak).toBe(3);
  });
});

describe("coach rating / power index", () => {
  it("weights sum to 100", () => {
    const sum = Object.values(POWER_INDEX_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("computes metrics and power index from matches without inventing sparse stats", () => {
    const matches = Array.from({ length: 12 }, (_, i) =>
      match({
        id: `m${i}`,
        forScore: i % 3 === 0 ? 10 : 30,
        againstScore: i % 3 === 0 ? 20 : 12,
      }),
    );
    const metrics = computeCoachMetrics(matches);
    expect(metrics.find((m) => m.key === "results")?.score).not.toBeNull();
    expect(metrics.find((m) => m.key === "set_piece")?.score).toBeNull();
    const power = computePowerIndex(metrics);
    expect(power.score).not.toBeNull();
    expect(power.score!).toBeGreaterThan(0);
    expect(power.score!).toBeLessThanOrEqual(100);
    const overall = computeOverallRating(metrics, power.score, 70);
    expect(overall).not.toBeNull();
    expect(overall!).toBeGreaterThan(0);
    expect(overall!).toBeLessThanOrEqual(100);
  });

  it("keeps overall rating on a 0–100 scale (one decimal)", () => {
    const overall = computeOverallRating(
      [
        {
          key: "results",
          label: "Results",
          score: 90,
          worldRank: null,
          raw: {},
        },
      ],
      88,
      80,
    );
    expect(overall).toBeGreaterThanOrEqual(80);
    expect(overall!).toBeLessThanOrEqual(100);
  });
});

describe("parseWikipediaHonourLines", () => {
  it("explodes multi-year winners into discrete records", () => {
    const proposed = parseWikipediaHonourLines([
      "Rugby World Cup — Winners: 2019, 2023",
      "2019 Rugby Championship Winner",
    ]);
    expect(proposed).toHaveLength(3);
    expect(proposed.filter((p) => p.competitionName.includes("World Cup")).map((p) => p.year)).toEqual([
      2019, 2023,
    ]);
    expect(proposed.every((p) => p.achievementType === "winner")).toBe(true);
  });

  it("flags missing vs existing without auto-merge", () => {
    const proposed = parseWikipediaHonourLines(["Rugby World Cup — Winners: 2019, 2023"]);
    const review = compareProposedHonours(proposed, [
      { competitionName: "Rugby World Cup", year: 2019, achievementType: "winner" },
    ]);
    expect(review.missing).toHaveLength(1);
    expect(review.missing[0]?.year).toBe(2023);
  });
});
