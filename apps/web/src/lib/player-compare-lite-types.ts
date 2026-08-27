import type { CompareMetric } from "./player-compare-metrics";
import type { MarketValueTimelinePoint } from "./player-market-value-trend-utils";
import type { ValueTimelineSummary } from "./player-value-timeline-utils";

export type CompareLiteScoring = {
  appearances: number | null;
  points: number | null;
  tries: number | null;
  conversions: number | null;
  penalties: number | null;
  dropGoals: number | null;
  metres: number | null;
  defendersBeaten: number | null;
  tackles: number | null;
  tacklesCompleted: number | null;
  tryAssists: number | null;
  turnoversWon: number | null;
  minutesPlayed: number | null;
  lineBreaks: number | null;
};

export type CompareLiteRecentMatch = {
  id: string;
  kickoffAt: string | null;
  matchLabel: string;
  competitionName: string | null;
  result: "W" | "D" | "L" | null;
  rating: number | null;
  minutesPlayed: number | null;
};

export type CompareLitePlayer = {
  playerId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  positionName: string | null;
  clubName: string | null;
  nationName: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  overallRating: number | null;
  formScore: number | null;
  classificationLabel: string | null;
  marketValueGbp: number | null;
  caps: number | null;
  career: CompareLiteScoring;
  season: CompareLiteScoring;
  lastFiveRatings: number[];
  recentMatches: CompareLiteRecentMatch[];
};

export type CompareLiteCard = {
  slug: string;
  displayName: string;
  imageUrl: string | null;
  positionName: string | null;
  clubName: string | null;
  nationName: string | null;
  age: number | null;
  overallRating: number | null;
  formScore: number | null;
  classificationLabel: string | null;
  marketValueLabel: string | null;
  caps: number | null;
  scoring: {
    appearances: number | null;
    points: number | null;
    tries: number | null;
    metres: number | null;
    defendersBeaten: number | null;
    tackles: number | null;
    tryAssists: number | null;
  };
  recentMatches: CompareLiteRecentMatch[];
  lastFiveRatings: number[];
};

export type CompareLiteTimeline = {
  displayPoints: MarketValueTimelinePoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  summary: ValueTimelineSummary;
};

export type CompareLitePayload = {
  playerA: CompareLitePlayer;
  playerB: CompareLitePlayer;
  metrics: CompareMetric[];
  valueTimelineA: CompareLiteTimeline;
  valueTimelineB: CompareLiteTimeline;
};
