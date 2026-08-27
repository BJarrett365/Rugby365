import { stripTransferWikiMarkup } from "@rugby365/import-sdk";
import { canonicalPlayerDisplayName } from "./entity-normalize";
import { parsePlayerNameAndStatus } from "./player-career-status";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** Wikipedia section anchors and truncated import debris. */
function stripWikipediaAnchorDebris(value: string): string {
  let cleaned = decodeHtmlEntities(value);

  const spanTail = cleaned.match(/\bspan>\s*(.+)$/i);
  if (spanTail?.[1]) return spanTail[1].trim();

  const closeSpanTail = cleaned.match(/<\/span>\s*(.+)$/i);
  if (closeSpanTail?.[1]) return closeSpanTail[1].trim();

  cleaned = cleaned.replace(/<span\b[^>]*\bclass=["']?anchor["']?[^>]*>\s*/gi, "");
  cleaned = cleaned.replace(/<\/span>/gi, "");
  cleaned = cleaned.replace(/="anchor"\s+id="[^"]*"\s*>?/gi, "");
  cleaned = cleaned.replace(/\bclass=["']anchor["']\s+id=["'][^"']*["']\s*>?/gi, "");
  cleaned = cleaned.replace(/\bid=["'][^"']*["']\s*>\s*/gi, "");
  if (/anchor|class=|id=|</i.test(cleaned) && cleaned.includes(">")) {
    const afterTag = cleaned.slice(cleaned.lastIndexOf(">") + 1).trim();
    if (afterTag.length >= 2) cleaned = afterTag;
  }
  const duplicate = cleaned.match(/^(.+?)\1$/u);
  if (duplicate?.[1]) cleaned = duplicate[1].trim();
  return cleaned.trim();
}

function stripHtmlMarkup(value: string): string {
  return stripWikipediaAnchorDebris(value)
    .replace(/<[^>]*>/gi, "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

export function hasTransferClubDebris(value: string | null | undefined): boolean {
  if (!value) return false;
  return /(?:^|[^a-z])anchor\b|class=["']anchor|<\/?span|\bid=["']|="anchor"|\bspan>/i.test(value);
}

/** Strip Wikipedia/HTML debris and trailing deal notes from club names. */
export function sanitizeTransferClub(value: string | null | undefined): string | null {
  if (!value) return null;
  let cleaned = stripHtmlMarkup(value);
  cleaned = stripTransferWikiMarkup(cleaned);
  const clubOnly = cleaned
    .split(/\s*\|/)[0]
    ?.split(/<ref/i)[0]
    ?.replace(/\}\}<\/ref>.*$/i, "")
    ?.trim();
  cleaned = clubOnly || cleaned;
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/u, "").trim();
  cleaned = cleaned.replace(/^[→\-–—\s]+/u, "").trim();
  if (hasTransferClubDebris(cleaned)) {
    const tail = cleaned.match(/([A-Z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z'’.-]+)+)\s*$/u);
    if (tail?.[1]) cleaned = tail[1].trim();
  }
  return cleaned || null;
}

export function sanitizeTeamDisplayName(value: string | null | undefined): string | null {
  return sanitizeTransferClub(value);
}

/** Exclude Wikipedia import debris from admin team pickers. */
export function isJunkTeamPickerName(value: string | null | undefined): boolean {
  if (!value) return true;
  const raw = value.trim();
  if (!raw) return true;
  if (/^[\s→\-–—().]+$/u.test(raw)) return true;
  if (/^<[^>]+>/i.test(raw)) return true;
  if (/^\([^)]*\)$/u.test(raw)) return true;
  if (/^[A-Za-z]+\)$/u.test(raw)) return true;
  if (raw.includes("<") || raw.includes(">")) return true;
  if (hasTransferClubDebris(raw)) return true;

  const sanitized = sanitizeTransferClub(raw);
  if (!sanitized || sanitized.length < 2) return true;
  if (/^[\s→\-–—().]+$/u.test(sanitized)) return true;
  return false;
}

export function sanitizeTransferPlayerName(name: string): string {
  const { name: withoutStatus } = parsePlayerNameAndStatus(name);
  let cleaned = stripTransferWikiMarkup(withoutStatus);
  cleaned = cleaned.split(/<ref\b/i)[0]!.split("{{")[0]!.trim();
  const toSuffix = cleaned.match(/^(.+?)\s+to\s+.+$/i);
  if (toSuffix) cleaned = toSuffix[1]!.trim();
  const fromSuffix = cleaned.match(/^(.+?)\s+from\s+.+$/i);
  if (fromSuffix) cleaned = fromSuffix[1]!.trim();
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/u, "").trim();
  return canonicalPlayerDisplayName(cleaned);
}

export function sanitizeTransferPlayerNameWithStatus(name: string) {
  const parsed = parsePlayerNameAndStatus(name);
  return {
    name: sanitizeTransferPlayerName(parsed.name || name),
    statusHint: parsed.statusHint,
  };
}

function titleCaseClubSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** Recover destination/origin club from legacy dirty Wikipedia import keys. */
export function inferClubFromImportKey(
  importKey: string | null | undefined,
  direction: "from" | "to",
): string | null {
  if (!importKey) return null;
  const parts = importKey.split(":");
  const playerSlug = parts[3] ?? "";
  const marker = direction === "to" ? "-to-" : "-from-";
  const markerIndex = playerSlug.indexOf(marker);
  if (markerIndex === -1) return null;

  let clubSlug = playerSlug.slice(markerIndex + marker.length);
  clubSlug = clubSlug.replace(/^flagicon-[a-z]+(-rugby-union)?-/, "");
  clubSlug = clubSlug.split("-ref")[0]!.split("-url")[0]!.split("-cite")[0]!;
  clubSlug = clubSlug.replace(/^[a-z]{2,3}-rugby-union-/, "");
  clubSlug = clubSlug.replace(/^[a-z]{2,3}-/, "");
  if (!clubSlug || clubSlug === "bath" || clubSlug === "none") return null;

  const known: Record<string, string> = {
    "bristol-bears": "Bristol Bears",
    "glasgow-warriors": "Glasgow Warriors",
    "sale-sharks": "Sale Sharks",
    "newcastle-red-bulls": "Newcastle Red Bulls",
    "leicester-tigers": "Leicester Tigers",
    "exeter-chiefs": "Exeter Chiefs",
    connacht: "Connacht",
    scarlets: "Scarlets",
    sharks: "Sharks",
    bayonne: "Bayonne",
  };
  return known[clubSlug] ?? titleCaseClubSlug(clubSlug);
}

function importKeySlugLooksDirty(slug: string | null | undefined): boolean {
  if (!slug) return true;
  return (
    slug === "none" ||
    slug.includes("span") ||
    slug.includes("anchor") ||
    slug.includes("class") ||
    slug.includes("ref")
  );
}

function clubNameFromImportSlug(slug: string): string {
  const known: Record<string, string> = {
    "worcester-warriors": "Worcester Warriors",
    "bristol-bears": "Bristol Bears",
    "glasgow-warriors": "Glasgow Warriors",
    "sale-sharks": "Sale Sharks",
    "newcastle-red-bulls": "Newcastle Red Bulls",
    "leicester-tigers": "Leicester Tigers",
    "exeter-chiefs": "Exeter Chiefs",
    "northampton-saints": "Northampton Saints",
    "london-irish": "London Irish",
    edinburgh: "Edinburgh",
    bath: "Bath",
    saracens: "Saracens",
    harlequins: "Harlequins",
    gloucester: "Gloucester",
    wasps: "Wasps",
    connacht: "Connacht",
    scarlets: "Scarlets",
    sharks: "Sharks",
    bayonne: "Bayonne",
  };
  return known[slug] ?? titleCaseClubSlug(slug);
}

/** Recover club names from structured Wikipedia import keys (season:club:in|out:...). */
export function inferClubFromStructuredImportKey(
  importKey: string | null | undefined,
  side: "from" | "to",
): string | null {
  if (!importKey) return null;
  const parts = importKey.split(":");
  if (parts.length < 6) return null;

  const listDirection = parts[2];
  const premiershipSlug = parts[1]?.toLowerCase();
  if (side === "to" && listDirection === "in" && premiershipSlug && !importKeySlugLooksDirty(premiershipSlug)) {
    return clubNameFromImportSlug(premiershipSlug);
  }
  if (side === "from" && listDirection === "out" && premiershipSlug && !importKeySlugLooksDirty(premiershipSlug)) {
    return clubNameFromImportSlug(premiershipSlug);
  }

  const idx = side === "from" ? 4 : 5;
  const slug = parts[idx]?.toLowerCase();
  if (importKeySlugLooksDirty(slug)) return null;
  return clubNameFromImportSlug(slug!);
}

export function resolveTransferClubLabel(input: {
  teamName: string | null | undefined;
  clubName: string | null | undefined;
  importKey: string | null | undefined;
  direction: "from" | "to";
  premiershipClub?: string | null;
}): string | null {
  let sanitized = transferClubLabel(input.teamName, input.clubName);
  if (
    sanitized &&
    !hasTransferClubDebris(sanitized) &&
    !isJunkTeamPickerName(sanitized) &&
    !sanitized.includes("|url=") &&
    !sanitized.includes("{{")
  ) {
    return sanitized;
  }

  const structured = inferClubFromStructuredImportKey(input.importKey, input.direction);
  if (structured) return structured;

  const inferred = inferClubFromImportKey(input.importKey, input.direction);
  if (inferred) return inferred;

  sanitized = sanitizeTransferClub(sanitized);
  if (sanitized && !isJunkTeamPickerName(sanitized)) return sanitized;
  return null;
}

export function transferClubLabel(
  teamName: string | null | undefined,
  clubName: string | null | undefined,
): string | null {
  const team = sanitizeTransferClub(teamName);
  // Prefer human club text over sync-repair stub team rows.
  if (team && !/^unknown team\b/i.test(team) && !/^orphan-/i.test(team)) return team;
  return sanitizeTransferClub(clubName) ?? team;
}
