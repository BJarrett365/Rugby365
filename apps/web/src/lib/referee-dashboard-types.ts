export type DashboardSectionStatus = "ready" | "loading" | "empty" | "error";

export type RefereeFormResult = "positive" | "below";

export type RefereeRadarPoint = {
  category: string;
  referee: number;
  eliteAverage: number;
};

export type RefereeCareerStat = {
  key: string;
  label: string;
  value: string;
  hint?: string;
};

export type RefereeDisciplinarySlice = {
  key: "yellow" | "red" | "sinbin";
  label: string;
  perMatch: number;
  careerTotal: number;
};

export type RefereeRatingPoint = {
  month: string;
  rating: number;
};

export type RefereeInsight = {
  label: string;
  detail: string;
};

export type RefereeCompetitionBar = {
  competition: string;
  matches: number;
  avgRating: number;
};

export type RefereeMatchRow = {
  id: string;
  dateLabel: string;
  fixtureLabel: string;
  href: string | null;
  competition: string;
  rating: number | null;
  yellowCards: number | null;
  redCards: number | null;
  isMock: boolean;
  kickoffAtIso: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
};

export type RefereeSeasonMetric = {
  key: string;
  label: string;
  value: string;
};

export type RefereeNextAppointment = {
  competition: string;
  kickoffLabel: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  kickoffAtIso?: string | null;
};

export type RefereeHighlight = {
  label: string;
  detail: string;
};

export type RefereeDashboardBio = {
  nationality: string;
  dateOfBirth: string;
  worldRugbyDebut: string;
  refereeStyle: string;
  preferredRole: string;
  union: string;
  profession: string;
};

export type RefereeDashboardModel = {
  /** True when analytics (ratings, cards, radar) are placeholder values. */
  isMockAnalytics: boolean;
  slug: string;
  name: string;
  countryName: string;
  flagUrl: string | null;
  roleBadge: string;
  portraitUrl: string | null;
  bio: RefereeDashboardBio;
  overallRating: number;
  worldRank: number;
  totalMatches: number;
  internationalMatches: number;
  formLast10: RefereeFormResult[];
  radar: RefereeRadarPoint[];
  careerStats: RefereeCareerStat[];
  disciplinary: RefereeDisciplinarySlice[];
  ratingHistory: RefereeRatingPoint[];
  strengths: RefereeInsight[];
  developmentAreas: RefereeInsight[];
  matchTypeBreakdown: RefereeCompetitionBar[];
  recentMatches: RefereeMatchRow[];
  seasonLabel: string;
  seasonSummary: RefereeSeasonMetric[];
  nextAppointment: RefereeNextAppointment | null;
  highlights: RefereeHighlight[];
  about: string;
  sectionStatus: {
    radar: DashboardSectionStatus;
    career: DashboardSectionStatus;
    disciplinary: DashboardSectionStatus;
    ratingTrend: DashboardSectionStatus;
    insights: DashboardSectionStatus;
    breakdown: DashboardSectionStatus;
    matches: DashboardSectionStatus;
    season: DashboardSectionStatus;
    next: DashboardSectionStatus;
  };
};
