/**
 * Nation code helpers for World Rugby / Wikipedia {{ru|XXX}} templates.
 */
export const WIKI_RU_CODE_TO_NAME: Record<string, string> = {
  ARG: "Argentina",
  AUS: "Australia",
  CAN: "Canada",
  CHI: "Chile",
  CIV: "Ivory Coast",
  ENG: "England",
  FIJ: "Fiji",
  FRA: "France",
  GEO: "Georgia",
  IRE: "Ireland",
  ITA: "Italy",
  JPN: "Japan",
  NAM: "Namibia",
  NZL: "New Zealand",
  POR: "Portugal",
  ROM: "Romania",
  RUS: "Russia",
  SAM: "Samoa",
  SCO: "Scotland",
  ESP: "Spain",
  RSA: "South Africa",
  TON: "Tonga",
  USA: "United States",
  URU: "Uruguay",
  WAL: "Wales",
  ZIM: "Zimbabwe",
};

const ALIAS_CODES: Record<string, string> = {
  CHL: "CHI",
  IRL: "IRE",
  ROU: "ROM",
  ZAF: "RSA",
  WLS: "WAL",
  URY: "URU",
  TGA: "TON",
  EN: "ENG",
};

export function teamNameFromCode(code: string): string | null {
  const upper = code.trim().toUpperCase();
  const canonical = ALIAS_CODES[upper] ?? upper;
  return WIKI_RU_CODE_TO_NAME[canonical] ?? null;
}

export function teamCodeFromName(name: string): string | null {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ");
  for (const [code, n] of Object.entries(WIKI_RU_CODE_TO_NAME)) {
    if (n.toLowerCase() === key) return code;
  }
  // Common Wikipedia variants
  if (key === "usa" || key === "united states of america") return "USA";
  if (key === "ivory coast" || key === "côte d'ivoire" || key === "cote d'ivoire") return "CIV";
  return null;
}
