export const PLAYER_TITLE_TYPES = [
  "world_cup",
  "top_14",
  "premiership",
  "six_nations",
  "urc",
  "champions_cup",
  "currie_cup",
  "other",
] as const;

export type PlayerTitleType = (typeof PLAYER_TITLE_TYPES)[number];

export type PlayerTitleRow = {
  id: string;
  playerId: string;
  titleType: string;
  competitionId: string | null;
  seasonLabel: string | null;
  year: number | null;
  title: string;
  count: number;
  sourceUrl: string | null;
  visibility: string;
  sortOrder: number;
};

export function isPlayerTitleType(value: string): value is PlayerTitleType {
  return (PLAYER_TITLE_TYPES as readonly string[]).includes(value);
}

export function sumTitleCounts(titles: PlayerTitleRow[], type: PlayerTitleType): number {
  return titles
    .filter((t) => t.titleType === type && t.visibility === "public")
    .reduce((sum, t) => sum + (t.count || 1), 0);
}
