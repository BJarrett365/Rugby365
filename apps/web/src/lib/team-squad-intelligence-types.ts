/** Shared team-compare types (safe for client imports). */

export type TeamSquadPlayerRow = {
  id: string;
  slug: string;
  name: string;
  positionName: string | null;
  rating: number | null;
  marketValueGbp: number;
  marketValueLabel: string;
  age: number | null;
  squadRole: "starting" | "bench" | "squad";
};

export type TeamSquadValueSummary = {
  playerCount: number;
  ratedPlayerCount: number;
  totalSquadValueGbp: number;
  totalSquadValueLabel: string;
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

export type TeamCompareSidePacket = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  imageUrl: string | null;
  countryName: string | null;
  teamType: string | null;
  foundedYear: number | null;
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
  squad: TeamSquadPlayerRow[];
};
