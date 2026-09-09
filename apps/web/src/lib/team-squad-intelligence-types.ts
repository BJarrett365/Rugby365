/** Shared team-compare types (safe for client imports). */

export type TeamSquadRole = "starting" | "bench" | "squad";

export type TeamSquadScope = "recent_match_squads" | "unavailable";

export type TeamXvSource = "last_match" | "modelled" | "unavailable";

export type PlayerMatchRatingPoint = {
  fixtureId: string;
  kickoffAt: string | null;
  rating: number;
};

export type TeamSquadPlayerRow = {
  id: string;
  slug: string;
  name: string;
  positionName: string | null;
  rating: number | null;
  /** Stored Rugby365 player-value-v1 row only. Null when no current stored value exists. */
  marketValueGbp: number | null;
  marketValueLabel: string | null;
  marketValueIsStored: boolean;
  age: number | null;
  jerseyNumber: number | null;
  squadRole: TeamSquadRole;
  imageUrl: string | null;
  matchRatingHistory: PlayerMatchRatingPoint[];
};

export type TeamSquadValueSummary = {
  playerCount: number;
  ratedPlayerCount: number;
  storedValueCount: number;
  totalSquadValueGbp: number | null;
  totalSquadValueLabel: string | null;
  averagePlayerValueGbp: number | null;
  averagePlayerValueLabel: string | null;
  startingXvValueGbp: number | null;
  startingXvValueLabel: string | null;
  benchValueGbp: number | null;
  benchValueLabel: string | null;
  averageAge: number | null;
  averageRating: number | null;
};

export type TeamFormSummary = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  winPct: number | null;
  pointsFor: number;
  pointsAgainst: number;
  lastResults: Array<"W" | "D" | "L">;
};

export type TeamLastMatchLineupMeta = {
  fixtureId: string;
  kickoffAt: string | null;
  competitionName: string | null;
  starterCount: number;
  substituteCount: number;
};

export type TeamCompareSidePacket = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  imageUrl: string | null;
  countryName: string | null;
  teamType: string | null;
  foundedYear: number | null;
  /** Last completed fixture competition name — not necessarily the current programme. */
  competitionName: string | null;
  coachName: string | null;
  homeVenueName: string | null;
  worldRank: number | null;
  worldRankPoints: number | null;
  trophyCount: number;
  form: TeamFormSummary;
  squadValue: TeamSquadValueSummary;
  rating: {
    modelVersion: string;
    overall: number | null;
    components: {
      squadStrength: number | null;
      form: number | null;
      value: number | null;
      depth: number | null;
      trophies: number | null;
    };
  };
  squadScope: TeamSquadScope;
  lastMatchLineup: TeamLastMatchLineupMeta | null;
  squad: TeamSquadPlayerRow[];
};
