export type PlayerListFilters = {
  search?: string;
  teamId?: string;
  seasonId?: string;
  competitionId?: string;
  letter?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "rank" | "name";
};

export const PLAYER_LIST_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "#",
] as const;

export type PlayerListLetter = (typeof PLAYER_LIST_LETTERS)[number];

export function normalizePlayerListLetter(value?: string | null): PlayerListLetter | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "#") return "#";
  if (/^[A-Z]$/.test(trimmed)) return trimmed as PlayerListLetter;
  return undefined;
}

export function playerNameInitial(name: string): PlayerListLetter | "other" {
  const match = name.trim().match(/^([A-Za-z])/);
  if (!match) return "other";
  return match[1].toUpperCase() as PlayerListLetter;
}
