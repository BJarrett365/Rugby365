import { normalizeProviderPlayerName } from "./match-entity-context";

export function normalizePlayerName(name: string): string {
  return normalizeProviderPlayerName(name);
}

export function normalizeTeamName(name: string): string {
  return name
    .replace(/^→+\s*/u, "")
    .replace(/^bt\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type TeamDedupTier =
  | "senior"
  | "women"
  | "u16"
  | "u18"
  | "u20"
  | "u21"
  | "u19"
  | "xv"
  | "a"
  | "saxons"
  | "students"
  | "counties"
  | "academy"
  | "loan"
  | "staff"
  | "other";

const TEAM_TIER_RULES: Array<{ tier: TeamDedupTier; patterns: RegExp[] }> = [
  { tier: "women", patterns: [/\bwomen\b/i, /\bwomens\b/i, /\bred roses\b/i, /\bfemale\b/i] },
  { tier: "counties", patterns: [/\bcounties\b/i] },
  { tier: "students", patterns: [/\bstudents\b/i] },
  { tier: "saxons", patterns: [/\bsaxons\b/i] },
  { tier: "u16", patterns: [/\bu-?16s?\b/i, /\bunder[\s-]?16s?\b/i] },
  { tier: "u18", patterns: [/\bu-?18s?\b/i, /\bunder[\s-]?18s?\b/i] },
  { tier: "u20", patterns: [/\bu-?20s?\b/i, /\bunder[\s-]?20s?\b/i] },
  { tier: "u21", patterns: [/\bu-?21s?\b/i, /\bunder[\s-]?21s?\b/i] },
  { tier: "u19", patterns: [/\bu-?19s?\b/i, /\bunder[\s-]?19s?\b/i] },
  { tier: "xv", patterns: [/\bxv\b/i] },
  { tier: "a", patterns: [/'a'/i, /\ba team\b/i] },
  { tier: "academy", patterns: [/\bacademy\b/i] },
  { tier: "loan", patterns: [/\bloan\b/i] },
  { tier: "staff", patterns: [/\(asst\.\)/i, /\basst\b/i, /\bforwards\)\s*$/i] },
];

export function teamDedupTier(name: string): TeamDedupTier {
  const normalized = normalizeTeamName(name).toLowerCase();
  for (const rule of TEAM_TIER_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) return rule.tier;
  }
  return "senior";
}

/** Base club/country label with age/gender tier markers removed for duplicate matching. */
export function teamDedupBaseName(name: string): string {
  let normalized = normalizeTeamName(name);
  normalized = normalized
    .replace(/\s*\(asst\.\)/gi, "")
    .replace(/\s*\(loan\)/gi, "")
    .replace(/\s*\(forwards\)/gi, "")
    .replace(/\s+women'?s?/gi, "")
    .replace(/\s+red roses/gi, "")
    .replace(/\s+u-?\d+s?/gi, "")
    .replace(/\s+under[\s-]?\d+s?/gi, "")
    .replace(/\s+xv\b/gi, "")
    .replace(/\s+'a'/gi, "")
    .replace(/\s+saxons/gi, "")
    .replace(/\s+students/gi, "")
    .replace(/\s+counties/gi, "")
    .replace(/\s+rugby\b/gi, "")
    .replace(/[),]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.toLowerCase();
}

/** Duplicate teams must share base name and tier — Women/U18/U20 never merge with senior sides. */
export function teamDedupKey(name: string): string {
  return `${teamDedupBaseName(name)}|${teamDedupTier(name)}`;
}

export function normalizedEntityKey(name: string, kind: "team" | "player"): string {
  if (kind === "team") return teamDedupKey(name);
  const normalized = normalizePlayerName(name);
  return normalized.toLowerCase();
}

export function isSdmsExternalId(id: string | null | undefined): boolean {
  return Boolean(id && /^\d+-/.test(id));
}

export function entityNameQualityScore(name: string): number {
  let score = 0;
  if (!/\s{2,}/.test(name)) score += 2;
  if (!/^→/.test(name)) score += 2;
  if (name.trim() === name) score += 1;
  return score;
}

/** Known SDMS / import name corrections (normalized key → display name). */
export const PLAYER_DISPLAY_NAME_FIXES: Record<string, string> = {
  "cowan tom": "Thompson Cowan",
  "emens austin": "Austin Emens",
  "harris sam": "Sam Harris",
  "spandler jasper": "Jasper Spandler",
  "santiago carreras": "Santi Carreras",
  "william stuart": "Will Stuart",
  "richards ewan": "Ewan Richards",
  "macginty aj": "AJ MacGinty",
  "boyle-tiatia manaaki": "Manaaki Boyle-Tiatia",
  "joseph owen": "Joe Owen",
  "le roux neil": "Neil le Roux",
  "tom carr smith": "Tom Carr-Smith",
  "louie hennessey-booth": "Louie Hennessey",
  "francois van wyk": "Francois van Wyk",
};

const LIKELY_FIRST_NAMES = new Set([
  "austin",
  "ben",
  "chris",
  "dan",
  "ewan",
  "finn",
  "guy",
  "jack",
  "james",
  "jasper",
  "joe",
  "john",
  "josh",
  "louie",
  "max",
  "miles",
  "neil",
  "ollie",
  "sam",
  "scott",
  "ted",
  "tom",
  "tyler",
  "will",
  "winters",
]);

function titleCaseWord(word: string): string {
  if (!word) return word;
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => titleCaseWord(part))
      .join("-");
  }
  if (word.toLowerCase() === "van" || word.toLowerCase() === "de" || word.toLowerCase() === "du") {
    return word.toLowerCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCaseName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => titleCaseWord(word))
    .join(" ");
}

/** Fix reversed two-word SDMS names like "Cowan Tom" → "Tom Cowan" when obvious. */
export function fixReversedTwoWordPlayerName(name: string): string {
  const normalized = normalizePlayerName(name);
  const parts = normalized.split(" ");
  if (parts.length !== 2) return normalized;
  const [first, second] = parts;
  const secondLower = second.toLowerCase();
  const firstLower = first.toLowerCase();
  if (
    LIKELY_FIRST_NAMES.has(secondLower) &&
    !LIKELY_FIRST_NAMES.has(firstLower) &&
    secondLower !== firstLower
  ) {
    return titleCaseName(`${second} ${first}`);
  }
  return normalized;
}

export function canonicalPlayerDisplayName(name: string): string {
  const normalized = normalizePlayerName(name);
  const key = normalized.toLowerCase();
  const explicit = PLAYER_DISPLAY_NAME_FIXES[key];
  if (explicit) return explicit;
  return fixReversedTwoWordPlayerName(normalized);
}
