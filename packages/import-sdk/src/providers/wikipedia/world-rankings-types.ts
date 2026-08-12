import type { WorldRugbyRankingCategory } from "../world-rugby/rankings-types";

export type WikipediaWorldRankingEntry = {
  position: number;
  /** Positive = climbed that many places; negative = dropped. */
  change: number | null;
  teamName: string;
  teamCode: string | null;
  points: number;
};

export type WikipediaLeaderSpan = {
  teamName: string;
  teamCode: string | null;
  reignIndex: number | null;
  startDate: string;
  endDate: string | null;
  weeks: number | null;
  totalWeeks: number | null;
};

export type WikipediaRankMilestone = {
  teamName: string;
  teamCode: string | null;
  bestRank: number | null;
  bestYears: string | null;
  worstRank: number | null;
  worstYears: string | null;
};

export type WikipediaPointsMilestone = {
  teamName: string;
  teamCode: string | null;
  peakPoints: number | null;
  peakDate: string | null;
  troughPoints: number | null;
  troughDate: string | null;
};

export type WikipediaWorldRankingsParseResult = {
  category: WorldRugbyRankingCategory;
  pageTitle: string;
  sourceUrl: string;
  /** ISO date from "as of …" when present. */
  asOfDate: string | null;
  currentTable: WikipediaWorldRankingEntry[];
  leaderSpans: WikipediaLeaderSpan[];
  rankMilestones: WikipediaRankMilestone[];
  pointsMilestones: WikipediaPointsMilestone[];
};
