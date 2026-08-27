import { normalizeProviderPlayerName } from "./match-entity-context";

/** Wikipedia transfer notes often leak into player names. */
const PLAYER_STATUS_SUFFIX =
  /\s+(released|retired|left|departed|joined|signed|loaned|on\s+loan|deceased|died)$/i;

export function normalizePlayerName(name: string): string {
  return normalizeProviderPlayerName(name)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(PLAYER_STATUS_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Roster / feed placeholders that must never appear on leaderboards. */
export function isJunkPlayerName(name: string | null | undefined): boolean {
  const trimmed = normalizePlayerName(name ?? "");
  if (!trimmed) return true;
  if (/^[-–—._]+$/.test(trimmed)) return true;
  if (/^(n\/?a|none|unknown|tbc|tba|tb[da]|null|undefined)$/i.test(trimmed)) return true;
  if (/to\s*be\s*announced/i.test(trimmed)) return true;
  if (/^(player|name)\s*(tbd|tba|unknown)?$/i.test(trimmed)) return true;
  if (/^(replacement|reserve)\s*\d*$/i.test(trimmed)) return true;
  return false;
}

/** Common club sponsors that should not create duplicate team identities. */
const TEAM_SPONSOR_PREFIX =
  /^(dhl|vodacom|suzuki|toyota|hyundai|emirates|cell\s*c|mtn|sasol|investec|hollywood|fidelity|hollywood\s*card)\s+/i;

/** Trailing season / squad roman numerals (e.g. Stormers XXIII). */
const TEAM_ROMAN_SUFFIX = /\s+(x{0,3})(ix|iv|v?i{0,3})$/i;

export function normalizeTeamName(name: string): string {
  return name
    .replace(/^→+\s*/u, "")
    .replace(/^bt\s+/i, "")
    // Wikipedia image-size crumbs: "23px British & Irish Lions" / "... Lions 23px"
    .replace(/^\d+px\b[\s-]*/i, "")
    .replace(/[\s-]*\b\d+px\b$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip leading sponsors and trailing Roman squad labels for matching. */
export function stripTeamSponsorAndSeasonLabels(name: string): string {
  let next = normalizeTeamName(name);
  // Repeat sponsor strip for stacked prefixes.
  for (let i = 0; i < 3; i++) {
    const stripped = next.replace(TEAM_SPONSOR_PREFIX, "").trim();
    if (stripped === next) break;
    next = stripped;
  }
  next = next.replace(TEAM_ROMAN_SUFFIX, "").trim();
  return next;
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

/** Wikipedia / SDMS import debris in team slugs (flagicon templates + cite refs). */
export function isJunkTeamSlug(slug: string): boolean {
  return (
    slug.startsWith("flagicon-") ||
    slug.includes("ref-cite") ||
    slug.includes("ref-name") ||
    slug.includes("url-https") ||
    slug.includes("access-date") ||
    slug.length > 60
  );
}

/** Pure numbers / table ranks / wiki debris that parsers sometimes treat as team names. */
export function isJunkTeamName(name: string): boolean {
  const trimmed = name.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (/^#?\d{1,3}$/.test(trimmed)) return true;
  if (/bonus\s+point\s+system/i.test(trimmed)) return true;
  if (/^source\s*:/i.test(trimmed)) return true;
  if (/^under\s+the\b/i.test(trimmed)) return true;
  if (/^(seed|rank|pool|pos(?:ition)?|p|w|d|l|pf|pa|pd|bp|pts?)$/i.test(trimmed)) return true;
  if (/^\{\{/.test(trimmed) || /\}\}/.test(trimmed)) return true;
  if (/football kit/i.test(trimmed)) return true;
  if (/smalldiv/i.test(trimmed)) return true;
  if (/^ru\s+sf\b/i.test(trimmed)) return true;
  if (/\bcolspan\s*=/i.test(trimmed) || /\bcellpadding\s*=/i.test(trimmed) || /\bborder\s*:\s*0px\b/i.test(trimmed)) {
    return true;
  }
  if (/^\d+px\b/i.test(trimmed) && trimmed.replace(/^\d+px\b[\s-]*/i, "").trim().length < 2) return true;
  if (/^short[-\s]?term( deal| loan)?$/i.test(trimmed)) return true;
  if (/^["']?short[-\s]?term/i.test(trimmed) && trimmed.length < 40) return true;
  if (/\(short[-\s]?term( deal)?\)/i.test(trimmed) && trimmed.replace(/\(short[-\s]?term( deal)?\)/gi, "").trim().length < 2) {
    return true;
  }
  return false;
}

/** Extract club label from corrupted flagicon-* slugs for duplicate matching. */
export function clubNameFromJunkSlug(slug: string): string | null {
  const match = slug.match(/^flagicon-[a-z]+-([a-z0-9]+(?:-[a-z0-9]+)*?)-ref(?:-|$)/i);
  if (!match) return null;
  return match[1]!.replace(/-/g, " ").trim();
}

/** Alternate base names that should dedupe together (senior sides only). */
const TEAM_DEDUP_BASE_ALIASES: Record<string, string> = {
  "mpumalanga pumas": "pumas",
  "t=mpumalanga pumas": "mpumalanga pumas",
  // SA franchise ↔ Currie Cup union / historic names (same senior club identity)
  "blue bulls": "bulls",
  "northern bulls": "bulls",
  "golden lions": "lions",
  "gauteng lions": "lions",
  "natal sharks": "sharks",
  "coastal sharks": "sharks",
  "free state cheetahs": "cheetahs",
  "western stormers": "stormers",
  "clermont auvergne": "clermont",
  "asm clermont": "clermont",
  "asm clermont auvergne": "clermont",
  // British & Irish Lions historic / wiki variants
  "british lions": "british irish lions",
  "british and irish lions": "british irish lions",
  "british & irish lions": "british irish lions",
};

/**
 * International nicknames that should collapse onto the country label for team dedupe.
 * Bare "pumas" stays the SA club; Argentina is matched via "los pumas" / country name.
 */
const TEAM_DEDUP_NICKNAME_ALIASES: Record<string, string> = {
  "all blacks": "new zealand",
  "new zealand (all blacks)": "new zealand",
  springboks: "south africa",
  "south africa springboks": "south africa",
  wallabies: "australia",
  "los pumas": "argentina",
};

/** Base club/country label with age/gender tier markers removed for duplicate matching. */
export function teamDedupBaseName(name: string): string {
  let normalized = stripTeamSponsorAndSeasonLabels(name);
  normalized = normalized.replace(/^t=/i, "").trim();
  normalized = normalized
    .replace(/\s*\[\d+\]\s*$/g, "") // Wikipedia cite leftovers: "Clermont [2]"
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/[|_]/g, " ")
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
    .trim()
    .toLowerCase();
  if (TEAM_DEDUP_NICKNAME_ALIASES[normalized]) return TEAM_DEDUP_NICKNAME_ALIASES[normalized]!;
  if (/\bzaf\b/.test(normalized)) return "south africa";
  return TEAM_DEDUP_BASE_ALIASES[normalized] ?? normalized;
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
  "james butch": "Butch James",
  "butch james": "Butch James",
  "jager de lood": "Lood de Jager",
  "lood de jager": "Lood de Jager",
};

const LIKELY_FIRST_NAMES = new Set([
  "adriaan",
  "andre",
  "austin",
  "ben",
  "bongi",
  "butch",
  "chris",
  "cobus",
  "damian",
  "dan",
  "eben",
  "ewan",
  "franco",
  "francois",
  "finn",
  "guy",
  "handre",
  "herschel",
  "jack",
  "jaco",
  "jacques",
  "james",
  "jan",
  "jannie",
  "jasper",
  "jesse",
  "joe",
  "johan",
  "john",
  "josh",
  "kwagga",
  "lood",
  "louie",
  "malcolm",
  "manie",
  "marco",
  "max",
  "miles",
  "neil",
  "ollie",
  "ox",
  "pieter",
  "rassie",
  "rg",
  "ruan",
  "sacha",
  "sam",
  "schalk",
  "scott",
  "siya",
  "steven",
  "ted",
  "tom",
  "tyler",
  "will",
  "wilco",
  "winters",
  "zane",
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
