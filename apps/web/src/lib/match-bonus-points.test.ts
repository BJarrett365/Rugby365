import { describe, expect, it } from "vitest";
import { computeMatchBonusPoints } from "./match-bonus-points";
import { scoringRulesForCompetitionSlug } from "./table-lab/competition-scoring-rules-catalog";

describe("computeMatchBonusPoints", () => {
  it("awards try bonus for 4+ tries and losing bonus for margin ≤7", () => {
    const bonus = computeMatchBonusPoints({
      homeScore: 28,
      awayScore: 24,
      homeTries: 4,
      awayTries: 3,
    });
    expect(bonus.homeTryBonusPoints).toBe(1);
    expect(bonus.awayTryBonusPoints).toBe(0);
    expect(bonus.homeLosingBonusPoints).toBe(0);
    expect(bonus.awayLosingBonusPoints).toBe(1);
    expect(bonus.tryBonusTotal).toBe(1);
    expect(bonus.losingBonusTotal).toBe(1);
  });

  it("matches Boland 41-3 with 6 tries — try BP only for home", () => {
    const bonus = computeMatchBonusPoints({
      homeScore: 41,
      awayScore: 3,
      homeTries: 6,
      awayTries: 0,
      rules: scoringRulesForCompetitionSlug("currie-cup-pd9ro98v"),
    });
    expect(bonus.homeTryBonusPoints).toBe(1);
    expect(bonus.awayTryBonusPoints).toBe(0);
    expect(bonus.homeLosingBonusPoints).toBe(0);
    expect(bonus.awayLosingBonusPoints).toBe(0);
  });
});

describe("scoringRulesForCompetitionSlug", () => {
  it("resolves Currie Cup provider slugs to domestic bonus rules", () => {
    const rules = scoringRulesForCompetitionSlug("currie-cup-pd9ro98v");
    expect(rules.tryBonusThreshold).toBe(4);
    expect(rules.losingBonusMargin).toBe(7);
  });
});
