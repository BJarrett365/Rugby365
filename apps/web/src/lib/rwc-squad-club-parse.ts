/**
 * Parse Wikipedia "{year} Rugby World Cup squads" wikitext into player → club rows.
 * Older tournaments use {{nat rs player}}; later ones use wikitables with a Club column.
 */
import {
  extractTemplateBlocks,
  parseTemplateParams,
  parseWikiTeamLabel,
  ruCodeToCountryName,
  stripWikiMarkup,
} from "@rugby365/import-sdk";
import { isInternationalLeaderboardTeam } from "./competition-player-stat-display";
import { canonicalStandingsTeamName } from "./table-lab/standings-fixture-dedupe";
import { cleanRankingClubName, foldRankingClubKey } from "./player-ranking-engine";

export type RwcSquadClubRow = {
  playerName: string;
  clubName: string;
  countryName: string | null;
};

function parseSortName(raw: string): string {
  const sort = raw.match(/\{\{\s*sortname\s*\|([^|}]+)\|([^|}]+)/i);
  if (sort) return `${sort[1]!.trim()} ${sort[2]!.trim()}`.replace(/\s+/g, " ").trim();
  return stripWikiMarkup(raw)
    .replace(/\s*\((?:c|captain)\)\s*$/i, "")
    .replace(/\s*\d+\s*$/, "")
    .trim();
}

export function rwcCountryFromHeading(raw: string): string | null {
  const label = parseWikiTeamLabel(raw)
    .replace(/\s+national rugby union team$/i, "")
    .replace(/\s+rugby union team$/i, "")
    .trim();
  if (!label) return null;
  if (/^pool\s+[a-d]$/i.test(label)) return null;
  if (/squad|note|see also|references|external|coaches?|staff/i.test(label)) return null;
  const folded = foldRankingClubKey(label);
  const fromCode = ruCodeToCountryName(folded) ?? ruCodeToCountryName(label);
  const candidate = fromCode ?? canonicalStandingsTeamName(label);
  if (!isInternationalLeaderboardTeam(candidate) && !isInternationalLeaderboardTeam(folded)) {
    return null;
  }
  return canonicalStandingsTeamName(candidate);
}

/** Prefer the professional / franchise side when Wikipedia lists "Hurricanes / Wellington". */
export function firstClubFromWikiValue(raw: string): string | null {
  if (!raw?.trim()) return null;
  if (/\{\{\s*n?rut\s*\|/i.test(raw)) {
    return cleanRankingClubName(parseWikiTeamLabel(raw));
  }
  const firstLink = raw.match(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/);
  if (firstLink) {
    const page = firstLink[1]!.replace(/_/g, " ").trim();
    const label = (firstLink[2] ?? page).trim();
    if (/rugby football union|old boys/i.test(page) && label.length >= 3) {
      return cleanRankingClubName(stripWikiMarkup(label));
    }
    const pageCore = page.replace(/\s*\([^)]+\)\s*$/, "").trim();
    const chosen = [pageCore, label].sort((a, b) => b.length - a.length)[0] ?? pageCore;
    return cleanRankingClubName(stripWikiMarkup(chosen));
  }
  const fromTemplate = parseWikiTeamLabel(raw);
  if (fromTemplate) return cleanRankingClubName(fromTemplate);
  const first = raw.split(/\s*\/\s*/)[0] ?? raw;
  return cleanRankingClubName(stripWikiMarkup(first));
}

function countryHeadings(wikitext: string): Array<{ index: number; country: string }> {
  const headings: Array<{ index: number; country: string }> = [];
  const re = /^(={2,4})\s*(.+?)\s*\1\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(wikitext))) {
    const country = rwcCountryFromHeading(match[2] ?? "");
    if (!country) continue;
    headings.push({ index: match.index, country });
  }
  return headings;
}

function countryAt(index: number, headings: Array<{ index: number; country: string }>): string | null {
  let current: string | null = null;
  for (const heading of headings) {
    if (heading.index > index) break;
    current = heading.country;
  }
  return current;
}

function parseNatRsPlayerRows(
  wikitext: string,
  headings: Array<{ index: number; country: string }>,
): RwcSquadClubRow[] {
  const rows: RwcSquadClubRow[] = [];
  const lower = wikitext.toLowerCase();
  for (const block of extractTemplateBlocks(wikitext, "nat rs player")) {
    const params = parseTemplateParams(block);
    const playerName = parseSortName(params.name ?? params.player ?? "");
    const clubName = firstClubFromWikiValue(params.club ?? params.clubname ?? "");
    if (!playerName || playerName.length < 3 || !clubName) continue;
    const index = lower.indexOf(block.slice(0, 40).toLowerCase());
    rows.push({
      playerName,
      clubName,
      countryName: countryAt(index < 0 ? 0 : index, headings),
    });
  }
  return rows;
}

function splitWikitables(wikitext: string): Array<{ table: string; index: number }> {
  const tables: Array<{ table: string; index: number }> = [];
  let searchFrom = 0;
  while (true) {
    const start = wikitext.indexOf("{|", searchFrom);
    if (start < 0) break;
    const end = wikitext.indexOf("|}", start);
    if (end < 0) break;
    tables.push({ table: wikitext.slice(start, end + 2), index: start });
    searchFrom = end + 2;
  }
  return tables;
}

function parseWikitableSquads(
  wikitext: string,
  headings: Array<{ index: number; country: string }>,
): RwcSquadClubRow[] {
  const rows: RwcSquadClubRow[] = [];
  for (const { table, index } of splitWikitables(wikitext)) {
    const headerMatch = table.match(/![^\n]+/);
    if (!headerMatch) continue;
    const header = headerMatch[0]!.toLowerCase();
    if (!/player/.test(header)) continue;
    if (!/club|franchise|province|team/.test(header)) continue;
    const headerCells = header
      .replace(/^!/, "")
      .split(/!!|\|\|/)
      .map((c) => stripWikiMarkup(c).toLowerCase());
    const clubIdx = headerCells.findIndex((c) => /club|franchise|province/.test(c));
    const playerIdx = headerCells.findIndex((c) => c.includes("player"));
    if (clubIdx < 0 || playerIdx < 0) continue;
    const countryName = countryAt(index, headings);

    for (const chunk of table.split(/\n\|-/).slice(1)) {
      const line = chunk
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("|") || l.startsWith("!"))
        .join(" || ");
      const cells = line
        .replace(/^[|!]+/, "")
        .split(/\s*\|\|\s*/)
        .map((c) => c.trim());
      if (cells.length <= Math.max(playerIdx, clubIdx)) continue;
      const playerName = parseSortName(cells[playerIdx] ?? "");
      const clubName = firstClubFromWikiValue(cells[clubIdx] ?? "");
      if (!playerName || playerName.length < 3 || !clubName) continue;
      rows.push({ playerName, clubName, countryName });
    }
  }
  return rows;
}

export function parseRwcSquadClubs(wikitext: string): RwcSquadClubRow[] {
  const headings = countryHeadings(wikitext);
  const fromTemplates = parseNatRsPlayerRows(wikitext, headings);
  const fromTables = parseWikitableSquads(wikitext, headings);
  const seen = new Set<string>();
  const rows: RwcSquadClubRow[] = [];
  for (const row of [...fromTemplates, ...fromTables]) {
    const key = row.playerName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}
