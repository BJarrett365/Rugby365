/**
 * Client-safe types/constants for Rating Trends.
 * Do not import db/server-only modules here.
 */

export const COACH_TREND_FILTERS = [
  "last_5",
  "last_10",
  "last_24",
  "months_12",
  "months_24",
  "current_tenure",
  "career",
] as const;

export type CoachTrendFilter = (typeof COACH_TREND_FILTERS)[number];

export const COACH_TREND_FILTER_LABELS: Record<CoachTrendFilter, string> = {
  last_5: "Last 5 Matches",
  last_10: "Last 10 Matches",
  last_24: "Last 24 Matches",
  months_12: "12 Months",
  months_24: "24 Months",
  current_tenure: "Current Tenure",
  career: "Career",
};

export const COACH_TREND_DIRECTION_VERSION = "coach-trend-v1";

export type CoachRatingTrendPoint = {
  id: string;
  coachId: string;
  fixtureId: string | null;
  snapshotType: string;
  matchDate: string | null;
  rating: number;
  previousRating: number | null;
  change: number | null;
  powerIndex: number | null;
  powerIndexChange: number | null;
  result: "W" | "D" | "L" | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  teamId: string | null;
  teamName: string | null;
  opponentId: string | null;
  opponentName: string | null;
  competitionName: string | null;
  fixtureSlug: string | null;
  homeAwayNeutral: string | null;
  majorMatchLabel: string | null;
  confidence: number | null;
  coverage: number | null;
  dataConfidence: string | null;
  modelVersion: string;
  contributions: Array<{
    key: string;
    label?: string;
    weight?: number;
    score?: number | null;
    contribution?: number | null;
  }>;
  intelligence: Array<{
    key: string;
    label?: string;
    score: number | null;
    previousScore?: number | null;
    confidence?: number;
  }>;
};

export type CoachRatingTrendSummary = {
  current: number | null;
  rangeChange: number | null;
  high: number | null;
  low: number | null;
  trend: "rising" | "stable" | "falling" | null;
  trendLabel: string | null;
  trendVersion: string;
  pointCount: number;
  filter: CoachTrendFilter;
  filterLabel: string;
};

export type CoachRatingTrendsBundle = {
  points: CoachRatingTrendPoint[];
  summary: CoachRatingTrendSummary;
  tenures: Array<{
    year: number;
    label: string;
    startDate: string | null;
  }>;
};
