export type LiveSportTournamentMeta = {
  competitionName: string;
  competitionSlug: string;
  seasonLabel: string;
  tournamentId: string | null;
  seasonTournamentId: string | null;
  sourceUrl: string;
  pagePath: string;
};

export type LiveSportMatchRow = {
  matchId: string;
  sourceUrl: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "full_time" | "live";
  round: string | null;
  kickoffAt: string | null;
};

export type LiveSportStandingRow = {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  points: number;
};

export type LiveSportTournamentPreview = {
  kind: "tournament";
  meta: LiveSportTournamentMeta;
  matches: LiveSportMatchRow[];
  standings: LiveSportStandingRow[];
};
