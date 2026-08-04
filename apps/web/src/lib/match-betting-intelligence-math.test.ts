import { describe, expect, it } from "vitest";
import {
  buildBetBuilderSuggestions,
  buildBettingSignals,
  buildMatchMarketInsights,
  buildTeamNarrativeInsights,
  buildTeamTrendWindows,
  combineLegProbabilities,
  computeBettingPrediction,
  computePlayerPropRow,
  hashVarietySeed,
  probabilitiesFromEdge,
  selectBestValueBets,
  selectVariedInsights,
  type FinishedTeamMatch,
  type InsightEventRow,
} from "./match-betting-intelligence-math";

describe("match-betting-intelligence-math", () => {
  it("keeps win probabilities summing to 100", () => {
    for (const edge of [-1.2, -0.3, 0, 0.4, 1.1]) {
      const p = probabilitiesFromEdge(edge);
      expect(p.homeWinPct + p.drawPct + p.awayWinPct).toBe(100);
    }
  });

  it("leans home when ratings, form and venue favour home", () => {
    const input = {
      homeName: "Leinster",
      awayName: "Toulouse",
      homeAvgRating: 88,
      awayAvgRating: 82,
      homeFormWins: 4,
      homeFormPlayed: 5,
      awayFormWins: 2,
      awayFormPlayed: 5,
      h2hHomeWins: 3,
      h2hAwayWins: 1,
      h2hDraws: 0,
      homeUnavailable: 1,
      awayUnavailable: 4,
      homeCoachRating: 8.2,
      awayCoachRating: 7.4,
      hasHomeVenue: true,
      weatherHarsh: false,
    };
    const signals = buildBettingSignals(input);
    const prediction = computeBettingPrediction(input, signals);
    expect(prediction.modelVersion).toBe("betting-intel-v1.1");
    expect(prediction.lean).toBe("home");
    expect(prediction.homeWinPct).toBeGreaterThan(prediction.awayWinPct);
    expect(prediction.expectedHomeScore).toBeGreaterThan(prediction.expectedAwayScore);
    expect(Number.isInteger(prediction.expectedHomeScore)).toBe(true);
    expect(Number.isInteger(prediction.expectedAwayScore)).toBe(true);
    expect(Number.isInteger(prediction.expectedHomeTries)).toBe(true);
    expect(Number.isInteger(prediction.expectedAwayTries)).toBe(true);
    expect(prediction.confidencePct).toBeGreaterThanOrEqual(60);
  });

  it("caps home advantage when visitors are clearly stronger", () => {
    const base = {
      homeName: "Home Club",
      awayName: "Touring Giants",
      homeAvgRating: 70,
      awayAvgRating: 90,
      homeFormWins: 2,
      homeFormPlayed: 5,
      awayFormWins: 2,
      awayFormPlayed: 5,
      h2hHomeWins: 0,
      h2hAwayWins: 0,
      h2hDraws: 0,
      homeUnavailable: 0,
      awayUnavailable: 0,
      homeCoachRating: null,
      awayCoachRating: null,
      hasHomeVenue: true,
      weatherHarsh: false,
    };
    const signals = buildBettingSignals(base);
    const homeSig = signals.find((s) => s.key === "home_advantage");
    expect(homeSig?.weight).toBeLessThanOrEqual(0.03);
    const prediction = computeBettingPrediction(base, signals);
    expect(prediction.lean).toBe("away");
  });

  it("applies Phase A international, fatigue and travel signals", () => {
    const input = {
      homeName: "Blues",
      awayName: "Chiefs",
      homeAvgRating: 78,
      awayAvgRating: 78,
      homeFormWins: 2,
      homeFormPlayed: 4,
      awayFormWins: 2,
      awayFormPlayed: 4,
      h2hHomeWins: 0,
      h2hAwayWins: 0,
      h2hDraws: 0,
      homeUnavailable: 0,
      awayUnavailable: 0,
      homeCoachRating: null,
      awayCoachRating: null,
      hasHomeVenue: true,
      weatherHarsh: false,
      homeIntlShare: 0.7,
      awayIntlShare: 0.2,
      homeFatigueShare: 0.05,
      awayFatigueShare: 0.45,
      homeTravelKm: 80,
      awayTravelKm: 2200,
      kickoffTempC: 30,
      homeClimateLat: -18,
      awayClimateLat: -45,
    };
    const signals = buildBettingSignals(input);
    expect(signals.map((s) => s.key)).toEqual(
      expect.arrayContaining([
        "international_quality",
        "fatigue",
        "travel",
        "weather_fit",
      ]),
    );
    expect(signals.find((s) => s.key === "international_quality")?.side).toBe("home");
    expect(signals.find((s) => s.key === "fatigue")?.side).toBe("home");
    expect(signals.find((s) => s.key === "travel")?.side).toBe("home");
    expect(signals.find((s) => s.key === "weather_fit")?.side).toBe("home");
    const prediction = computeBettingPrediction(input, signals);
    expect(prediction.homeWinPct).toBeGreaterThan(prediction.awayWinPct);
  });

  it("keeps expected score aligned with away lean (form/h2h beat home boost)", () => {
    // Mirrors Griquas v Cheetahs: home venue only, form + h2h favour away.
    const input = {
      homeName: "Griquas",
      awayName: "Cheetahs",
      homeAvgRating: null,
      awayAvgRating: null,
      homeFormWins: 1,
      homeFormPlayed: 2,
      awayFormWins: 2,
      awayFormPlayed: 3,
      h2hHomeWins: 3,
      h2hAwayWins: 4,
      h2hDraws: 0,
      homeUnavailable: 0,
      awayUnavailable: 0,
      homeCoachRating: null,
      awayCoachRating: null,
      hasHomeVenue: true,
      weatherHarsh: false,
    };
    const signals = buildBettingSignals(input);
    const prediction = computeBettingPrediction(input, signals);
    expect(prediction.lean).toBe("away");
    expect(prediction.awayWinPct).toBeGreaterThan(prediction.homeWinPct);
    expect(prediction.expectedAwayScore).toBeGreaterThan(prediction.expectedHomeScore);
    expect(prediction.expectedAwayTries).toBeGreaterThanOrEqual(
      prediction.expectedHomeTries,
    );
  });

  it("covers Betway-style market angles from the prediction", () => {
    const prediction = {
      modelVersion: "betting-intel-v1",
      homeWinPct: 54,
      drawPct: 4,
      awayWinPct: 42,
      lean: "home" as const,
      confidencePct: 72,
      expectedHomeScore: 32.5,
      expectedAwayScore: 28,
      expectedHomeTries: 4.2,
      expectedAwayTries: 3.6,
      winningMargin: [
        { key: "1-7" as const, label: "1–7", probability: 40 },
        { key: "8-14" as const, label: "8–14", probability: 34 },
        { key: "15+" as const, label: "15+", probability: 26 },
      ],
    };
    const markets = buildMatchMarketInsights({
      homeName: "Griquas",
      awayName: "Cheetahs",
      prediction,
      homeMatches: [],
      awayMatches: [],
    });
    expect(markets.length).toBeGreaterThanOrEqual(6);
    expect(markets.length).toBeLessThanOrEqual(10);
    expect(markets.map((m) => m.key)).toEqual(
      expect.arrayContaining(["wdw", "handicap", "total_points"]),
    );
    const totals = markets.find((m) => m.key === "total_points");
    // 32.5 + 28 → 61 whole points (rugby scores can't be fractional)
    expect(totals?.modelValue).toBe("61");
    expect(totals?.body).toMatch(/Modelled combined points 61\b/);
    expect(totals?.body).not.toMatch(/Modelled combined points \d+\.\d/);
    const teamTotals = markets.find((m) => m.key === "team_totals");
    expect(teamTotals?.modelValue).toBe("33 / 28");
  });

  it("selects the best value bets most likely to happen", () => {
    const prediction = {
      modelVersion: "betting-intel-v1",
      homeWinPct: 58,
      drawPct: 4,
      awayWinPct: 38,
      lean: "home" as const,
      confidencePct: 74,
      expectedHomeScore: 28,
      expectedAwayScore: 19,
      expectedHomeTries: 3.5,
      expectedAwayTries: 2.2,
      winningMargin: [
        { key: "1-7" as const, label: "1–7", probability: 42 },
        { key: "8-14" as const, label: "8–14", probability: 33 },
        { key: "15+" as const, label: "15+", probability: 25 },
      ],
    };
    const picks = selectBestValueBets({
      homeName: "Griquas",
      awayName: "Cheetahs",
      prediction,
      signals: [
        {
          key: "form",
          side: "home",
          weight: 1,
          label: "Strong home form",
          detail: "Won 4 of last 5",
        },
      ],
      topTryScorer: {
        playerId: "p1",
        playerName: "Test Wing",
        teamSide: "home",
        positionName: "Wing",
        jerseyNumber: 14,
        careerRating: 80,
        formRating: 78,
        tryPct: 31,
        assistPct: 12,
        motmPct: 8,
        expectedTackles: 6,
        expectedCarries: 9,
        expectedMetres: 55,
        expectedLineBreaks: 1.2,
        sampleMatches: 5,
      },
      limit: 5,
    });
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(picks.length).toBeLessThanOrEqual(5);
    expect(picks.some((p) => p.market === "Match Winner")).toBe(true);
    expect(picks.some((p) => p.selection.includes("Griquas"))).toBe(true);
    expect(picks.every((p) => p.label !== "SHORT")).toBe(true);

    const withOdds = selectBestValueBets({
      homeName: "Griquas",
      awayName: "Cheetahs",
      prediction,
      signals: [],
      topTryScorer: null,
      odds: {
        impliedHomePct: 48,
        impliedDrawPct: 5,
        impliedAwayPct: 47,
        bestHomeDecimal: 2.1,
        bestDrawDecimal: 20,
        bestAwayDecimal: 2.15,
      },
      limit: 5,
    });
    const valued = withOdds.find((p) => p.label === "VALUE");
    expect(valued?.selection).toContain("Griquas");
    expect(withOdds[0]?.label).toBe("VALUE");
  });

  it("varies insight mix by seed and caps between 6 and 10", () => {
    const base = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      label: `L${i}`,
      body: `Body ${i}`,
      sampleSize: i + 1,
      strength: 90 - i,
    }));
    // Map onto real preferred keys for group selection
    const keyed = [
      "likely_scorer",
      "metres",
      "venue_form",
      "scores_first",
      "comeback",
      "final_20_tries",
      "recent_form",
      "try_rate",
      "defence",
      "win_streak",
      "close_games",
      "points_avg",
    ].map((key, i) => ({
      key,
      label: key,
      body: `${key} body`,
      sampleSize: 3,
      strength: 80 - i,
    }));
    const a = selectVariedInsights(keyed, { varietySeed: "fixture-a:home", limit: 10 });
    const b = selectVariedInsights(keyed, { varietySeed: "fixture-b:home", limit: 10 });
    expect(a.length).toBeGreaterThanOrEqual(6);
    expect(a.length).toBeLessThanOrEqual(10);
    expect(b.length).toBeGreaterThanOrEqual(6);
    expect(b.length).toBeLessThanOrEqual(10);
    // Same seed is stable; different seeds usually differ in order or membership
    expect(selectVariedInsights(keyed, { varietySeed: "fixture-a:home", limit: 10 })).toEqual(a);
    expect(hashVarietySeed("fixture-a:home")).not.toBe(hashVarietySeed("fixture-b:home"));
    const aKeys = a.map((x) => x.key).join(",");
    const bKeys = b.map((x) => x.key).join(",");
    expect(aKeys === bKeys && a.length === b.length).toBe(false);
    void base;
  });

  it("builds narrative insights per team covering scorer, metres and form", () => {
    const teamId = "team-home";
    const matches: FinishedTeamMatch[] = Array.from({ length: 8 }, (_, i) => ({
      kickoffAt: new Date(Date.UTC(2026, 6, 20 - i)),
      isHome: i % 2 === 0,
      pointsFor: i % 3 === 0 ? 18 : 32,
      pointsAgainst: i % 3 === 0 ? 28 : 16,
      triesFor: 3 + (i % 2),
      dayOfWeek: 5,
      wetWeather: false,
      fixtureId: `fx-${i}`,
      metresFor: 420 + i * 10,
      homeTeamId: i % 2 === 0 ? teamId : "opp",
      awayTeamId: i % 2 === 0 ? "opp" : teamId,
    }));

    const events: InsightEventRow[] = [];
    for (let i = 0; i < 8; i++) {
      const homeId = i % 2 === 0 ? teamId : "opp";
      const awayId = i % 2 === 0 ? "opp" : teamId;
      events.push(
        {
          fixtureId: `fx-${i}`,
          eventType: "try",
          minute: 8,
          second: 0,
          sequenceNo: 1,
          teamId: homeId,
          playerId: null,
          payload: { score_after: [5, 0] },
        },
        {
          fixtureId: `fx-${i}`,
          eventType: "try",
          minute: 72,
          second: 0,
          sequenceNo: 2,
          teamId: teamId,
          playerId: null,
          payload: null,
        },
        {
          fixtureId: `fx-${i}`,
          eventType: "try",
          minute: 35,
          second: 0,
          sequenceNo: 3,
          teamId: awayId,
          playerId: null,
          payload: { score_after: homeId === teamId ? [5, 5] : [5, 5] },
        },
      );
    }

    const insights = buildTeamNarrativeInsights({
      matches,
      events,
      season: {
        teamId,
        teamName: "Leicester",
        venueHome: true,
        topTryScorers: [
          { playerName: "Freddie Steward", tries: 6 },
          { playerName: "Handre Pollard", tries: 3 },
        ],
        seasonMetresTotal: 4800,
        seasonMetresMatches: 8,
      },
      varietySeed: "leicester-fixture-1",
      limit: 10,
    });

    expect(insights.length).toBeGreaterThanOrEqual(6);
    expect(insights.length).toBeLessThanOrEqual(10);
    expect(insights.map((i) => i.key)).toEqual(
      expect.arrayContaining(["likely_scorer", "metres"]),
    );
    expect(insights.some((i) => /Freddie Steward/i.test(i.body))).toBe(true);
    expect(insights.some((i) => /metres/i.test(i.body))).toBe(true);
  });

  it("builds L5/L10/home/away trend windows", () => {
    const matches = Array.from({ length: 12 }, (_, i) => ({
      kickoffAt: new Date(Date.UTC(2026, 0, 20 - i)),
      isHome: i % 2 === 0,
      pointsFor: i % 3 === 0 ? 20 : 30,
      pointsAgainst: i % 3 === 0 ? 28 : 18,
      triesFor: 3,
      dayOfWeek: i % 2 === 0 ? 5 : 6,
      wetWeather: i < 3,
    }));
    const windows = buildTeamTrendWindows(matches);
    expect(windows.find((w) => w.key === "l5")?.played).toBe(5);
    expect(windows.find((w) => w.key === "l10")?.played).toBe(10);
    expect(windows.find((w) => w.key === "home")?.played).toBeGreaterThan(0);
    expect(windows.find((w) => w.key === "friday")?.played).toBeGreaterThanOrEqual(2);
  });

  it("models player try probability and bet builder confidence", () => {
    const prop = computePlayerPropRow({
      playerId: "p1",
      playerName: "James Lowe",
      teamSide: "home",
      positionName: "Wing",
      jerseyNumber: 11,
      careerRating: 90,
      formRating: 7.8,
      squadRole: "starter",
      tryRate: 0.35,
      sampleMatches: 8,
      avgTackles: 6,
      avgCarries: 9,
      avgMetres: 70,
      avgLineBreaks: 1.2,
      teamExpectedTries: 4.2,
      teamWinPct: 68,
    });
    expect(prop.tryPct).toBeGreaterThan(20);
    expect(prop.motmPct).toBeGreaterThan(5);

    expect(combineLegProbabilities([68, 55, 42])).toBeGreaterThan(10);
    expect(combineLegProbabilities([68, 55, 42])).toBeLessThan(68);

    const builders = buildBetBuilderSuggestions({
      homeName: "Leinster",
      awayName: "Toulouse",
      prediction: {
        modelVersion: "betting-intel-v1",
        homeWinPct: 68,
        drawPct: 4,
        awayWinPct: 28,
        lean: "home",
        confidencePct: 88,
        expectedHomeScore: 31,
        expectedAwayScore: 24,
        expectedHomeTries: 4.3,
        expectedAwayTries: 3.1,
        winningMargin: [
          { key: "1-7", label: "1–7", probability: 40 },
          { key: "8-14", label: "8–14", probability: 35 },
          { key: "15+", label: "15+", probability: 25 },
        ],
      },
      signals: [
        {
          key: "ratings",
          side: "home",
          weight: 0.2,
          label: "Rugby365 Rating",
          detail: "Home rates higher",
        },
      ],
      topTryScorer: prop,
    });
    expect(builders.length).toBeGreaterThanOrEqual(1);
    expect(builders[0]!.legs.length).toBeGreaterThanOrEqual(2);
    expect(builders[0]!.combinedConfidencePct).toBeGreaterThan(0);
  });
});
