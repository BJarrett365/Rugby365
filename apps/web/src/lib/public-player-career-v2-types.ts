/**
 * Player Career V2 DTO — factual career dashboard for /players/[slug]/career.
 * Unknown is null (UI shows "—"). Verified zero is 0.
 */

export type CareerTotalKey =
  | "played"
  | "points"
  | "tries"
  | "conversions"
  | "penalties"
  | "dropGoals"
  | "assists"
  | "tackleBreaks"
  | "cleanBreaks";

export type CareerTotalCell = {
  key: CareerTotalKey;
  label: string;
  value: number | null;
  /** First row (Played / Points / Tries) highlighted in green in the mock. */
  highlight?: boolean;
};

export type CareerMetaLine = {
  careerSpanLabel: string | null;
  seasonCount: number | null;
  clubCount: number | null;
  clubNames: string[];
  internationalCaps: number | null;
  internationalTeamName: string | null;
};

export type CareerTimelinePoint = {
  year: number;
  matches: number;
  points: number;
};

export type CareerHighStat = {
  key: string;
  label: string;
  value: string;
};

export type CareerMatchHigh = {
  key: string;
  label: string;
  value: number;
  detail: string;
};

export type CareerSeasonRow = {
  /** Stable unique key for React lists (season + club + competition + sort). */
  id: string;
  seasonLabel: string;
  seasonSort: number;
  clubName: string;
  competitionName: string;
  matches: number;
  minutes: number | null;
  points: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  tackleBreaks: number | null;
  cleanBreaks: number | null;
  assists: number | null;
  passPct: number | null;
  kickAccuracyPct: number | null;
  winPct: number | null;
  isInternational: boolean;
};

export type CareerCompetitionPoints = {
  key: string;
  label: string;
  points: number;
  percent: number;
};

export type CareerMilestone = {
  id: string;
  year: number | null;
  dateIso: string | null;
  title: string;
  detail: string | null;
};

export type CareerAward = {
  id: string;
  year: number | null;
  title: string;
  detail: string | null;
  verificationStatus: string;
};

export type CareerPositionSlice = {
  positionName: string;
  appearances: number;
  percent: number;
  color: string;
};

export type CareerFooterFact = {
  key: string;
  label: string;
  value: string;
};

export type PublicPlayerCareerV2Dto = {
  playerId: string;
  totals: CareerTotalCell[];
  meta: CareerMetaLine;
  timeline: CareerTimelinePoint[];
  highs: {
    summary: CareerHighStat[];
    matchHighs: CareerMatchHigh[];
    longestPointsStreak: number | null;
  };
  clubSeasonRows: CareerSeasonRow[];
  internationalSeasonRows: CareerSeasonRow[];
  allSeasonRows: CareerSeasonRow[];
  pointsByCompetition: CareerCompetitionPoints[];
  milestones: CareerMilestone[];
  awards: CareerAward[];
  positions: {
    total: number;
    slices: CareerPositionSlice[];
  };
  footer: CareerFooterFact[];
  dataAsOfIso: string | null;
  coverage: {
    linkedFixtures: number;
    withPerformance: number;
    notes: string[];
  };
};
