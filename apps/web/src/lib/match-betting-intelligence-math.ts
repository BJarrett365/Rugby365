/**
 * Planet Rugby Betting Intelligence v1 — explainable win probability model.
 * Pure functions; no bookmaker odds required.
 */

import type {
  BetBuilderLeg,
  BetBuilderSuggestion,
  BettingMarginBucket,
  BettingSignal,
  MatchBettingConfidence,
  MatchBettingPrediction,
  PlayerPropRow,
  TeamTrendWindow,
} from "./match-betting-intelligence-types";

export const BETTING_INTEL_MODEL = "betting-intel-v1";

export type BettingIntelMathInput = {
  homeName: string;
  awayName: string;
  /** Average career rating of named XV / available ratings */
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
};

export type FinishedTeamMatch = {
  kickoffAt: Date | null;
  isHome: boolean;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number | null;
  dayOfWeek: number | null;
  wetWeather: boolean;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

  if (input.hasHomeVenue) {
    signals.push({
      key: "home_advantage",
      side: "home",
      weight: 0.12,
      label: "Home advantage",
      detail: `${input.homeName} play at home — historically a material edge in rugby.`,
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
      weight: 0.18,
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
      weight: 0.14,
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
      weight: 0.2,
      label: "Rugby365 Rating",
      detail:
        side === "neutral"
          ? "Squad quality ratings are tightly matched."
          : `${side === "home" ? input.homeName : input.awayName} rate higher on Rugby365 career quality.`,
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
      weight: 0.16,
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
      weight: 0.08,
      label: "Coach rating",
      detail:
        side === "neutral"
          ? "Coach ratings are similar for this fixture."
          : `${side === "home" ? input.homeName : input.awayName} hold the coaching edge for this match.`,
      homeValue: input.homeCoachRating != null ? input.homeCoachRating.toFixed(1) : "—",
      awayValue: input.awayCoachRating != null ? input.awayCoachRating.toFixed(1) : "—",
    });
  }

  if (input.weatherHarsh) {
    signals.push({
      key: "weather",
      side: "neutral",
      weight: 0.06,
      label: "Weather",
      detail: "Conditions may suppress scoring and favour territory / set-piece sides.",
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

  const ratingGap = (input.homeAvgRating ?? 72) - (input.awayAvgRating ?? 72);
  const baseHome = 24 + ratingGap * 0.22 + (input.hasHomeVenue ? 2.5 : 0);
  const baseAway = 22 - ratingGap * 0.18;
  const expectedHomeScore = round1(clamp(baseHome, 12, 48));
  const expectedAwayScore = round1(clamp(baseAway, 10, 45));
  const expectedHomeTries = round1(clamp(expectedHomeScore / 7.2, 1.2, 7));
  const expectedAwayTries = round1(clamp(expectedAwayScore / 7.4, 1.0, 6.5));

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
        detail: `Expected combined tries ${totalTries.toFixed(1)}`,
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
      detail: `Expected ${p.expectedHomeTries.toFixed(1)}–${p.expectedAwayTries.toFixed(1)} tries`,
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
