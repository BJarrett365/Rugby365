export type WikipediaSeasonStage =
  | "regular"
  | "semi_final"
  | "final"
  | "quarter_final"
  | "playoff";

export type WikipediaStandingRow = {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  triesFor: number | null;
  tryBonusPoints: number;
  losingBonusPoints: number;
  bonusPoints: number;
  pointsDeduction: number;
  points: number;
  isChampionMarker: boolean;
  qualificationNotes: string | null;
};

export type WikipediaFixtureRow = {
  date: string | null;
  kickoffAt: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  venueName: string | null;
  attendance: number | null;
  refereeName: string | null;
  round: string | null;
  matchweek: number | null;
  stage: WikipediaSeasonStage;
  status: "full_time" | "scheduled" | "postponed" | "cancelled";
  notes: string | null;
};

export type WikipediaClubRow = {
  clubName: string;
  headCoach: string | null;
  captain: string | null;
  stadium: string | null;
  capacity: number | null;
  cityArea: string | null;
};

export type WikipediaSeasonPageParse = {
  pageTitle: string;
  wikipediaUrl: string;
  revisionId: number | null;
  seasonStartYear: number | null;
  competitionHint: string | null;
  championName: string | null;
  runnersUpName: string | null;
  standings: WikipediaStandingRow[];
  fixtures: WikipediaFixtureRow[];
  playoffFixtures: WikipediaFixtureRow[];
  venues: string[];
  referees: string[];
  warnings: string[];
};

export type WikipediaSeasonFetchResult = {
  pageTitle: string;
  wikipediaUrl: string;
  revisionId: number | null;
  wikitext: string;
  sections: Array<{ index: string; line: string; level: number }>;
};
