/** Display helpers for Sport365-style competition player leaderboards. */

const INTERNATIONAL_TEAM_CODES: Record<string, string> = {
  argentina: "ARG",
  australia: "AUS",
  england: "ENG",
  fiji: "FIJ",
  france: "FRA",
  georgia: "GEO",
  ireland: "IRE",
  italy: "ITA",
  japan: "JPN",
  "new zealand": "NZL",
  portugal: "POR",
  romania: "ROU",
  samoa: "SAM",
  scotland: "SCO",
  "south africa": "RSA",
  tonga: "TGA",
  uruguay: "URU",
  wales: "WAL",
  "hong kong": "HKG",
  chile: "CHI",
  zimbabwe: "ZIM",
  canada: "CAN",
  "united states": "USA",
  spain: "ESP",
};

/** "Ruben Love" → "R. Love" */
export function formatLeaderboardPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  const first = parts[0] ?? "";
  const rest = parts.slice(1).join(" ");
  const initial = first.charAt(0).toUpperCase();
  return initial ? `${initial}. ${rest}` : rest;
}

export function teamCodeForLeaderboard(input: {
  teamName: string;
  teamShortName?: string | null;
}): string {
  const short = input.teamShortName?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{3}$/.test(short) && short !== "NEW") return short;
  const mapped = INTERNATIONAL_TEAM_CODES[input.teamName.trim().toLowerCase()];
  if (mapped) return mapped;
  if (short.length >= 2 && short.length <= 4) return short;
  return input.teamName.trim().slice(0, 3).toUpperCase() || "—";
}

export const LEADERBOARD_VALUE_LABELS: Record<string, string> = {
  points: "PTS",
  tries: "TRIES",
  tacklesCompleted: "TT",
  metresCarried: "M",
  carries: "CAR",
  tryAssists: "AST",
  defendersBeaten: "DB",
  lineBreaks: "CB",
  turnoversWon: "TO",
  dominantTackles: "DT",
  postContactMetres: "PCM",
};
