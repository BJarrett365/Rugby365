import { describe, expect, it } from "vitest";
import {
  buildCompetitionBuildingState,
  buildPlayerRankingsTitle,
  buildRankingFilterKey,
  computePositionRankingScore,
  denseRankWithTies,
  formatRankingDisplay,
  intelligenceMetricsForPosition,
  isEligibleForCurrentRanking,
  pluralizePositionLabel,
  rankPlayerInCohort,
  resolveRankingPoolStatus,
  shortCompetitionLabel,
} from "./player-ranking-engine";
import { RANKING_MIN_ELIGIBLE } from "./player-rating-presentation";

describe("player-ranking-engine", () => {
  it("never shows a meaningful #1 of 1 (pool < 5 → PENDING)", () => {
    const fmt = formatRankingDisplay({ rank: 1, pool: 1 });
    expect(fmt.showRank).toBe(false);
    expect(fmt.rankDisplay).toBe("PENDING");
    expect(fmt.status).toBe("pending");
    expect(resolveRankingPoolStatus(1)).toBe("pending");
  });

  it("marks pool 5–9 as provisional with #N*", () => {
    const fmt = formatRankingDisplay({ rank: 3, pool: 7 });
    expect(fmt.showRank).toBe(true);
    expect(fmt.rankDisplay).toBe("#3*");
    expect(fmt.provisional).toBe(true);
    expect(fmt.status).toBe("provisional");
  });

  it("shows normal ranks at pool ≥ 10", () => {
    const fmt = formatRankingDisplay({ rank: 18, pool: 100 });
    expect(fmt.rankDisplay).toBe("#18");
    expect(fmt.provisional).toBe(false);
    expect(fmt.status).toBe("current");
  });

  it("shares ranks on ties with full-precision dense ranking", () => {
    const members = [
      { playerId: "a", score: 90.123456 },
      { playerId: "b", score: 90.123456 },
      { playerId: "c", score: 88 },
    ];
    const sorted = [...members].sort((x, y) => y.score - x.score);
    const ranks = denseRankWithTies(sorted);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(3);

    const forC = rankPlayerInCohort("c", members);
    expect(forC.rank).toBe(3);
    expect(forC.pool).toBe(3);
  });

  it("enforces eligibility min matches via empty score omission at cohort layer", () => {
    expect(RANKING_MIN_ELIGIBLE).toBe(5);
    const onlyOneEligible = rankPlayerInCohort("p1", [{ playerId: "p1", score: 70 }]);
    const display = formatRankingDisplay({
      rank: onlyOneEligible.rank,
      pool: onlyOneEligible.pool,
    });
    expect(display.rankDisplay).toBe("PENDING");
  });

  it("builds competition empty messaging with eligible counts", () => {
    const building = buildCompetitionBuildingState({
      competitionName: "United Rugby Championship",
      competitionLinked: true,
      poolPlayers: 12,
      eligibleWithMinMatches: 2,
    });
    expect(building.status).toBe("building");
    expect(building.headline).toBe("RANKINGS BUILDING");
    expect(building.eligiblePlayers).toBe(12);
    expect(building.eligibleWithMinMatches).toBe(2);
    expect(building.reason).toMatch(/at least 5 eligible/i);
  });

  it("explains missing competition link", () => {
    const building = buildCompetitionBuildingState({
      competitionName: null,
      competitionLinked: false,
      poolPlayers: 0,
      eligibleWithMinMatches: 0,
    });
    expect(building.status).toBe("building");
    expect(building.reason).toMatch(/No verified club competition/i);
  });

  it("uses position-aware intelligence metrics (fly-half vs prop)", () => {
    const fh = intelligenceMetricsForPosition("fly_half").map((m) => m.key);
    const prop = intelligenceMetricsForPosition("loosehead_prop").map((m) => m.key);
    expect(fh).toContain("goal_kicking");
    expect(fh).toContain("playmaking");
    expect(prop).toContain("defence");
    expect(prop).not.toContain("goal_kicking");
  });

  it("shortens competition labels without player hardcoding", () => {
    expect(shortCompetitionLabel("United Rugby Championship")).toBe("URC");
    expect(shortCompetitionLabel("Gallagher Premiership")).toBe("Prem");
  });

  it("pluralizes position labels for competition rows", () => {
    expect(pluralizePositionLabel("Fly-Half")).toBe("Fly-Halves");
    expect(pluralizePositionLabel("Lock")).toBe("Locks");
  });

  it("builds dynamic board titles from filters", () => {
    expect(
      buildPlayerRankingsTitle({
        mode: "current",
        top: 10,
        positionLabel: "Fly-Half",
        nationLabel: null,
        clubLabel: null,
        competitionLabel: null,
      }),
    ).toBe("WORLD TOP 10 FLY-HALVES");
    expect(
      buildPlayerRankingsTitle({
        mode: "current",
        top: 10,
        positionLabel: "Fly-Half",
        nationLabel: "South Africa",
        clubLabel: null,
        competitionLabel: null,
      }),
    ).toBe("SOUTH AFRICA TOP 10 FLY-HALVES");
    expect(
      buildPlayerRankingsTitle({
        mode: "alltime",
        top: 10,
        positionLabel: "Fly-Half",
        nationLabel: null,
        clubLabel: null,
        competitionLabel: null,
      }),
    ).toBe("GREATEST FLY-HALVES OF ALL TIME");
  });

  it("uses central eligibility (500 mins OR 8 apps)", () => {
    expect(
      isEligibleForCurrentRanking({
        minutes12m: 520,
        appearances12m: 4,
        dataPoints: 2,
        careerStatus: "active",
      }).eligible,
    ).toBe(true);
    expect(
      isEligibleForCurrentRanking({
        minutes12m: 100,
        appearances12m: 9,
        dataPoints: 2,
        careerStatus: "active",
      }).eligible,
    ).toBe(true);
    expect(
      isEligibleForCurrentRanking({
        minutes12m: 100,
        appearances12m: 2,
        dataPoints: 2,
        careerStatus: "active",
      }).eligible,
    ).toBe(false);
    expect(
      isEligibleForCurrentRanking({
        minutes12m: null,
        appearances12m: null,
        dataPoints: 5,
        careerStatus: "active",
      }).eligible,
    ).toBe(true);
  });

  it("prefers position ranking score composite for position boards", () => {
    const score = computePositionRankingScore({
      positionGroup: "fly_half",
      overall: 80,
      attack: 90,
      defence: 70,
      playmaking: 95,
      kicking: 92,
      gameManagement: 88,
      form: 85,
    });
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThan(95);
  });

  it("builds stable filter keys for snapshots", () => {
    expect(
      buildRankingFilterKey({
        mode: "current",
        position: "fly_half",
        nation: "South Africa",
        club: null,
        competition: null,
        top: 10,
        era: null,
      }),
    ).toBe("current|pos:fly_half|nat:south africa|club:all|comp:all|top:10|era:na");
  });
});
