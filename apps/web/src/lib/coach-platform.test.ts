import { describe, expect, it } from "vitest";
import { computeCareerRecord, type CoachEligibleMatch } from "./coach-career-record-service";
import {
  buildCoachRatingBundleFromMatches,
  coachRatingBundleFromSnapshot,
  computeCoachMetrics,
  computeOverallRating,
  computePowerIndex,
  previousCoachRanksByRating,
  POWER_INDEX_WEIGHTS,
} from "./coach-rating-service";
import {
  compareProposedHonours,
  parseCoachHonoursFromHtml,
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
    expect(power.detail.excludedKeys).toContain("set_piece");
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
        {
          key: "big_match_performance",
          label: "Big Match",
          score: 88,
          worldRank: null,
          raw: {},
        },
        {
          key: "player_development",
          label: "Player Development",
          score: 80,
          worldRank: null,
          raw: {},
        },
        {
          key: "experience",
          label: "Experience",
          score: 85,
          worldRank: null,
          raw: {},
        },
      ],
      88,
      80,
    );
    expect(overall).not.toBeNull();
    expect(overall!).toBeGreaterThan(50);
    expect(overall!).toBeLessThanOrEqual(100);
  });

  it("hydrates a public rating bundle from a stored snapshot without recalculating", () => {
    const bundle = coachRatingBundleFromSnapshot({
      overallRating: 81.2,
      powerIndex: 77,
      worldRank: 3,
      momentum: 1.4,
      modelVersion: "coach-rating-v1",
      powerIndexVersion: "coach-power-v1",
      dataConfidence: "high",
      metrics: {
        previousOverallRating: 80,
        overallRatingChange: 1.2,
        previousWorldRank: 4,
        worldRankChange: 1,
        competitionRank: 1,
        competitionRankLabel: "Six Nations",
        intelligence: [{ key: "results", label: "Results", score: 88 }],
        metrics: [{ key: "results", label: "Results", score: 88 }],
        contributions: [{ key: "results", weight: 20, score: 88, contribution: 17.6 }],
        coachRating: { matchesUsed: 40, eligibleForWorldRank: true },
        ratingConfidencePct: 90,
      },
    });
    expect(bundle.overallRating).toBe(81.2);
    expect(bundle.worldRank).toBe(3);
    expect(bundle.matchCount).toBe(40);
    expect(bundle.provisional).toBe(false);
    expect(bundle.competitionRankLabel).toBe("Six Nations");
    expect(bundle.intelligence[0]?.score).toBe(88);
  });

  it("builds a public rating bundle from match results when no snapshot exists", () => {
    const matches = Array.from({ length: 12 }, (_, i) =>
      match({
        id: `m${i}`,
        forScore: i % 4 === 0 ? 10 : 28,
        againstScore: i % 4 === 0 ? 22 : 14,
      }),
    );
    const bundle = buildCoachRatingBundleFromMatches(matches);
    expect(bundle.overallRating).not.toBeNull();
    expect(bundle.powerIndex).not.toBeNull();
    expect(bundle.intelligence.length).toBeGreaterThan(0);
    expect(bundle.matchCount).toBe(12);
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

  it("parses Champion: year lists without a Winners: prefix", () => {
    const proposed = parseWikipediaHonourLines(["Six Nations Championship Champion: 2023, 2024"]);
    expect(proposed.map((p) => p.year)).toEqual([2023, 2024]);
    expect(proposed[0]?.competitionName).toMatch(/six nations/i);
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

describe("parseCoachHonoursFromHtml", () => {
  it("reads nested Champion year lists and individual awards", () => {
    const html = `
      <h2>Honours</h2>
      <h3>As coach</h3>
      <p><b>Ireland</b></p>
      <ul>
        <li>Six Nations Championship
          <ul>
            <li>Champion: 2023</li>
            <li>Champion: 2024</li>
          </ul>
        </li>
        <li>World Rugby Coach of the Year: 2023</li>
      </ul>
      <h2>References</h2>
    `;
    const rows = parseCoachHonoursFromHtml(html);
    expect(rows.some((r) => /six nations/i.test(r.competitionName) && r.year === 2023)).toBe(true);
    expect(rows.some((r) => /six nations/i.test(r.competitionName) && r.year === 2024)).toBe(true);
    expect(rows.some((r) => /coach of the year/i.test(r.competitionName) && r.kind === "award")).toBe(true);
  });
});

describe("previousCoachRanksByRating", () => {
  it("ranks previous snapshot ratings so every board row can show Move", () => {
    const ranks = previousCoachRanksByRating([
      { coachId: "a", rating: 80 },
      { coachId: "b", rating: 90 },
      { coachId: "c", rating: 70 },
    ]);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("a")).toBe(2);
    expect(ranks.get("c")).toBe(3);
  });

  it("keeps first-time coaches in place when current rating is used as previous", () => {
    const ranks = previousCoachRanksByRating([
      { coachId: "new-top", rating: 90 },
      { coachId: "old", rating: 80 },
    ]);
    expect(ranks.get("new-top")).toBe(1);
    expect(ranks.get("old")).toBe(2);
  });
});
