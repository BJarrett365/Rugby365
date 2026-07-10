import type { TransferMovementType } from "./transfer-types";

export type ParsedPremiershipTransfer = {
  playerName: string;
  positionName: string | null;
  fromClub: string | null;
  toClub: string | null;
  premiershipClub: string;
  direction: "in" | "out";
  movementType: TransferMovementType;
  notes: string | null;
  transferDate: string | null;
  importKey: string;
};

export type ParsedPremiershipClubTransfers = {
  clubName: string;
  playersIn: ParsedPremiershipTransfer[];
  playersOut: ParsedPremiershipTransfer[];
};

export type ParsedPremiershipTransferDocument = {
  seasonLabel: string;
  sourceTitle: string;
  clubs: ParsedPremiershipClubTransfers[];
};

const CLUB_HEADING = /^##\s+(.+)$/;
const PLAYERS_IN = /^###\s+Players in$/i;
const PLAYERS_OUT = /^###\s+Players out$/i;
const LIST_ITEM = /^-\s+(.+)$/;

function slugifyImportPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TRANSFER_DATE_SUFFIX = /^\((\d{1,2}\/\d{1,2}\/\d{4})\)$/i;

function stripTrailingTransferDate(raw: string): { body: string; transferDate: string | null } {
  const match = raw.match(/^(.+?)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\)\s*$/);
  if (!match) return { body: raw.trim(), transferDate: null };
  return { body: match[1]!.trim(), transferDate: match[2]! };
}

function parseMovementSuffix(raw: string): {
  playerName: string;
  movementType: TransferMovementType;
  notes: string | null;
} {
  const parenMatch = raw.match(/^(.+?)\((.+)\)$/);
  if (!parenMatch) {
    return { playerName: raw.trim(), movementType: "permanent", notes: null };
  }

  const playerName = parenMatch[1]!.trim();
  const suffix = parenMatch[2]!.trim();
  const suffixLower = suffix.toLowerCase();

  if (TRANSFER_DATE_SUFFIX.test(`(${suffix})`)) {
    return { playerName, movementType: "permanent", notes: null };
  }
  if (suffixLower === "released") {
    return { playerName, movementType: "released", notes: "Released" };
  }
  if (suffixLower === "retired") {
    return { playerName, movementType: "retirement", notes: "Retired" };
  }
  if (suffixLower.includes("promoted from academy")) {
    return { playerName, movementType: "academy_promotion", notes: suffix };
  }
  if (suffixLower.includes("loan")) {
    return { playerName, movementType: "loan", notes: suffix };
  }
  if (suffixLower.includes("contract extension") || suffixLower.includes("contract renewed")) {
    return { playerName, movementType: "contract_extension", notes: suffix };
  }

  return { playerName, movementType: "unknown", notes: suffix };
}

function parseTransferLine(
  line: string,
  premiershipClub: string,
  direction: "in" | "out",
  seasonLabel: string,
): ParsedPremiershipTransfer | null {
  const listMatch = line.match(LIST_ITEM);
  if (!listMatch) return null;

  const rawBody = decodeWikiEntities(listMatch[1]!.trim());
  const { body: withoutDate, transferDate } = stripTrailingTransferDate(rawBody);
  const body = stripWikiMarkup(withoutDate);
  const suffixParsed = parseMovementSuffix(body);
  const routeBody =
    suffixParsed.notes !== null && suffixParsed.movementType !== "unknown"
      ? suffixParsed.playerName
      : body;

  const fromMatch = routeBody.match(/^(.+?)\s+from\s+(.+)$/i);
  const toMatch = routeBody.match(/^(.+?)\s+to\s+(.+)$/i);

  let playerName = routeBody;
  let fromClub: string | null = null;
  let toClub: string | null = null;
  let movementType: TransferMovementType = suffixParsed.movementType;
  let notes: string | null = suffixParsed.notes;

  if (fromMatch) {
    playerName = fromMatch[1]!.trim();
    fromClub = fromMatch[2]!.trim();
    toClub = premiershipClub;
  } else if (toMatch) {
    playerName = toMatch[1]!.trim();
    fromClub = premiershipClub;
    toClub = toMatch[2]!.trim();
  } else {
    playerName = suffixParsed.playerName;
    fromClub = direction === "out" ? premiershipClub : null;
    toClub = direction === "in" ? premiershipClub : null;
  }

  if (!playerName) return null;

  playerName = cleanName(playerName);
  fromClub = cleanClub(fromClub);
  toClub = cleanClub(toClub);
  if (!playerName) return null;

  const importKey = [
    slugifyImportPart(seasonLabel),
    slugifyImportPart(premiershipClub),
    direction,
    slugifyImportPart(playerName),
    slugifyImportPart(fromClub ?? "none"),
    slugifyImportPart(toClub ?? "none"),
    movementType,
  ].join(":");

  return {
    playerName,
    positionName: null,
    fromClub,
    toClub,
    premiershipClub,
    direction,
    movementType,
    notes,
    transferDate,
    importKey,
  };
}

export function parsePremiershipTransferDocument(
  markdown: string,
  options?: { seasonLabel?: string; sourceTitle?: string },
): ParsedPremiershipTransferDocument {
  const seasonLabel = options?.seasonLabel ?? "2025–26";
  const sourceTitle = options?.sourceTitle ?? "Premiership Rugby transfers";
  const lines = markdown.split(/\r?\n/);

  const clubs: ParsedPremiershipClubTransfers[] = [];
  let currentClub: ParsedPremiershipClubTransfers | null = null;
  let section: "in" | "out" | null = null;
  const seenKeys = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const clubMatch = line.match(CLUB_HEADING);
    if (clubMatch) {
      currentClub = { clubName: cleanName(clubMatch[1]!.trim()), playersIn: [], playersOut: [] };
      clubs.push(currentClub);
      section = null;
      continue;
    }

    if (!currentClub) continue;

    if (PLAYERS_IN.test(line)) {
      section = "in";
      continue;
    }
    if (PLAYERS_OUT.test(line)) {
      section = "out";
      continue;
    }

    if (!section || !line.startsWith("-")) continue;

    const parsed = parseTransferLine(line, currentClub.clubName, section, seasonLabel);
    if (!parsed || seenKeys.has(parsed.importKey)) continue;
    seenKeys.add(parsed.importKey);

    if (section === "in") currentClub.playersIn.push(parsed);
    else currentClub.playersOut.push(parsed);
  }

  return { seasonLabel, sourceTitle, clubs };
}

export function flattenPremiershipTransfers(
  document: ParsedPremiershipTransferDocument,
): ParsedPremiershipTransfer[] {
  return document.clubs.flatMap((club) => [...club.playersIn, ...club.playersOut]);
}

function decodeWikiEntities(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function stripRefTags(value: string): string {
  return value
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[\s\S]*$/gi, "");
}

function removeWikiTemplates(value: string): string {
  let result = value;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(/\{\{[^{}]*\}\}/g, "");
  }
  return result.replace(/\{\{[\s\S]*$/g, "");
}

function stripWikiMarkup(value: string): string {
  let text = decodeWikiEntities(value);
  text = stripRefTags(text);
  text = removeWikiTemplates(text);
  return text
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/''+/g, "")
    .replace(/\s*·\s*(Permanent|Loan|Released|Retired)\s*/gi, " ")
    .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(value: string): string {
  return stripWikiMarkup(value);
}

function cleanClub(value: string | null): string | null {
  if (!value) return null;
  let cleaned = value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");

  const spanTail = cleaned.match(/\bspan>\s*(.+)$/i);
  if (spanTail?.[1]) cleaned = spanTail[1].trim();
  else {
    const closeSpanTail = cleaned.match(/<\/span>\s*(.+)$/i);
    if (closeSpanTail?.[1]) cleaned = closeSpanTail[1].trim();
    else {
      cleaned = cleaned.replace(/<span\b[^>]*\bclass=["']?anchor["']?[^>]*>\s*/gi, "");
      cleaned = cleaned.replace(/<\/span>/gi, "");
      cleaned = cleaned.replace(/="anchor"\s+id="[^"]*"\s*>?/gi, "");
      cleaned = cleaned.replace(/\bclass=["']anchor["']\s+id=["'][^"']*["']\s*>?/gi, "");
      cleaned = cleaned.replace(/\bid=["'][^"']*["']\s*>\s*/gi, "");
    }
  }

  cleaned = cleaned.replace(/<[^>]*>/gi, "").trim();
  cleaned = stripWikiMarkup(cleaned).replace(/\s*\([^)]*\)\s*$/u, "").trim();
  return cleaned || null;
}

/** Normalize Wikipedia wikitext list pages into markdown-like lines for parsing. */
export function normalizePremiershipTransferWikitext(wikitext: string): string {
  const lines = wikitext.split(/\r?\n/);
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const h2 = line.match(/^==+\s*(.+?)\s*==+$/);
    if (h2 && !line.startsWith("===")) {
      out.push(`## ${stripWikiMarkup(h2[1]!)}`);
      continue;
    }

    const h3 = line.match(/^===+\s*(.+?)\s*===+$/);
    if (h3) {
      out.push(`### ${stripWikiMarkup(h3[1]!)}`);
      continue;
    }

    if (line.startsWith("*") || line.startsWith(";")) {
      let body = decodeWikiEntities(line.replace(/^[*;]\s*/, ""));
      body = stripRefTags(body);
      const { body: withoutDate, transferDate } = stripTrailingTransferDate(body);
      body = stripWikiMarkup(withoutDate);
      if (body) out.push(`- ${body}${transferDate ? ` (${transferDate})` : ""}`);
    }
  }

  return out.join("\n");
}

export { stripWikiMarkup as stripTransferWikiMarkup };

export function parsePremiershipTransferWikitext(
  wikitext: string,
  options?: { seasonLabel?: string; sourceTitle?: string },
): ParsedPremiershipTransferDocument {
  return parsePremiershipTransferDocument(normalizePremiershipTransferWikitext(wikitext), options);
}
