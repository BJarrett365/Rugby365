/**
 * Planet Rugby Betting Intelligence — types for Match Centre.
 * Value bets are always modelled; bookmaker edge appears when odds are linked.
 */

export type BettingIntelligenceSubTab =
  | "overview"
  | "prediction"
  | "insights"
  | "trends"
  | "referee"
  | "venue"
  | "props"
  | "builder"
  | "value"
  | "odds";

export type BettingSignalKey =
  | "form"
  | "h2h"
  | "home_advantage"
  | "availability"
  | "ratings"
  | "squad_depth"
  | "coach"
  | "referee"
  | "venue"
  | "weather"
  | "weather_fit"
  | "international_quality"
  | "fatigue"
  | "travel"
  | "momentum";

export type BettingSignal = {
  key: BettingSignalKey;
  side: "home" | "away" | "neutral";
  weight: number;
  label: string;
  detail: string;
  homeValue?: string | null;
  awayValue?: string | null;
};

export type BettingMarginBucket = {
  key: "1-7" | "8-14" | "15+";
  label: string;
  probability: number;
};

export type MatchBettingPrediction = {
  modelVersion: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  lean: "home" | "away" | "draw" | "uncertain";
  confidencePct: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
  expectedHomeTries: number;
  expectedAwayTries: number;
  winningMargin: BettingMarginBucket[];
};

export type MatchBettingConfidence = {
  bettingConfidence: number;
  dataConfidence: number;
  predictionConfidence: number;
  marketConfidence: number | null;
  stars: number;
};

export type TeamTrendWindow = {
  key: string;
  label: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  avgPointsFor: number | null;
  avgPointsAgainst: number | null;
  avgTriesFor: number | null;
  winPct: number | null;
};

export type TeamTrendsBlock = {
  teamName: string;
  side: "home" | "away";
  windows: TeamTrendWindow[];
};

export type RefereeBettingIntel = {
  name: string | null;
  slug: string | null;
  ratingLabel: string | null;
  matchesSampled: number;
  avgPenalties: number | null;
  avgYellowCards: number | null;
  avgRedCards: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  avgTotalPoints: number | null;
  avgTotalTries: number | null;
};

export type VenueBettingIntel = {
  name: string | null;
  city: string | null;
  weatherLabel: string | null;
  isHomeAdvantage: boolean;
  matchesSampled: number;
  homeWinPct: number | null;
  avgHomeScore: number | null;
  avgAwayScore: number | null;
  avgTotalPoints: number | null;
  avgTotalTries: number | null;
  altitudeM: number | null;
};

export type PlayerPropRow = {
  playerId: string;
  playerName: string;
  teamSide: "home" | "away";
  positionName: string | null;
  jerseyNumber: number | null;
  careerRating: number | null;
  formRating: number | null;
  tryPct: number;
  assistPct: number;
  motmPct: number;
  expectedTackles: number;
  expectedCarries: number;
  expectedMetres: number;
  expectedLineBreaks: number;
  sampleMatches: number;
};

export type BetBuilderLeg = {
  id: string;
  label: string;
  detail: string;
  probabilityPct: number;
};

export type BetBuilderSuggestion = {
  title: string;
  legs: BetBuilderLeg[];
  combinedConfidencePct: number;
  explanation: string;
};

/** Ranked selection most likely to land (and valued vs market when odds exist). */
export type ValueBetPick = {
  id: string;
  market: string;
  selection: string;
  /** Modelled chance the selection happens */
  likelihoodPct: number;
  reason: string;
  marketPct: number | null;
  edgePct: number | null;
  bestDecimal: number | null;
  label: "VALUE" | "LIKELY" | "FAIR" | "SHORT";
};

/** Narrative Betting Intelligence insight (Insights tab). */
export type TeamNarrativeInsight = {
  key: string;
  label: string;
  body: string;
  sampleSize: number;
};

/** Match-level market angle (handicap, totals, halves — Betway-style coverage). */
export type MatchMarketInsight = {
  key: string;
  label: string;
  body: string;
  /** Optional modelled number for the angle (line, total, margin). */
  modelValue?: string | null;
};

export type MatchBettingIntelligence = {
  fixtureId: string | null;
  homeName: string;
  awayName: string;
  homeImageUrl: string | null;
  awayImageUrl: string | null;
  prediction: MatchBettingPrediction;
  signals: BettingSignal[];
  /** 6–10 narrative insights per team (varied per match) */
  insights: {
    home: TeamNarrativeInsight[];
    away: TeamNarrativeInsight[];
  };
  /** Match market angles: handicap, totals, team totals, margin, halves */
  marketInsights: MatchMarketInsight[];
  whyTitle: string;
  whyLead: string;
  confidence: MatchBettingConfidence;
  availability: {
    homeUnavailable: number;
    awayUnavailable: number;
    notableAbsences: Array<{
      side: "home" | "away";
      playerName: string;
      reason: string;
    }>;
  };
  trends: {
    home: TeamTrendsBlock;
    away: TeamTrendsBlock;
  };
  referee: RefereeBettingIntel | null;
  venue: VenueBettingIntel | null;
  h2h: {
    homeWins: number;
    awayWins: number;
    draws: number;
    meetingsSampled: number;
  };
  playerProps: PlayerPropRow[];
  betBuilder: BetBuilderSuggestion[];
  /** Latest winner-market odds snapshot (BMbets / other) when linked */
  odds: {
    sourceUrl: string;
    provider: string;
    scrapedAt: string | null;
    bookmakerCount: number;
    bestHomeDecimal: number | null;
    bestDrawDecimal: number | null;
    bestAwayDecimal: number | null;
    impliedHomePct: number | null;
    impliedDrawPct: number | null;
    impliedAwayPct: number | null;
  } | null;
  /** Best valued / most likely selections (max ~5), ranked */
  valueBets: ValueBetPick[];
  /** Optional notes when odds feed is missing */
  comingSoon: Array<{
    id: BettingIntelligenceSubTab;
    title: string;
    blurb: string;
  }>;
};
