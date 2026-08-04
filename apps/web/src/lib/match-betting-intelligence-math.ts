/**
 * Planet Rugby Betting Intelligence — explainable win probability model.
 * Pure functions; no bookmaker odds required.
 */

import { resolveFirstScoringEvent } from "./table-lab/first-score-utils";
import { FINAL_TWENTY_MIN_MINUTE } from "./table-lab/final-twenty-minutes-table-service";
import { resolveFixtureLosingPositionState } from "./table-lab/losing-position-utils";
import {
  formatTravelKm,
  travelDisadvantageFromKm,
  weatherFitSide,
} from "./match-betting-intelligence-phase-a";
import type {
  BetBuilderLeg,
  BetBuilderSuggestion,
  BettingMarginBucket,
  BettingSignal,
  MatchBettingConfidence,
  MatchBettingPrediction,
  MatchMarketInsight,
  PlayerPropRow,
  TeamNarrativeInsight,
  TeamTrendWindow,
  ValueBetPick,
} from "./match-betting-intelligence-types";

/**
 * Production Betting Intelligence model id.
 * Baseline freeze + improvement log: docs/knowledge/betting-intelligence-rd.md
 * Admin R&D: /admin/odds/betting-rd
 */
export const BETTING_INTEL_MODEL = "betting-intel-v1.1";

export type BettingIntelMathInput = {
  homeName: string;
  awayName: string;
  /** Lineup-weighted career rating of named XV / available ratings */
  homeAvgRating: number | null;
  awayAvgRating: number | null;
  homeFormWins: number;
  homeFormPlayed: number;
  awayFormWins: number;
  awayFormPlayed: number;
  h2hHomeWins: number;
  h2hAwayWins: number;
  h2hDraws: number;
  homeUnavailable: number;
  awayUnavailable: number;
  homeCoachRating: number | null;
  awayCoachRating: number | null;
  hasHomeVenue: boolean;
  weatherHarsh: boolean;
  /** Phase A — optional; omitted fields treated as absent */
  isNeutralVenue?: boolean;
  /** Share of rated XV with internationalTeamId (0–1) */
  homeIntlShare?: number | null;
  awayIntlShare?: number | null;
  /** Share of XV who played international in last ~14 days (0–1) */
  homeFatigueShare?: number | null;
  awayFatigueShare?: number | null;
  homeTravelKm?: number | null;
  awayTravelKm?: number | null;
  kickoffTempC?: number | null;
  /** Latitude of team home venue (climate proxy) */
  homeClimateLat?: number | null;
  awayClimateLat?: number | null;
};

export type FinishedTeamMatch = {
  kickoffAt: Date | null;
  isHome: boolean;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number | null;
  dayOfWeek: number | null;
  wetWeather: boolean;
  /** Present when loaded for narrative Insights */
  fixtureId?: string;
  metresFor?: number | null;
  homeTeamId?: string;
  awayTeamId?: string;
  halfTimeFor?: number | null;
  halfTimeAgainst?: number | null;
};

export type InsightEventRow = {
  fixtureId: string;
  eventType: string;
  minute: number;
  second: number | null;
  sequenceNo: number | null;
  teamId: string | null;
  playerId: string | null;
  payload: Record<string, unknown> | null;
};

export type TeamInsightSeasonContext = {
  teamId: string;
  teamName: string;
  /** True when this team is home in the upcoming fixture */
  venueHome: boolean;
  topTryScorers: Array<{ playerName: string; tries: number }>;
  seasonMetresTotal: number | null;
  seasonMetresMatches: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Rugby scores are whole points — never display fractional match totals. */
function roundPoints(n: number): number {
  return Math.round(n);
}

/** Bookmaker-style total/handicap line ending in .5 */
function halfLine(n: number): number {
  return Math.floor(Math.abs(n)) + 0.5;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Convert logit edge into home/draw/away percentages that sum to 100.
 */
export function probabilitiesFromEdge(homeEdge: number): {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
} {
  const drawBase = 0.06;
  const homeRaw = Math.exp(homeEdge);
  const awayRaw = Math.exp(-homeEdge);
  const total = homeRaw + awayRaw + drawBase;
  let homeWinPct = Math.round((homeRaw / total) * 100);
  let awayWinPct = Math.round((awayRaw / total) * 100);
  let drawPct = 100 - homeWinPct - awayWinPct;
  if (drawPct < 2) {
    drawPct = 2;
    if (homeWinPct >= awayWinPct) homeWinPct -= 1;
    else awayWinPct -= 1;
  }
  const sum = homeWinPct + drawPct + awayWinPct;
  if (sum !== 100) homeWinPct += 100 - sum;
  return { homeWinPct, drawPct, awayWinPct };
}

export function summarizeTrendWindow(
  matches: FinishedTeamMatch[],
  key: string,
  label: string,
): TeamTrendWindow {
  let won = 0;
  let drawn = 0;
  let lost = 0;
  const pf: number[] = [];
  const pa: number[] = [];
  const tries: number[] = [];
  for (const m of matches) {
    pf.push(m.pointsFor);
    pa.push(m.pointsAgainst);
    if (m.triesFor != null) tries.push(m.triesFor);
    if (m.pointsFor > m.pointsAgainst) won += 1;
    else if (m.pointsFor < m.pointsAgainst) lost += 1;
    else drawn += 1;
  }
  const played = matches.length;
  return {
    key,
    label,
    played,
    won,
    drawn,
    lost,
    avgPointsFor: avg(pf) != null ? round1(avg(pf)!) : null,
    avgPointsAgainst: avg(pa) != null ? round1(avg(pa)!) : null,
    avgTriesFor: avg(tries) != null ? round1(avg(tries)!) : null,
    winPct: played > 0 ? Math.round((won / played) * 100) : null,
  };
}

export function buildTeamTrendWindows(matches: FinishedTeamMatch[]): TeamTrendWindow[] {
  const chronological = [...matches].sort(
    (a, b) => (b.kickoffAt?.getTime() ?? 0) - (a.kickoffAt?.getTime() ?? 0),
  );
  const windows: TeamTrendWindow[] = [
    summarizeTrendWindow(chronological.slice(0, 5), "l5", "Last 5"),
    summarizeTrendWindow(chronological.slice(0, 10), "l10", "Last 10"),
    summarizeTrendWindow(
      chronological.filter((m) => m.isHome),
      "home",
      "Home",
    ),
    summarizeTrendWindow(
      chronological.filter((m) => !m.isHome),
      "away",
      "Away",
    ),
  ];

  const friday = chronological.filter((m) => m.dayOfWeek === 5);
  if (friday.length >= 2) {
    windows.push(summarizeTrendWindow(friday, "friday", "Friday nights"));
  }
  const wet = chronological.filter((m) => m.wetWeather);
  if (wet.length >= 2) {
    windows.push(summarizeTrendWindow(wet, "wet", "Wet weather"));
  }
  return windows.filter((w) => w.played > 0);
}

export function buildBettingSignals(input: BettingIntelMathInput): BettingSignal[] {
  const signals: BettingSignal[] = [];
  const isNeutral = Boolean(input.isNeutralVenue);

  if (input.hasHomeVenue && !isNeutral) {
    // Cap home edge when the visitors are clearly higher quality (soft home traps).
    let homeWeight = 0.1;
    if (input.homeAvgRating != null && input.awayAvgRating != null) {
      const gapAgainstHome = input.awayAvgRating - input.homeAvgRating;
      if (gapAgainstHome >= 8) homeWeight = 0.03;
      else if (gapAgainstHome >= 4) homeWeight = 0.06;
    }
    signals.push({
      key: "home_advantage",
      side: "home",
      weight: homeWeight,
      label: "Home advantage",
      detail:
        homeWeight < 0.1
          ? `${input.homeName} host, but squad quality caps the usual home edge.`
          : `${input.homeName} play at home — historically a material edge in rugby.`,
    });
  }

  if (input.homeFormPlayed >= 3 || input.awayFormPlayed >= 3) {
    const homeRate =
      input.homeFormPlayed > 0 ? input.homeFormWins / input.homeFormPlayed : 0.5;
    const awayRate =
      input.awayFormPlayed > 0 ? input.awayFormWins / input.awayFormPlayed : 0.5;
    const side = homeRate === awayRate ? "neutral" : homeRate > awayRate ? "home" : "away";
    signals.push({
      key: "form",
      side,
      weight: 0.15,
      label: "Recent form",
      detail:
        side === "neutral"
          ? "Recent win rates are closely matched."
          : `${side === "home" ? input.homeName : input.awayName} have the stronger recent win rate.`,
      homeValue: `${input.homeFormWins}/${input.homeFormPlayed || "—"}`,
      awayValue: `${input.awayFormWins}/${input.awayFormPlayed || "—"}`,
    });
  }

  const h2hTotal = input.h2hHomeWins + input.h2hAwayWins + input.h2hDraws;
  if (h2hTotal >= 2) {
    const side =
      input.h2hHomeWins === input.h2hAwayWins
        ? "neutral"
        : input.h2hHomeWins > input.h2hAwayWins
          ? "home"
          : "away";
    signals.push({
      key: "h2h",
      side,
      weight: 0.12,
      label: "Head-to-head",
      detail:
        side === "neutral"
          ? "Recent meetings are evenly split."
          : `${side === "home" ? input.homeName : input.awayName} lead the sampled head-to-head.`,
      homeValue: String(input.h2hHomeWins),
      awayValue: String(input.h2hAwayWins),
    });
  }

  if (input.homeAvgRating != null || input.awayAvgRating != null) {
    const hr = input.homeAvgRating ?? 70;
    const ar = input.awayAvgRating ?? 70;
    const side = Math.abs(hr - ar) < 1.5 ? "neutral" : hr > ar ? "home" : "away";
    signals.push({
      key: "ratings",
      side,
      weight: 0.18,
      label: "Squad quality",
      detail:
        side === "neutral"
          ? "Lineup-weighted Rugby365 ratings are tightly matched."
          : `${side === "home" ? input.homeName : input.awayName} rate higher on lineup-weighted career quality.`,
      homeValue: input.homeAvgRating != null ? String(Math.round(input.homeAvgRating)) : "—",
      awayValue: input.awayAvgRating != null ? String(Math.round(input.awayAvgRating)) : "—",
    });
  }

  if (input.homeUnavailable > 0 || input.awayUnavailable > 0) {
    const side =
      input.homeUnavailable === input.awayUnavailable
        ? "neutral"
        : input.homeUnavailable > input.awayUnavailable
          ? "away"
          : "home";
    signals.push({
      key: "availability",
      side,
      weight: 0.12,
      label: "Injuries & suspensions",
      detail:
        side === "neutral"
          ? "Both squads carry similar unavailable counts."
          : `${side === "home" ? input.homeName : input.awayName} are less disrupted by absences.`,
      homeValue: String(input.homeUnavailable),
      awayValue: String(input.awayUnavailable),
    });
  }

  if (input.homeCoachRating != null || input.awayCoachRating != null) {
    const hr = input.homeCoachRating ?? 5;
    const ar = input.awayCoachRating ?? 5;
    const side = Math.abs(hr - ar) < 0.3 ? "neutral" : hr > ar ? "home" : "away";
    signals.push({
      key: "coach",
      side,
      weight: 0.06,
      label: "Coach rating",
      detail:
        side === "neutral"
          ? "Coach ratings are similar for this fixture."
          : `${side === "home" ? input.homeName : input.awayName} hold the coaching edge for this match.`,
      homeValue: input.homeCoachRating != null ? input.homeCoachRating.toFixed(1) : "—",
      awayValue: input.awayCoachRating != null ? input.awayCoachRating.toFixed(1) : "—",
    });
  }

  const homeIntl = input.homeIntlShare ?? null;
  const awayIntl = input.awayIntlShare ?? null;
  if (homeIntl != null || awayIntl != null) {
    const hi = homeIntl ?? 0;
    const ai = awayIntl ?? 0;
    if (Math.max(hi, ai) >= 0.15 && Math.abs(hi - ai) >= 0.1) {
      const side: BettingSignal["side"] =
        Math.abs(hi - ai) < 0.05 ? "neutral" : hi > ai ? "home" : "away";
      signals.push({
        key: "international_quality",
        side,
        weight: 0.07,
        label: "International quality",
        detail:
          side === "neutral"
            ? "Both squads carry similar international pedigree."
            : `${side === "home" ? input.homeName : input.awayName} field more internationally capped players.`,
        homeValue: homeIntl != null ? `${Math.round(homeIntl * 100)}%` : "—",
        awayValue: awayIntl != null ? `${Math.round(awayIntl * 100)}%` : "—",
      });
    }
  }

  const homeFatigue = input.homeFatigueShare ?? null;
  const awayFatigue = input.awayFatigueShare ?? null;
  if (homeFatigue != null || awayFatigue != null) {
    const hf = homeFatigue ?? 0;
    const af = awayFatigue ?? 0;
    if (Math.max(hf, af) >= 0.12 && Math.abs(hf - af) >= 0.08) {
      // Higher fatigue is a disadvantage for that side.
      const side: BettingSignal["side"] = hf === af ? "neutral" : hf > af ? "away" : "home";
      const fatiguedName = hf > af ? input.homeName : input.awayName;
      signals.push({
        key: "fatigue",
        side,
        weight: 0.06,
        label: "Tour fatigue",
        detail:
          side === "neutral"
            ? "Both sides carry similar recent international load."
            : `${fatiguedName} have more players fresh off international duty.`,
        homeValue: homeFatigue != null ? `${Math.round(homeFatigue * 100)}%` : "—",
        awayValue: awayFatigue != null ? `${Math.round(awayFatigue * 100)}%` : "—",
      });
    }
  }

  const homeTravel = input.homeTravelKm ?? null;
  const awayTravel = input.awayTravelKm ?? null;
  if (homeTravel != null || awayTravel != null) {
    const hd = travelDisadvantageFromKm(homeTravel);
    const ad = travelDisadvantageFromKm(awayTravel);
    if (Math.max(hd, ad) >= 0.15 && Math.abs(hd - ad) >= 0.12) {
      const side: BettingSignal["side"] = hd === ad ? "neutral" : hd < ad ? "home" : "away";
      signals.push({
        key: "travel",
        side,
        weight: 0.06,
        label: "Travel load",
        detail:
          side === "neutral"
            ? "Travel distances are broadly similar."
            : `${side === "home" ? input.homeName : input.awayName} face a lighter travel burden to the venue.`,
        homeValue: formatTravelKm(homeTravel),
        awayValue: formatTravelKm(awayTravel),
      });
    }
  }

  if (input.weatherHarsh) {
    signals.push({
      key: "weather",
      side: "neutral",
      weight: 0.04,
      label: "Weather",
      detail: "Conditions may suppress scoring and favour territory / set-piece sides.",
    });
  }

  const fit = weatherFitSide({
    tempC: input.kickoffTempC ?? null,
    homeClimateLat: input.homeClimateLat ?? null,
    awayClimateLat: input.awayClimateLat ?? null,
  });
  if (fit != null) {
    signals.push({
      key: "weather_fit",
      side: fit,
      weight: 0.05,
      label: "Temperature fit",
      detail:
        fit === "neutral"
          ? "Kickoff temperature does not clearly favour either climate profile."
          : `${fit === "home" ? input.homeName : input.awayName} are better matched to the expected temperature band.`,
      homeValue:
        input.kickoffTempC != null ? `${Math.round(input.kickoffTempC)}°C` : "—",
      awayValue:
        input.kickoffTempC != null ? `${Math.round(input.kickoffTempC)}°C` : "—",
    });
  }

  return signals.sort((a, b) => b.weight - a.weight);
}

export function computeBettingPrediction(
  input: BettingIntelMathInput,
  signals: BettingSignal[],
): MatchBettingPrediction {
  let edge = 0;
  for (const s of signals) {
    if (s.side === "home") edge += s.weight;
    if (s.side === "away") edge -= s.weight;
  }
  edge = clamp(edge * 1.35, -1.4, 1.4);

  const { homeWinPct, drawPct, awayWinPct } = probabilitiesFromEdge(edge);

  const lean: MatchBettingPrediction["lean"] =
    homeWinPct >= awayWinPct + 8
      ? "home"
      : awayWinPct >= homeWinPct + 8
        ? "away"
        : Math.abs(homeWinPct - awayWinPct) <= 4 && drawPct >= 8
          ? "uncertain"
          : homeWinPct > awayWinPct
            ? "home"
            : awayWinPct > homeWinPct
              ? "away"
              : "uncertain";

  const confidencePct = clamp(
    Math.round(52 + Math.abs(homeWinPct - awayWinPct) * 0.55 + signals.length * 2.5),
    45,
    96,
  );

  // Scoreline must follow the same signal edge as win% — ratings only set total
  // points intensity, not who is ahead (venue/form/h2h already live in `edge`).
  const ratingGap = (input.homeAvgRating ?? 72) - (input.awayAvgRating ?? 72);
  const totalPoints = clamp(
    46 + Math.abs(ratingGap) * 0.08 + (input.weatherHarsh ? -5 : 0),
    32,
    68,
  );
  const homeShare = clamp(0.5 + edge * 0.16, 0.32, 0.68);
  // Whole rugby points / tries only — never display fractional scores.
  let expectedHomeScore = roundPoints(clamp(totalPoints * homeShare, 10, 48));
  let expectedAwayScore = roundPoints(clamp(totalPoints * (1 - homeShare), 10, 48));

  // Hard consistency: lean winner cannot trail on expected points.
  if (lean === "home" && expectedHomeScore <= expectedAwayScore) {
    expectedHomeScore = expectedAwayScore + 3;
  } else if (lean === "away" && expectedAwayScore <= expectedHomeScore) {
    expectedAwayScore = expectedHomeScore + 3;
  }

  const expectedHomeTries = Math.max(1, roundPoints(expectedHomeScore / 7.2));
  const expectedAwayTries = Math.max(1, roundPoints(expectedAwayScore / 7.4));

  const marginGap = Math.abs(expectedHomeScore - expectedAwayScore);
  const winningMargin: BettingMarginBucket[] = [
    {
      key: "1-7",
      label: "1–7",
      probability: clamp(Math.round(marginGap < 6 ? 42 : 28), 15, 55),
    },
    {
      key: "8-14",
      label: "8–14",
      probability: clamp(Math.round(marginGap >= 6 && marginGap < 14 ? 38 : 32), 15, 50),
    },
    {
      key: "15+",
      label: "15+",
      probability: 0,
    },
  ];
  winningMargin[2]!.probability = Math.max(
    10,
    100 - winningMargin[0]!.probability - winningMargin[1]!.probability,
  );

  return {
    modelVersion: BETTING_INTEL_MODEL,
    homeWinPct,
    drawPct,
    awayWinPct,
    lean,
    confidencePct,
    expectedHomeScore,
    expectedAwayScore,
    expectedHomeTries,
    expectedAwayTries,
    winningMargin,
  };
}

export function computeBettingConfidence(input: {
  signalCount: number;
  hasRatings: boolean;
  hasH2h: boolean;
  hasAvailability: boolean;
  predictionConfidencePct: number;
}): MatchBettingConfidence {
  const dataConfidence = clamp(
    55 +
      input.signalCount * 4 +
      (input.hasRatings ? 8 : 0) +
      (input.hasH2h ? 6 : 0) +
      (input.hasAvailability ? 5 : 0),
    40,
    98,
  );
  const predictionConfidence = input.predictionConfidencePct;
  const bettingConfidence = clamp(
    Math.round(dataConfidence * 0.45 + predictionConfidence * 0.55),
    40,
    97,
  );
  const stars = clamp(Math.round(bettingConfidence / 20), 1, 5);
  return {
    bettingConfidence,
    dataConfidence,
    predictionConfidence,
    marketConfidence: null,
    stars,
  };
}

export type PlayerPropMathInput = {
  playerId: string;
  playerName: string;
  teamSide: "home" | "away";
  positionName: string | null;
  jerseyNumber: number | null;
  careerRating: number | null;
  formRating: number | null;
  squadRole: "starter" | "replacement" | string;
  tryRate: number | null;
  sampleMatches: number;
  avgTackles: number | null;
  avgCarries: number | null;
  avgMetres: number | null;
  avgLineBreaks: number | null;
  teamExpectedTries: number;
  teamWinPct: number;
};

/** Heuristic player props from ratings + recent rates (no bookmaker). */
export function computePlayerPropRow(input: PlayerPropMathInput): PlayerPropRow {
  const career = input.careerRating ?? 70;
  const form = input.formRating ?? 6.5;
  const starterBoost = input.squadRole === "starter" || input.squadRole === "starting" ? 1 : 0.55;
  const tryRate = input.tryRate ?? clamp((career - 60) / 120, 0.05, 0.45);
  const tryPct = Math.round(
    clamp(tryRate * starterBoost * (0.85 + input.teamExpectedTries / 8) * 100, 4, 72),
  );
  const assistPct = Math.round(
    clamp((tryPct * 0.7 + (career - 65) * 0.35 + (form - 6) * 4) * starterBoost, 3, 68),
  );
  const motmPct = Math.round(
    clamp(
      ((career - 70) * 0.55 + (form - 6.5) * 6 + input.teamWinPct * 0.12) * starterBoost,
      2,
      42,
    ),
  );

  return {
    playerId: input.playerId,
    playerName: input.playerName,
    teamSide: input.teamSide,
    positionName: input.positionName,
    jerseyNumber: input.jerseyNumber,
    careerRating: input.careerRating,
    formRating: input.formRating,
    tryPct,
    assistPct,
    motmPct,
    expectedTackles: round1(input.avgTackles ?? clamp(8 + (form - 6) * 1.2, 4, 22)),
    expectedCarries: round1(input.avgCarries ?? clamp(6 + (career - 70) * 0.12, 2, 18)),
    expectedMetres: round1(input.avgMetres ?? clamp(28 + (career - 70) * 0.8, 8, 90)),
    expectedLineBreaks: round1(input.avgLineBreaks ?? clamp(0.4 + tryRate * 2.2, 0.1, 3.5)),
    sampleMatches: input.sampleMatches,
  };
}

/** Independent-leg approximation for explainable builders (not a priced combo). */
export function combineLegProbabilities(pcts: number[]): number {
  if (!pcts.length) return 0;
  const product = pcts.reduce((acc, p) => acc * clamp(p / 100, 0.01, 0.99), 1);
  return clamp(Math.round(product * 100), 1, 95);
}

export function buildBetBuilderSuggestions(input: {
  homeName: string;
  awayName: string;
  prediction: MatchBettingPrediction;
  signals: BettingSignal[];
  topTryScorer: PlayerPropRow | null;
}): BetBuilderSuggestion[] {
  const { prediction: p, homeName, awayName, signals, topTryScorer } = input;
  const leanName =
    p.lean === "home" ? homeName : p.lean === "away" ? awayName : null;
  const winPct =
    p.lean === "home"
      ? p.homeWinPct
      : p.lean === "away"
        ? p.awayWinPct
        : Math.max(p.homeWinPct, p.awayWinPct);
  const totalTries = p.expectedHomeTries + p.expectedAwayTries;
  const overTriesLine = totalTries >= 5.2 ? 5.5 : 4.5;
  const overTriesPct = clamp(Math.round(48 + (totalTries - overTriesLine) * 18), 28, 78);

  const suggestions: BetBuilderSuggestion[] = [];

  if (leanName && p.lean !== "uncertain" && p.lean !== "draw") {
    const legs: BetBuilderLeg[] = [
      {
        id: "win",
        label: `${leanName} to win`,
        detail: `Planet Rugby win probability ${winPct}%`,
        probabilityPct: winPct,
      },
      {
        id: "tries",
        label: `Over ${overTriesLine} tries`,
        detail: `Expected combined tries ${Math.round(totalTries)}`,
        probabilityPct: overTriesPct,
      },
    ];
    if (topTryScorer && topTryScorer.tryPct >= 18) {
      legs.push({
        id: "try",
        label: `${topTryScorer.playerName} anytime try`,
        detail: `Modelled try chance ${topTryScorer.tryPct}%`,
        probabilityPct: topTryScorer.tryPct,
      });
    }
    const whyBits = signals
      .filter((s) => s.side === p.lean)
      .slice(0, 3)
      .map((s) => s.label);
    suggestions.push({
      title: `${leanName} win + tries`,
      legs,
      combinedConfidencePct: combineLegProbabilities(legs.map((l) => l.probabilityPct)),
      explanation:
        whyBits.length > 0
          ? `Built from ${whyBits.join(", ").toLowerCase()}. Independent-leg estimate — not a bookmaker price.`
          : "Independent-leg estimate from Planet Rugby prediction signals — not a bookmaker price.",
    });
  }

  const margin = p.winningMargin[0]!;
  const bothTriesPct = clamp(
    Math.round(35 + Math.min(p.expectedHomeTries, p.expectedAwayTries) * 12),
    22,
    70,
  );
  const tightLegs: BetBuilderLeg[] = [
    {
      id: "margin",
      label: `Winning margin ${margin.label}`,
      detail: `Modelled ${margin.probability}%`,
      probabilityPct: margin.probability,
    },
    {
      id: "both-tries",
      label: "Both teams to score 2+ tries",
      detail: `Expected ${p.expectedHomeTries}–${p.expectedAwayTries} tries`,
      probabilityPct: bothTriesPct,
    },
  ];
  suggestions.push({
    title: "Tight-game builder",
    legs: tightLegs,
    combinedConfidencePct: combineLegProbabilities(tightLegs.map((l) => l.probabilityPct)),
    explanation:
      "Useful when the model sees a competitive scoreline rather than a blowout.",
  });

  return suggestions;
}

export type OddsValueInput = {
  impliedHomePct: number | null;
  impliedDrawPct: number | null;
  impliedAwayPct: number | null;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
};

/**
 * Pick the best Value Bets most likely to land.
 * Prefers positive market edge when odds exist; otherwise ranks modelled likelihood.
 */
export function selectBestValueBets(input: {
  homeName: string;
  awayName: string;
  prediction: MatchBettingPrediction;
  signals: BettingSignal[];
  topTryScorer: PlayerPropRow | null;
  odds?: OddsValueInput | null;
  limit?: number;
}): ValueBetPick[] {
  const { homeName, awayName, prediction: p, signals, topTryScorer } = input;
  const limit = input.limit ?? 5;
  const odds = input.odds ?? null;
  const candidates: ValueBetPick[] = [];

  const leanName =
    p.lean === "home" ? homeName : p.lean === "away" ? awayName : null;
  const leanPct =
    p.lean === "home"
      ? p.homeWinPct
      : p.lean === "away"
        ? p.awayWinPct
        : Math.max(p.homeWinPct, p.awayWinPct);

  const whyLean = signals
    .filter((s) => (p.lean === "home" || p.lean === "away" ? s.side === p.lean : true))
    .slice(0, 2)
    .map((s) => s.label)
    .join(", ");

  const winnerSides: Array<{
    id: string;
    selection: string;
    ourPct: number;
    marketPct: number | null;
    bestDecimal: number | null;
  }> = [
    {
      id: "winner-home",
      selection: homeName,
      ourPct: p.homeWinPct,
      marketPct: odds?.impliedHomePct ?? null,
      bestDecimal: odds?.bestHomeDecimal ?? null,
    },
    {
      id: "winner-away",
      selection: awayName,
      ourPct: p.awayWinPct,
      marketPct: odds?.impliedAwayPct ?? null,
      bestDecimal: odds?.bestAwayDecimal ?? null,
    },
    {
      id: "winner-draw",
      selection: "Draw",
      ourPct: p.drawPct,
      marketPct: odds?.impliedDrawPct ?? null,
      bestDecimal: odds?.bestDrawDecimal ?? null,
    },
  ];

  for (const w of winnerSides) {
    const edge =
      w.marketPct != null ? Math.round((w.ourPct - w.marketPct) * 10) / 10 : null;
    let label: ValueBetPick["label"] = "LIKELY";
    if (edge != null) {
      label = edge >= 4 ? "VALUE" : edge <= -4 ? "SHORT" : "FAIR";
    } else if (w.ourPct < 48) {
      label = "FAIR";
    }
    if (label === "SHORT") continue;
    if (w.selection === "Draw" && (edge == null || edge < 4) && w.ourPct < 12) continue;
    if (edge == null && leanName && w.selection !== leanName && w.selection !== "Draw") {
      continue;
    }
    if (edge == null && w.selection === leanName && w.ourPct < 48) continue;

    candidates.push({
      id: w.id,
      market: "Match Winner",
      selection: w.selection === "Draw" ? "Draw" : `${w.selection} to win`,
      likelihoodPct: w.ourPct,
      reason:
        edge != null
          ? `Planet Rugby ${w.ourPct}% vs market ${w.marketPct}% (${edge > 0 ? "+" : ""}${edge}% edge)${
              whyLean ? ` — ${whyLean}` : ""
            }.`
          : leanName && w.selection === leanName
            ? `Model lean at ${w.ourPct}%${whyLean ? ` from ${whyLean}` : ""}.`
            : `Modelled at ${w.ourPct}%.`,
      marketPct: w.marketPct,
      edgePct: edge,
      bestDecimal: w.bestDecimal,
      label: edge == null && w.ourPct >= 55 ? "LIKELY" : label,
    });
  }

  const margin = p.winningMargin[0];
  if (margin && margin.probability >= 32) {
    candidates.push({
      id: "margin",
      market: "Winning Margin",
      selection: `Winning margin ${margin.label}`,
      likelihoodPct: margin.probability,
      reason: `Most likely margin band on the model (${margin.probability}%).`,
      marketPct: null,
      edgePct: null,
      bestDecimal: null,
      label: margin.probability >= 40 ? "LIKELY" : "FAIR",
    });
  }

  const total = Math.round(p.expectedHomeScore + p.expectedAwayScore);
  const bookishMid = 61;
  if (total <= bookishMid - 6) {
    const line = Math.max(total + 0.5, 46.5);
    const underPct = clamp(Math.round(52 + (bookishMid - total) * 1.8), 48, 72);
    candidates.push({
      id: "totals-under",
      market: "Total Points",
      selection: `Under ${line}`,
      likelihoodPct: underPct,
      reason: `Modelled combined points ${total} — often lower than Currie Cup book totals (57.5–65.5).`,
      marketPct: null,
      edgePct: null,
      bestDecimal: null,
      label: underPct >= 56 ? "LIKELY" : "FAIR",
    });
  } else if (total >= bookishMid + 4) {
    const line = Math.floor(total) - 0.5;
    const overPct = clamp(Math.round(52 + (total - bookishMid) * 1.6), 48, 70);
    candidates.push({
      id: "totals-over",
      market: "Total Points",
      selection: `Over ${line}`,
      likelihoodPct: overPct,
      reason: `Modelled combined points ${total} supports a higher scoring game.`,
      marketPct: null,
      edgePct: null,
      bestDecimal: null,
      label: overPct >= 56 ? "LIKELY" : "FAIR",
    });
  }

  const scoreMargin = Math.round(p.expectedHomeScore) - Math.round(p.expectedAwayScore);
  const absMargin = Math.abs(scoreMargin);
  if (leanName && absMargin >= 5 && p.lean !== "uncertain" && p.lean !== "draw") {
    const line = Math.floor(absMargin) + 0.5;
    const coverPct = clamp(Math.round(leanPct - 8 - Math.max(0, line - 6)), 42, 68);
    candidates.push({
      id: "handicap",
      market: "Handicap",
      selection: `${leanName} -${line}`,
      likelihoodPct: coverPct,
      reason: `Expected score margin ~${absMargin} pts toward ${leanName}.`,
      marketPct: null,
      edgePct: null,
      bestDecimal: null,
      label: coverPct >= 54 ? "LIKELY" : "FAIR",
    });
  }

  if (topTryScorer && topTryScorer.tryPct >= 22) {
    candidates.push({
      id: "anytime-try",
      market: "Player Props",
      selection: `${topTryScorer.playerName} anytime try`,
      likelihoodPct: topTryScorer.tryPct,
      reason: `Highest modelled try chance on the named XV (${topTryScorer.tryPct}%).`,
      marketPct: null,
      edgePct: null,
      bestDecimal: null,
      label: topTryScorer.tryPct >= 28 ? "LIKELY" : "FAIR",
    });
  }

  candidates.sort((a, b) => {
    const rank = (v: ValueBetPick) => {
      if (v.label === "VALUE") return 300 + (v.edgePct ?? 0) + v.likelihoodPct * 0.15;
      if (v.label === "LIKELY") return 180 + v.likelihoodPct;
      if (v.label === "FAIR") return 80 + v.likelihoodPct;
      return v.likelihoodPct;
    };
    return rank(b) - rank(a);
  });

  const seen = new Set<string>();
  const picked: ValueBetPick[] = [];
  for (const c of candidates) {
    const dedupeKey = c.market === "Match Winner" ? "Match Winner" : c.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}

type RankedInsight = TeamNarrativeInsight & { strength: number };

/**
 * Betway-style match market angles from the Planet Rugby prediction + recent halves.
 * Covers: WDW, handicap, totals, team totals, winning margin, highest-scoring half, 1H.
 */
export function buildMatchMarketInsights(input: {
  homeName: string;
  awayName: string;
  prediction: MatchBettingPrediction;
  homeMatches: FinishedTeamMatch[];
  awayMatches: FinishedTeamMatch[];
  /** Fixture seed — rotates which market angles lead the board */
  varietySeed?: string | null;
}): MatchMarketInsight[] {
  const { homeName, awayName, prediction: p } = input;
  const expHome = roundPoints(p.expectedHomeScore);
  const expAway = roundPoints(p.expectedAwayScore);
  const total = expHome + expAway;
  const margin = expHome - expAway;
  const absMargin = Math.abs(margin);
  const favorite = margin >= 0 ? homeName : awayName;
  const underdog = margin >= 0 ? awayName : homeName;
  const favoriteLine = absMargin < 1 ? 0 : halfLine(absMargin);

  const insights: MatchMarketInsight[] = [];

  // Win / Draw / Win
  insights.push({
    key: "wdw",
    label: "Win / Draw / Win",
    body: `Planet Rugby: ${homeName} ${p.homeWinPct}% · Draw ${p.drawPct}% · ${awayName} ${p.awayWinPct}% (lean ${
      p.lean === "home" ? homeName : p.lean === "away" ? awayName : "tight"
    }).`,
    modelValue: `${p.homeWinPct}/${p.drawPct}/${p.awayWinPct}`,
  });

  // Handicap (spread)
  if (favoriteLine >= 2) {
    insights.push({
      key: "handicap",
      label: "Handicap",
      body: `Expected score ${homeName} ${expHome} · ${awayName} ${expAway} — model margin about ${absMargin} pts toward ${favorite}. Watch handicap lines near ${favorite} -${favoriteLine} / ${underdog} +${favoriteLine}.`,
      modelValue: `${favorite} -${favoriteLine}`,
    });
  } else {
    insights.push({
      key: "handicap",
      label: "Handicap",
      body: `Expected score ${homeName} ${expHome} · ${awayName} ${expAway} — tight margin (${absMargin} pts). Small handicap lines (±2.5 / ±4.5) are the relevant band.`,
      modelValue: `±${Math.max(2.5, favoriteLine || 2.5)}`,
    });
  }

  // Handicap 3-way (margin bands as proxy)
  const marginBucket = p.winningMargin[0];
  insights.push({
    key: "handicap_3way",
    label: "Handicap 3-Way",
    body: `Most likely winning margin band is ${marginBucket?.label ?? "1–7"} (${
      marginBucket?.probability ?? "—"
    }%). 3-way handicap lines around ±4 / ±10 should be weighed against that distribution.`,
    modelValue: marginBucket ? `${marginBucket.label} ${marginBucket.probability}%` : null,
  });

  // Total points — whole modelled points; .5 only for book O/U lines
  const totalLine = halfLine(total);
  insights.push({
    key: "total_points",
    label: "Total Points",
    body: `Modelled combined points ${total}. Book totals often sit 57.5–65.5 for Currie Cup — treat Over/Under vs Planet Rugby ${total} (line ~${totalLine}) as the value reference.`,
    modelValue: String(total),
  });

  // Team totals
  insights.push({
    key: "team_totals",
    label: "Team Total Points",
    body: `${homeName} expected ${expHome} (team total lines often ~${halfLine(expHome)}); ${awayName} expected ${expAway} (often ~${halfLine(expAway)}).`,
    modelValue: `${expHome} / ${expAway}`,
  });

  // Winning margin
  const marginBits = p.winningMargin
    .map((m) => `${m.label} ${m.probability}%`)
    .join(" · ");
  insights.push({
    key: "winning_margin",
    label: "Winning Margin",
    body: `Margin distribution: ${marginBits}.`,
    modelValue: marginBits,
  });

  // Points range (from expected total ± band)
  const low = Math.max(20, total - 12);
  const high = total + 12;
  insights.push({
    key: "points_range",
    label: "Points Range",
    body: `Planet Rugby central total ${total} implies a realistic match points range around ${low}–${high} unless weather suppresses scoring.`,
    modelValue: `${low}–${high}`,
  });

  // Highest scoring half + 1H from historical HT data (dedupe by fixture)
  const htByFixture = new Map<string, FinishedTeamMatch>();
  for (const m of [...input.homeMatches, ...input.awayMatches]) {
    if (m.halfTimeFor == null || m.halfTimeAgainst == null) continue;
    const key = m.fixtureId ?? `${m.kickoffAt?.toISOString() ?? ""}-${m.pointsFor}-${m.pointsAgainst}`;
    if (!htByFixture.has(key)) htByFixture.set(key, m);
  }
  const htSamples = [...htByFixture.values()];
  const homeHt = roundPoints(expHome * 0.48);
  const awayHt = roundPoints(expAway * 0.48);

  if (htSamples.length >= 2) {
    let firstHigher = 0;
    let secondHigher = 0;
    let equal = 0;
    let firstHalfTotals = 0;
    for (const m of htSamples) {
      const htTotal = m.halfTimeFor! + m.halfTimeAgainst!;
      const secondTotal = m.pointsFor + m.pointsAgainst - htTotal;
      if (htTotal > secondTotal) firstHigher += 1;
      else if (secondTotal > htTotal) secondHigher += 1;
      else equal += 1;
      firstHalfTotals += htTotal;
    }
    const n = htSamples.length;
    const avgFirstHalf = roundPoints(firstHalfTotals / n);
    const halfLean =
      secondHigher > firstHigher
        ? "second half"
        : firstHigher > secondHigher
          ? "first half"
          : "either half";
    insights.push({
      key: "highest_scoring_half",
      label: "Highest Scoring Half",
      body: `In ${n} recent sampled matches, the ${halfLean} produced more points more often (1H higher ${firstHigher}, 2H higher ${secondHigher}, level ${equal}). Average first-half points ~${avgFirstHalf}.`,
      modelValue: halfLean,
    });

    const homeHtGames = input.homeMatches.filter(
      (m) => m.isHome && m.halfTimeFor != null && m.halfTimeAgainst != null,
    );
    const awayHtGames = input.awayMatches.filter(
      (m) => !m.isHome && m.halfTimeFor != null && m.halfTimeAgainst != null,
    );
    const homeHtWon = homeHtGames.filter((m) => m.halfTimeFor! > m.halfTimeAgainst!).length;
    const awayHtWon = awayHtGames.filter((m) => m.halfTimeFor! > m.halfTimeAgainst!).length;
    insights.push({
      key: "first_half_wdw",
      label: "1st Half — Win / Draw / Win",
      body: `${homeName} led at HT in ${homeHtWon}/${homeHtGames.length || 0} recent home games; ${awayName} led at HT in ${awayHtWon}/${
        awayHtGames.length || 0
      } recent away games. Full-time lean: ${
        p.lean === "home" ? homeName : p.lean === "away" ? awayName : "uncertain"
      }.`,
      modelValue: `${homeHtWon}/${awayHtWon}`,
    });

    insights.push({
      key: "first_half_totals",
      label: "1st Half — Team Totals",
      body: `Implied first-half team totals from the model: ${homeName} ~${homeHt}, ${awayName} ~${awayHt} (≈48% of expected match points). 1H draw-no-bet tracks the same half-time lean.`,
      modelValue: `${homeHt} / ${awayHt}`,
    });
  } else {
    insights.push({
      key: "highest_scoring_half",
      label: "Highest Scoring Half",
      body: `Limited half-time samples for these sides. Use modelled match total ${total} — first-half share often ~45–50% in Currie Cup.`,
      modelValue: null,
    });
    insights.push({
      key: "first_half_wdw",
      label: "1st Half — Win / Draw / Win",
      body: `Not enough half-time samples yet. Full-time lean is ${
        p.lean === "home" ? homeName : p.lean === "away" ? awayName : "uncertain"
      }; 1H markets should be treated as higher variance.`,
      modelValue: null,
    });
    const firstHalfCombined = homeHt + awayHt;
    insights.push({
      key: "first_half_totals",
      label: "1st Half — Totals",
      body: `Implied first-half points ~${firstHalfCombined} combined (${homeName} ~${homeHt}, ${awayName} ~${awayHt}).`,
      modelValue: String(firstHalfCombined),
    });
  }

  // Win + totals combo
  insights.push({
    key: "wdw_and_totals",
    label: "Win / Draw / Win & Total Points",
    body: `Combo angle: ${favorite} to win with match total vs ${totalLine} (model total ${total}). Stronger when lean confidence is ${p.confidencePct}%.`,
    modelValue: `${favorite} & O/U ${totalLine}`,
  });

  // Per-match variety: always keep core markets, rotate extras, cap at 10.
  const seed = hashVarietySeed(
    input.varietySeed ?? `${input.homeName}:${input.awayName}:${total}`,
  );
  const coreKeys = new Set([
    "wdw",
    "handicap",
    "total_points",
    "team_totals",
    "winning_margin",
  ]);
  const core = insights.filter((i) => coreKeys.has(i.key));
  const extras = rotateList(
    insights.filter((i) => !coreKeys.has(i.key)),
    seed % Math.max(insights.filter((i) => !coreKeys.has(i.key)).length, 1),
  );
  const keepExtras = clamp(1 + (seed % 5), 1, Math.min(5, extras.length));
  const selected = [...rotateList(core, seed % Math.max(core.length, 1)), ...extras.slice(0, keepExtras)];
  return selected.slice(0, 10);
}

function eventsByFixture(events: InsightEventRow[]): Map<string, InsightEventRow[]> {
  const map = new Map<string, InsightEventRow[]>();
  for (const e of events) {
    const list = map.get(e.fixtureId) ?? [];
    list.push(e);
    map.set(e.fixtureId, list);
  }
  return map;
}

function countVenueForm(matches: FinishedTeamMatch[], isHome: boolean): {
  played: number;
  won: number;
} {
  const scoped = matches.filter((m) => m.isHome === isHome);
  return {
    played: scoped.length,
    won: scoped.filter((m) => m.pointsFor > m.pointsAgainst).length,
  };
}

function consecutiveAwayMarginFails(
  matches: FinishedTeamMatch[],
  marginThreshold = 8,
): number {
  // Chronological newest-first assumed from loader.
  let streak = 0;
  for (const m of matches) {
    if (m.isHome) continue;
    const wonBy = m.pointsFor - m.pointsAgainst;
    if (wonBy >= marginThreshold) break;
    streak += 1;
  }
  return streak;
}

const TEAM_INSIGHT_PREFERRED = [
  "likely_scorer",
  "metres",
  "venue_form",
  "scores_first",
  "comeback",
  "final_20_tries",
  "away_margin",
  "home_blowouts",
  "recent_form",
  "try_rate",
  "secondary_scorer",
  "defence",
  "win_streak",
  "close_games",
  "points_avg",
] as const;

const TEAM_INSIGHT_GROUPS: string[][] = [
  ["likely_scorer", "secondary_scorer", "try_rate"],
  ["metres", "defence", "points_avg"],
  ["venue_form", "recent_form", "win_streak"],
  ["scores_first", "final_20_tries", "comeback"],
  ["away_margin", "home_blowouts", "close_games"],
];

/** Deterministic hash so the same match/team always gets the same mix. */
export function hashVarietySeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rotateList<T>(list: T[], offset: number): T[] {
  if (!list.length) return list;
  const o = ((offset % list.length) + list.length) % list.length;
  return [...list.slice(o), ...list.slice(0, o)];
}

/**
 * Pick a varied subset (6–10) of insights so each match surfaces a different mix.
 */
export function selectVariedInsights(
  candidates: RankedInsight[],
  input: { varietySeed?: string | null; limit?: number },
): TeamNarrativeInsight[] {
  const maxLimit = clamp(input.limit ?? 10, 6, 10);
  if (!candidates.length) return [];

  const bestByKey = new Map<string, RankedInsight>();
  for (const c of candidates) {
    const prev = bestByKey.get(c.key);
    if (!prev || c.strength > prev.strength) bestByKey.set(c.key, c);
  }
  const unique = [...bestByKey.values()];
  const seed = hashVarietySeed(input.varietySeed ?? "default");
  // Match-to-match variety: target 6–10 when enough candidates exist.
  const target = clamp(Math.min(unique.length, 6 + (seed % 5)), 1, maxLimit);

  const preferred = rotateList([...TEAM_INSIGHT_PREFERRED], seed % TEAM_INSIGHT_PREFERRED.length);
  const groups = rotateList(TEAM_INSIGHT_GROUPS, seed % TEAM_INSIGHT_GROUPS.length);

  const byKey = new Map(unique.map((c) => [c.key, c]));
  const picked: RankedInsight[] = [];
  const used = new Set<string>();

  // Round-robin across rotated groups for variety
  let progressed = true;
  while (picked.length < target && progressed) {
    progressed = false;
    for (const group of groups) {
      if (picked.length >= target) break;
      const ordered = rotateList(group, seed % Math.max(group.length, 1));
      for (const key of ordered) {
        const item = byKey.get(key);
        if (!item || used.has(key)) continue;
        picked.push(item);
        used.add(key);
        progressed = true;
        break;
      }
    }
  }

  // Fill remaining by jittered strength + rotated preference
  if (picked.length < target) {
    const remaining = unique
      .filter((c) => !used.has(c.key))
      .map((c) => ({
        ...c,
        strength: c.strength + (((seed + c.key.length * 17) % 9) - 4),
      }))
      .sort((a, b) => {
        const ai = preferred.indexOf(a.key as (typeof TEAM_INSIGHT_PREFERRED)[number]);
        const bi = preferred.indexOf(b.key as (typeof TEAM_INSIGHT_PREFERRED)[number]);
        const ap = ai === -1 ? 99 : ai;
        const bp = bi === -1 ? 99 : bi;
        if (ap !== bp && Math.abs(a.strength - b.strength) < 14) return ap - bp;
        return b.strength - a.strength;
      });
    for (const item of remaining) {
      if (picked.length >= target) break;
      picked.push(item);
      used.add(item.key);
    }
  }

  // Stable display order: rotated preference, then strength
  picked.sort((a, b) => {
    const ai = preferred.indexOf(a.key as (typeof TEAM_INSIGHT_PREFERRED)[number]);
    const bi = preferred.indexOf(b.key as (typeof TEAM_INSIGHT_PREFERRED)[number]);
    const ap = ai === -1 ? 99 : ai;
    const bp = bi === -1 ? 99 : bi;
    if (ap !== bp) return ap - bp;
    return b.strength - a.strength;
  });

  return picked.map(({ strength: _s, ...rest }) => rest);
}

/**
 * Build 6–10 narrative insights for one team from form, season rates and events.
 * Selection is seeded per match so boards vary fixture-to-fixture.
 */
export function buildTeamNarrativeInsights(input: {
  matches: FinishedTeamMatch[];
  events: InsightEventRow[];
  season: TeamInsightSeasonContext;
  /** Fixture + team seed for per-match variety */
  varietySeed?: string | null;
  limit?: number;
}): TeamNarrativeInsight[] {
  const { matches, season } = input;
  const byFixture = eventsByFixture(input.events);
  const candidates: RankedInsight[] = [];
  const name = season.teamName;

  // 1) Venue form (home or away for this fixture)
  const venueIsHome = season.venueHome;
  const venueForm = countVenueForm(matches, venueIsHome);
  if (venueForm.played >= 1) {
    const venueWord = venueIsHome ? "home" : "away";
    candidates.push({
      key: "venue_form",
      label: venueIsHome ? "Home form" : "Away form",
      body: `${name} have won ${venueForm.won} of their last ${venueForm.played} ${venueWord} matches.`,
      sampleSize: venueForm.played,
      strength: 70 + Math.min(venueForm.played, 12) * 2 + (venueForm.won / venueForm.played) * 20,
    });
  }

  // 2) Recent overall form
  const last = matches.slice(0, 10);
  if (last.length >= 1) {
    const won = last.filter((m) => m.pointsFor > m.pointsAgainst).length;
    candidates.push({
      key: "recent_form",
      label: "Recent form",
      body: `${name} have won ${won} of their last ${last.length} matches.`,
      sampleSize: last.length,
      strength: 55 + won * 4,
    });
  }

  // 3) Likely try scorers
  const topScorer = season.topTryScorers[0];
  if (topScorer && topScorer.tries >= 1) {
    candidates.push({
      key: "likely_scorer",
      label: "Likely to score",
      body: `${topScorer.playerName} leads the ${name} season try chart with ${topScorer.tries} ${
        topScorer.tries === 1 ? "try" : "tries"
      } — the likeliest scorer in this XV.`,
      sampleSize: topScorer.tries,
      strength: 85 + Math.min(topScorer.tries, 10) * 2,
    });
  }
  const secondScorer = season.topTryScorers[1];
  if (secondScorer && secondScorer.tries >= 1) {
    candidates.push({
      key: "secondary_scorer",
      label: "Second try threat",
      body: `${secondScorer.playerName} is next on the ${name} try chart with ${secondScorer.tries} ${
        secondScorer.tries === 1 ? "try" : "tries"
      } this season.`,
      sampleSize: secondScorer.tries,
      strength: 70 + Math.min(secondScorer.tries, 8) * 2,
    });
  }

  // 4) Metres / "fastest" attacking proxy
  if (season.seasonMetresTotal != null && season.seasonMetresMatches >= 2) {
    const avg = Math.round(season.seasonMetresTotal / season.seasonMetresMatches);
    candidates.push({
      key: "metres",
      label: "Metres covered",
      body: `${name} have covered ${season.seasonMetresTotal.toLocaleString()} metres across ${
        season.seasonMetresMatches
      } matches this season — about ${avg} metres per match.`,
      sampleSize: season.seasonMetresMatches,
      strength: 75 + Math.min(avg / 20, 20),
    });
  } else {
    const metreMatches = matches.filter((m) => m.metresFor != null && m.metresFor > 0);
    if (metreMatches.length >= 2) {
      const total = metreMatches.reduce((s, m) => s + (m.metresFor ?? 0), 0);
      const avg = Math.round(total / metreMatches.length);
      candidates.push({
        key: "metres",
        label: "Metres covered",
        body: `${name} have averaged ${avg} metres per match across their last ${metreMatches.length} games with metre data.`,
        sampleSize: metreMatches.length,
        strength: 60 + Math.min(avg / 25, 15),
      });
    }
  }

  // 5) Final-20 try share
  let teamTries = 0;
  let final20Tries = 0;
  let trySampleFixtures = 0;
  for (const m of matches) {
    if (!m.fixtureId) continue;
    const ev = byFixture.get(m.fixtureId) ?? [];
    const tries = ev.filter(
      (e) =>
        (e.eventType === "try" || e.eventType === "penalty_try") && e.teamId === season.teamId,
    );
    if (!tries.length) continue;
    trySampleFixtures += 1;
    teamTries += tries.length;
    final20Tries += tries.filter((e) => e.minute >= FINAL_TWENTY_MIN_MINUTE).length;
  }
  if (teamTries >= 2 && trySampleFixtures >= 1) {
    const pct = Math.round((final20Tries / teamTries) * 100);
    candidates.push({
      key: "final_20_tries",
      label: "Late tries",
      body: `${name} score ${pct}% of their tries in the final 20 minutes (${final20Tries} of ${teamTries} in sampled matches).`,
      sampleSize: teamTries,
      strength: 80 + Math.min(trySampleFixtures, 8),
    });
  }

  // 6) Scores first
  let firstScoreSample = 0;
  let firstScoreWins = 0;
  for (const m of matches) {
    if (!m.fixtureId || !m.homeTeamId || !m.awayTeamId) continue;
    const ev = byFixture.get(m.fixtureId) ?? [];
    if (!ev.length) continue;
    const first = resolveFirstScoringEvent(
      ev.map((e) => ({
        eventType: e.eventType,
        minute: e.minute,
        second: e.second ?? undefined,
        sequenceNo: e.sequenceNo ?? undefined,
        teamId: e.teamId,
      })),
    );
    if (!first.verified || !first.teamId) continue;
    firstScoreSample += 1;
    if (first.teamId === season.teamId) firstScoreWins += 1;
  }
  if (firstScoreSample >= 1) {
    const pct = Math.round((firstScoreWins / firstScoreSample) * 100);
    candidates.push({
      key: "scores_first",
      label: "Who scores first",
      body: `${name} have scored first in ${firstScoreWins} of their last ${firstScoreSample} matches with a verified opening score (${pct}%).`,
      sampleSize: firstScoreSample,
      strength: 78 + pct * 0.15,
    });
  }

  // 7) Recover from losing position
  let trailed = 0;
  let recovered = 0;
  for (const m of matches) {
    if (!m.fixtureId || !m.homeTeamId || !m.awayTeamId) continue;
    const ev = byFixture.get(m.fixtureId) ?? [];
    if (ev.length < 2) continue;
    const state = resolveFixtureLosingPositionState({
      events: ev.map((e) => ({
        eventType: e.eventType,
        teamId: e.teamId,
        minute: e.minute,
        second: e.second,
        sequenceNo: e.sequenceNo,
        payload: e.payload,
      })),
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
    });
    if (!state.scoreTimelineVerified) continue;
    const everTrailing = m.isHome ? state.homeEverTrailing : state.awayEverTrailing;
    if (!everTrailing) continue;
    trailed += 1;
    if (m.pointsFor > m.pointsAgainst) recovered += 1;
  }
  if (trailed >= 1) {
    candidates.push({
      key: "comeback",
      label: "Recover from losing position",
      body: `${name} have recovered from a losing position in ${recovered} of ${trailed} matches when trailing.`,
      sampleSize: trailed,
      strength: 72 + (recovered / trailed) * 25,
    });
  }

  // 8) Away margin streak (handicap-style proxy — winning margin, not bookmaker handicap)
  const marginFails = consecutiveAwayMarginFails(matches, 8);
  if (!season.venueHome && marginFails >= 3) {
    candidates.push({
      key: "away_margin",
      label: "Away margins",
      body: `${name} have failed to win by 8+ points in ${marginFails} consecutive away matches.`,
      sampleSize: marginFails,
      strength: 68 + marginFails * 3,
    });
  } else if (season.venueHome) {
    const home = matches.filter((m) => m.isHome).slice(0, 10);
    const bigWins = home.filter((m) => m.pointsFor - m.pointsAgainst >= 15).length;
    if (home.length >= 3 && bigWins >= 1) {
      candidates.push({
        key: "home_blowouts",
        label: "Home dominance",
        body: `${name} have won by 15+ points in ${bigWins} of their last ${home.length} home matches.`,
        sampleSize: home.length,
        strength: 62 + bigWins * 6,
      });
    }
  }

  // 9) Scoring rate
  const withTries = matches.filter((m) => m.triesFor != null);
  if (withTries.length >= 1) {
    const avgTries =
      withTries.reduce((s, m) => s + (m.triesFor ?? 0), 0) / withTries.length;
    candidates.push({
      key: "try_rate",
      label: "Try rate",
      body: `${name} average ${round1(avgTries)} tries per match across their last ${withTries.length} games.`,
      sampleSize: withTries.length,
      strength: 50 + avgTries * 6,
    });
  }

  // 10) Defence / points against
  if (matches.length >= 1) {
    const pa = avg(matches.slice(0, 5).map((m) => m.pointsAgainst));
    if (pa != null) {
      candidates.push({
        key: "defence",
        label: "Points against",
        body: `${name} are conceding ${round1(pa)} points per match across their last ${Math.min(5, matches.length)} games.`,
        sampleSize: Math.min(5, matches.length),
        strength: 58 + Math.max(0, 28 - pa),
      });
    }
  }

  // 11) Win streak (newest-first)
  let winStreak = 0;
  for (const m of matches) {
    if (m.pointsFor > m.pointsAgainst) winStreak += 1;
    else break;
  }
  if (winStreak >= 2) {
    candidates.push({
      key: "win_streak",
      label: "Win streak",
      body: `${name} are on a run of ${winStreak} consecutive wins.`,
      sampleSize: winStreak,
      strength: 66 + winStreak * 4,
    });
  }

  // 12) Tight games
  const recent = matches.slice(0, 8);
  const close = recent.filter((m) => Math.abs(m.pointsFor - m.pointsAgainst) <= 7);
  if (recent.length >= 2 && close.length >= 1) {
    candidates.push({
      key: "close_games",
      label: "Tight finishes",
      body: `${name} have finished within 7 points in ${close.length} of their last ${recent.length} matches.`,
      sampleSize: recent.length,
      strength: 54 + close.length * 3,
    });
  }

  // 13) Scoring profile pad candidate
  if (matches.length > 0) {
    const pf = avg(matches.slice(0, 5).map((m) => m.pointsFor));
    const pa = avg(matches.slice(0, 5).map((m) => m.pointsAgainst));
    if (pf != null && pa != null) {
      candidates.push({
        key: "points_avg",
        label: "Scoring profile",
        body: `${name} are averaging ${round1(pf)} points for and ${round1(pa)} against across their last ${Math.min(5, matches.length)} matches.`,
        sampleSize: Math.min(5, matches.length),
        strength: 48 + pf * 0.4,
      });
    }
  }

  return selectVariedInsights(candidates, {
    varietySeed: input.varietySeed ?? `${season.teamId}:${season.venueHome ? "H" : "A"}`,
    limit: input.limit ?? 10,
  });
}
