export type WorldRugbyRankingCategory = "mru" | "wru";

export type WorldRugbyRankingTeam = {
  id: string;
  altId: string;
  name: string;
  abbreviation: string;
  countryCode: string;
};

export type WorldRugbyRankingEntry = {
  team: WorldRugbyRankingTeam;
  position: number;
  points: number;
  previousPosition: number | null;
  previousPoints: number | null;
};

export type WorldRugbyRankingsPayload = {
  category: WorldRugbyRankingCategory;
  label: string;
  effectiveDate: string;
  entries: WorldRugbyRankingEntry[];
};
