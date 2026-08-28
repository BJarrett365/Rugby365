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
  "western samoa": "SAM",
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
  "united states of america": "USA",
  spain: "ESP",
  namibia: "NAM",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "cote d'ivoire": "CIV",
  russia: "RUS",
  morocco: "MAR",
  "south korea": "KOR",
  netherlands: "NED",
  belgium: "BEL",
  germany: "GER",
  kenya: "KEN",
};

/** Famous national-team nicknames shown under the country name on team boards. */
const INTERNATIONAL_TEAM_NICKNAMES: Record<string, string> = {
  "new zealand": "All Blacks",
  "south africa": "Springboks",
  australia: "Wallabies",
  argentina: "Pumas",
  france: "Les Bleus",
  wales: "The Dragons",
  scotland: "The Thistles",
  italy: "Azzurri",
  fiji: "Flying Fijians",
  samoa: "Manu Samoa",
  "western samoa": "Manu Samoa",
  tonga: "Ikale Tahi",
  japan: "Brave Blossoms",
  georgia: "Lelos",
  romania: "The Oaks",
  canada: "Canucks",
  "united states": "Eagles",
  "united states of america": "Eagles",
  namibia: "Welwitschias",
  uruguay: "Los Teros",
  portugal: "Os Lobos",
  chile: "Los Cóndores",
  spain: "Los Leones",
  zimbabwe: "Sables",
  "ivory coast": "Les Éléphants",
  "cote divoire": "Les Éléphants",
  "cote d'ivoire": "Les Éléphants",
  "hong kong": "Dragons",
  russia: "Bears",
};

/** Display nickname under the team name (ALL BLACKS, SPRINGBOKS, …). */
export function nationalTeamNickname(
  teamName: string | null | undefined,
  shortName?: string | null,
): string | null {
  const name = teamName?.trim();
  if (!name) return null;
  const mapped = INTERNATIONAL_TEAM_NICKNAMES[name.toLowerCase()];
  if (mapped) {
    if (mapped.toLowerCase() === name.toLowerCase()) return null;
    return mapped.toUpperCase();
  }
  const short = shortName?.trim();
  if (short && short.length > 3 && short.toLowerCase() !== name.toLowerCase()) {
    return short.toUpperCase();
  }
  return null;
}

/** Domestic / franchise nicknames used on Currie Cup / URC-style boards. */
const CLUB_TEAM_CODES: Record<string, string> = {
  griquas: "GRI",
  "gwk griquas": "GRI",
  pumas: "PUM",
  "airlink pumas": "PUM",
  cheetahs: "CHE",
  "toyota cheetahs": "CHE",
  "free state cheetahs": "CHE",
  sharks: "SHA",
  "cell c sharks": "SHA",
  bulls: "BUL",
  "vodacom bulls": "BUL",
  lions: "LIO",
  "emirates lions": "LIO",
  stormers: "STO",
  "dhl stormers": "STO",
  "dhl stormers xxiii": "STO",
  "boland cavaliers": "BOL",
  boland: "BOL",
  "western province": "WP",
  "blue bulls": "BUL",
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

/** Accept only clean alphabetic short codes (reject wiki debris like "{{FS}}"). */
function cleanShortCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s || s.includes("{{") || s.includes("}}") || /<|\|/.test(s)) return null;
  // Keep leading letters only (drop digits / punctuation).
  s = s.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (s.length < 2 || s.length > 4) return null;
  if (s === "NEW") return null;
  return s;
}

function codeFromTeamName(teamName: string): string {
  const key = teamName.trim().toLowerCase();
  if (INTERNATIONAL_TEAM_CODES[key]) return INTERNATIONAL_TEAM_CODES[key]!;
  if (CLUB_TEAM_CODES[key]) return CLUB_TEAM_CODES[key]!;
  for (const [name, code] of Object.entries(CLUB_TEAM_CODES)) {
    if (key.includes(name)) return code;
  }
  const words = teamName
    .trim()
    .replace(/\b(xxiii|xxii|xxi|rfc|rugby|football|club|team)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .slice(0, 3)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase();
    if (initials.length >= 2) return initials.slice(0, 3);
  }
  return teamName.trim().replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "—";
}

export function isInternationalLeaderboardTeam(teamName: string | null | undefined): boolean {
  if (!teamName) return false;
  return Boolean(INTERNATIONAL_TEAM_CODES[teamName.trim().toLowerCase()]);
}

export function teamCodeForLeaderboard(input: {
  teamName: string;
  teamShortName?: string | null;
}): string {
  const key = input.teamName.trim().toLowerCase();
  if (INTERNATIONAL_TEAM_CODES[key]) return INTERNATIONAL_TEAM_CODES[key]!;
  if (CLUB_TEAM_CODES[key]) return CLUB_TEAM_CODES[key]!;

  const short = cleanShortCode(input.teamShortName);
  if (short && /^[A-Z]{2,4}$/.test(short)) return short;

  return codeFromTeamName(input.teamName);
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
