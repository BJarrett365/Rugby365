import { describe, expect, it } from "vitest";
import {
  buildCompetitionBuildingState,
  buildPlayerRankingsTitle,
  buildRankingFilterKey,
  cleanRankingClubName,
  cleanRankingPlayerName,
  computePositionRankingScore,
  computeRatingMovementDelta,
  denseRankWithTies,
  fillDisplayMovement,
  formatRankingDisplay,
  formatRankMovementLabel,
  formatRatingMovementDelta,
  rankingCountryFlagUrl,
  usableRankingCountryName,
  intelligenceMetricsForPosition,
  isDirtyRankingPlayerName,
  isEligibleForCurrentRanking,
  pickCareerClubName,
  pickRankingClubCrest,
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

  it("formats weekly rank movement as ▲/▼ with previous rank", () => {
    expect(formatRankMovementLabel({ rank: 1, previousRank: 3 })).toEqual({
      direction: "up",
      places: 2,
      label: "▲ 2 (WAS 3)",
    });
    expect(formatRankMovementLabel({ rank: 2, previousRank: 1 })).toEqual({
      direction: "down",
      places: -1,
      label: "▼ 1 (WAS 1)",
    });
    expect(formatRankMovementLabel({ rank: 3, previousRank: 3 })).toEqual({
      direction: "flat",
      places: 0,
      label: "— (WAS 3)",
    });
    expect(formatRankMovementLabel({ rank: 1, previousRank: null })).toBeNull();
  });

  it("maps rugby nations to rectangular flag URLs", () => {
    expect(rankingCountryFlagUrl("South Africa")).toBe("https://flagcdn.com/w40/za.png");
    expect(rankingCountryFlagUrl("England")).toBe("https://flagcdn.com/w40/gb-eng.png");
    expect(rankingCountryFlagUrl("Wales")).toBe("https://flagcdn.com/w40/gb-wls.png");
    expect(rankingCountryFlagUrl("Georgia")).toBe("https://flagcdn.com/w40/ge.png");
    expect(rankingCountryFlagUrl("Portugal")).toBe("https://flagcdn.com/w40/pt.png");
    expect(rankingCountryFlagUrl("France", "FR")).toBe("https://flagcdn.com/w40/fr.png");
    expect(rankingCountryFlagUrl(null, "NZL")).toBe("https://flagcdn.com/w40/nz.png");
    expect(rankingCountryFlagUrl("Ivory Coast")).toBe("https://flagcdn.com/w40/ci.png");
    expect(usableRankingCountryName("Barbarians")).toBeNull();
    expect(usableRankingCountryName("Unknown team 33423e41967c")).toBeNull();
  });

  it("computes rating movement deltas from newest-first series", () => {
    const up = computeRatingMovementDelta([92, 91, 90, 89, 88, 80, 79, 78, 77, 76], 5);
    expect(up?.movement).toBe("up");
    expect(up!.delta).toBeGreaterThan(0);
    expect(formatRatingMovementDelta(up!.delta)).toMatch(/^\+/);

    const down = computeRatingMovementDelta([70, 71, 72, 73, 74, 90, 91, 92, 93, 94], 5);
    expect(down?.movement).toBe("down");
    expect(down!.delta).toBeLessThan(0);
  });

  it("estimates movement when history is missing so cells are never empty", async () => {
    const { estimateRankingMovement } = await import("./player-ranking-engine");
    const jean = estimateRankingMovement({
      peakRating: 50,
      careerRating: 50,
      overallScore: 58,
      clubScore: 66,
      internationalScore: 68,
    });
    expect(jean.delta).not.toBeNull();
    expect(["up", "down", "flat"]).toContain(jean.movement);
  });

  it("always fills a previous rank so competition boards never show a movement dash", () => {
    const kept = fillDisplayMovement({
      rank: 4,
      previousRank: 7,
      avgRating: 82,
    });
    expect(kept.previousRank).toBe(7);
    expect(kept.movement).toBe("up");

    const estimated = fillDisplayMovement({
      rank: 48,
      previousRank: null,
      avgRating: 71,
      ratingsNewestFirst: [71],
    });
    expect(estimated.previousRank).toBeGreaterThanOrEqual(1);
    expect(["up", "down", "flat"]).toContain(estimated.movement);
  });

  it("strips retired/released suffixes from ranking display names", () => {
    expect(cleanRankingPlayerName("John Smit retired")).toBe("John Smit");
    expect(cleanRankingPlayerName("Schalk Burger released")).toBe("Schalk Burger");
    expect(cleanRankingPlayerName("Joe Launchbury (retired)")).toBe("Joe Launchbury");
    expect(isDirtyRankingPlayerName("John Smit retired")).toBe(true);
    expect(isDirtyRankingPlayerName("John Smit")).toBe(false);
    expect(isDirtyRankingPlayerName("To Be ANNOUNCED")).toBe(true);
  });

  it("picks the club stint covering a World Cup year", () => {
    const stints = [
      { teamName: "Leicester Tigers", careerType: "club", startYear: 2010, endYear: 2018, sortOrder: 1 },
      { teamName: "Ospreys", careerType: "club", startYear: 2018, endYear: 2022, sortOrder: 2 },
      { teamName: "Provence", careerType: "club", startYear: 2022, endYear: 2024, sortOrder: 3 },
    ];
    expect(pickCareerClubName(stints, 2015)).toBe("Leicester Tigers");
    expect(pickCareerClubName(stints, 2019)).toBe("Ospreys");
    expect(pickCareerClubName(stints, 2023)).toBe("Provence");
  });

  it("strips Wikipedia rugby disambiguators from club names", () => {
    expect(cleanRankingClubName("Ospreys (rugby union)")).toBe("Ospreys");
    expect(cleanRankingClubName("Leicester Tigers")).toBe("Leicester Tigers");
    expect(cleanRankingClubName("Cardiff RFC")).toBe("Cardiff");
    expect(cleanRankingClubName("Swansea RFC")).toBe("Swansea");
    expect(cleanRankingClubName("British & Irish Lions")).toBeNull();
  });

  it("matches Wikipedia club labels to catalog crests", () => {
    const catalog = [
      { name: "Ospreys", slug: "ospreys-n0628z68", imageUrl: "https://cdn.example/ospreys.png" },
      { name: "Ospreys N0628z68 2005 09 10", slug: "ospreys-n0628z68-2005-09-10", imageUrl: null },
      { name: "Kubota Spears", slug: "kubota-spears", imageUrl: null },
      { name: "Bordeaux Begles", slug: "bordeaux-begles-do6l3o6y", imageUrl: "https://cdn.example/ubb.png" },
      { name: "Sharks", slug: "coastal-sharks", imageUrl: "https://cdn.example/sharks.png" },
      { name: "Sharks", slug: "orphan-68800845167a", imageUrl: "https://cdn.example/orphan.png" },
      { name: "Natal Sharks", slug: "natal-sharks", imageUrl: null },
      { name: "Clermont", slug: "clermont-zd93m5jv", imageUrl: "https://cdn.example/clermont.png" },
      { name: "Blue Bulls", slug: "blue-bulls", imageUrl: "https://cdn.example/bulls.png" },
      { name: "Scarlets", slug: "scarlets", imageUrl: "https://cdn.example/scarlets.png" },
    ];
    expect(pickRankingClubCrest("Ospreys (rugby union)", catalog)?.imageUrl).toContain("ospreys.png");
    expect(pickRankingClubCrest("Kubota Spears Funabashi Tokyo Bay", catalog)?.slug).toBe("kubota-spears");
    expect(pickRankingClubCrest("Harlequin F.C.", [
      ...catalog,
      { name: "Harlequins", slug: "harlequins", imageUrl: "https://cdn.example/quins.png" },
    ])?.imageUrl).toContain("quins.png");
    expect(pickRankingClubCrest("Union Bordeaux Bègles", catalog)?.imageUrl).toContain("ubb.png");
    expect(pickRankingClubCrest("Natal Sharks", catalog)?.slug).toBe("coastal-sharks");
    expect(pickRankingClubCrest("ASM Clermont Auvergne", catalog)?.imageUrl).toContain("clermont.png");
    expect(pickRankingClubCrest("Blue Bulls Rugby", catalog)?.imageUrl).toContain("bulls.png");
    expect(pickRankingClubCrest("Stade Rochelais", [
      ...catalog,
      { name: "La Rochelle", slug: "la-rochelle-4wjx1n6p", imageUrl: "https://cdn.example/larochelle.png" },
    ])?.imageUrl).toContain("larochelle.png");
    expect(pickRankingClubCrest("RC Toulonnais", [
      ...catalog,
      { name: "Toulon", slug: "toulon-krjdq463", imageUrl: "https://cdn.example/toulon.png" },
    ])?.imageUrl).toContain("toulon.png");
    expect(pickRankingClubCrest("Gloucester Rugby", [
      ...catalog,
      { name: "Gloucester", slug: "gloucester", imageUrl: "https://cdn.example/glos.png" },
    ])?.imageUrl).toContain("glos.png");
    expect(pickRankingClubCrest("Cardiff RFC", [
      ...catalog,
      { name: "Cardiff Rugby", slug: "cardiff", imageUrl: "https://cdn.example/cardiff.png" },
    ])?.imageUrl).toContain("cardiff.png");
    expect(pickRankingClubCrest("Racing Club de France", [
      ...catalog,
      { name: "Racing 92", slug: "racing-92", imageUrl: "https://cdn.example/racing.png" },
    ])?.imageUrl).toContain("racing.png");
    expect(pickRankingClubCrest("Stade Toulousain", [
      ...catalog,
      { name: "Toulouse", slug: "toulouse", imageUrl: "https://cdn.example/toulouse.png" },
    ])?.imageUrl).toContain("toulouse.png");
    expect(pickRankingClubCrest("Llanelli RFC", catalog)?.imageUrl).toContain("scarlets.png");
    expect(pickRankingClubCrest("Swansea RFC", catalog)?.imageUrl).toContain("ospreys.png");
    expect(pickRankingClubCrest("Saitama Wild Knights", [
      ...catalog,
      { name: "Panasonic Wild Knights", slug: "panasonic-wild-knights", imageUrl: "https://cdn.example/knights.png" },
    ])?.imageUrl).toContain("knights.png");
  });
});
