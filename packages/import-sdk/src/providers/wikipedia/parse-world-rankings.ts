import type { WorldRugbyRankingCategory } from "../world-rugby/rankings-types";
import { teamCodeFromName } from "./world-rankings-nation-codes";
import type {
  WikipediaLeaderSpan,
  WikipediaPointsMilestone,
  WikipediaRankMilestone,
  WikipediaWorldRankingEntry,
  WikipediaWorldRankingsParseResult,
} from "./world-rankings-types";

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWikiDate(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\[.*?\]/g, "")
    .replace(/present/i, "")
    .trim();
  if (!cleaned) return null;

  const m = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${day}`;
}

function parseOptionalInt(raw: string): number | null {
  const n = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parsePoints(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseChange(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "—" || t === "-" || t === "–") return null;
  const up = t.match(/▲\s*(\d+)/);
  if (up) return Number.parseInt(up[1], 10);
  const down = t.match(/▼\s*(\d+)/);
  if (down) return -Number.parseInt(down[1], 10);
  const signed = t.match(/^([+-]?\d+)$/);
  if (signed) return Number.parseInt(signed[1], 10);
  return null;
}

function extractTables(html: string): string[] {
  return html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/gi) ?? [];
}

function extractRows(tableHtml: string): string[][] {
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  return rows.map((row) => {
    const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? [];
    return cells.map((cell) => stripTags(cell));
  });
}

function cleanTeamName(raw: string): { name: string; reignIndex: number | null } {
  const m = raw.match(/^(.*?)\s*\((\d+)\)\s*$/);
  if (m) {
    return { name: m[1].trim(), reignIndex: Number.parseInt(m[2], 10) };
  }
  return { name: raw.trim(), reignIndex: null };
}

function headerLooksLike(cells: string[], ...needles: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase()).join(" | ");
  return needles.every((n) => joined.includes(n));
}

function parseCurrentTable(tableHtml: string): WikipediaWorldRankingEntry[] {
  const rows = extractRows(tableHtml);
  if (rows.length < 2) return [];
  const header = rows[0].map((c) => c.toLowerCase());
  if (!header.some((h) => h.includes("rank")) || !header.some((h) => h.includes("points"))) {
    return [];
  }

  const out: WikipediaWorldRankingEntry[] = [];
  for (const cells of rows.slice(1)) {
    if (cells.length < 3) continue;
    // Rank | Change | Team | Points  OR Rank | Team | Points
    let position: number | null = null;
    let change: number | null = null;
    let teamRaw = "";
    let pointsRaw = "";

    if (cells.length >= 4 && header.some((h) => h.includes("change"))) {
      position = parseOptionalInt(cells[0]);
      change = parseChange(cells[1]);
      teamRaw = cells[2];
      pointsRaw = cells[3];
    } else {
      position = parseOptionalInt(cells[0]);
      teamRaw = cells[1];
      pointsRaw = cells[2];
    }

    const points = parsePoints(pointsRaw);
    if (position == null || !teamRaw || points == null) continue;
    const { name } = cleanTeamName(teamRaw);
    out.push({
      position,
      change,
      teamName: name,
      teamCode: teamCodeFromName(name),
      points,
    });
  }
  return out;
}

function parseLeaderSpans(tableHtml: string): WikipediaLeaderSpan[] {
  const rows = extractRows(tableHtml);
  if (rows.length < 2) return [];
  if (!headerLooksLike(rows[0], "team", "start")) return [];

  const out: WikipediaLeaderSpan[] = [];
  for (const cells of rows.slice(1)) {
    if (cells.length < 3) continue;
    const { name, reignIndex } = cleanTeamName(cells[0]);
    const startDate = parseWikiDate(cells[1]);
    if (!name || !startDate) continue;
    const endRaw = cells[2] ?? "";
    const endDate = /present/i.test(endRaw) ? null : parseWikiDate(endRaw);
    out.push({
      teamName: name,
      teamCode: teamCodeFromName(name),
      reignIndex,
      startDate,
      endDate,
      weeks: cells[3] != null ? parseOptionalInt(cells[3]) : null,
      totalWeeks: cells[4] != null ? parseOptionalInt(cells[4]) : null,
    });
  }
  return out;
}

function parseRankMilestones(tableHtml: string): WikipediaRankMilestone[] {
  const rows = extractRows(tableHtml);
  if (rows.length < 2) return [];
  const flatHeader = rows.slice(0, 2).flat().map((c) => c.toLowerCase()).join(" ");
  if (!flatHeader.includes("best") || !flatHeader.includes("worst")) return [];
  // Skip dual header rows
  const startIdx = rows[0].length <= 3 && rows[1]?.some((c) => /rank|year/i.test(c)) ? 2 : 1;

  const out: WikipediaRankMilestone[] = [];
  for (const cells of rows.slice(startIdx)) {
    if (cells.length < 5) continue;
    const { name } = cleanTeamName(cells[0]);
    if (!name) continue;
    out.push({
      teamName: name,
      teamCode: teamCodeFromName(name),
      bestRank: parseOptionalInt(cells[1]),
      bestYears: cells[2] || null,
      worstRank: parseOptionalInt(cells[3]),
      worstYears: cells[4] || null,
    });
  }
  return out;
}

function parsePointsMilestones(tableHtml: string): WikipediaPointsMilestone[] {
  const rows = extractRows(tableHtml);
  if (rows.length < 2) return [];
  const flatHeader = rows.slice(0, 2).flat().map((c) => c.toLowerCase()).join(" ");
  if (!flatHeader.includes("rating") && !flatHeader.includes("most")) return [];
  if (!flatHeader.includes("date") && !flatHeader.includes("least")) return [];
  const startIdx = rows[0].length <= 3 && rows[1]?.some((c) => /rating|date|points/i.test(c)) ? 2 : 1;

  const out: WikipediaPointsMilestone[] = [];
  for (const cells of rows.slice(startIdx)) {
    if (cells.length < 5) continue;
    const { name } = cleanTeamName(cells[0]);
    if (!name) continue;
    out.push({
      teamName: name,
      teamCode: teamCodeFromName(name),
      peakPoints: parsePoints(cells[1]),
      peakDate: parseWikiDate(cells[2]),
      troughPoints: parsePoints(cells[3]),
      troughDate: parseWikiDate(cells[4]),
    });
  }
  return out;
}

function extractAsOfDate(html: string): string | null {
  // May sit after the lead template; allow markup between tokens.
  const m = html.match(
    /as\s+of\s+(?:<[^>]+>\s*)*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i,
  );
  if (!m) {
    const text = stripTags(html.slice(0, 40000));
    const plain = text.match(/as of\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    return plain ? parseWikiDate(plain[1]) : null;
  }
  const day = m[1].padStart(2, "0");
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${day}`;
}

export function wikipediaWorldRankingsPageUrl(category: WorldRugbyRankingCategory): string {
  return category === "wru"
    ? "https://en.wikipedia.org/wiki/World_Rugby_Women%27s_World_Rankings"
    : "https://en.wikipedia.org/wiki/World_Rugby_Rankings";
}

export function wikipediaWorldRankingsPageTitle(category: WorldRugbyRankingCategory): string {
  return category === "wru" ? "World Rugby Women's World Rankings" : "World Rugby Rankings";
}

/**
 * Parse rendered MediaWiki HTML for World Rugby Rankings Wikipedia pages.
 */
export function parseWikipediaWorldRankingsHtml(
  html: string,
  options: {
    category?: WorldRugbyRankingCategory;
    pageTitle?: string;
    sourceUrl?: string;
  } = {},
): WikipediaWorldRankingsParseResult {
  const category = options.category ?? "mru";
  const tables = extractTables(html);

  let currentTable: WikipediaWorldRankingEntry[] = [];
  let leaderSpans: WikipediaLeaderSpan[] = [];
  let rankMilestones: WikipediaRankMilestone[] = [];
  let pointsMilestones: WikipediaPointsMilestone[] = [];

  for (const table of tables) {
    if (!currentTable.length) {
      const cur = parseCurrentTable(table);
      if (cur.length >= 5) currentTable = cur;
    }
    if (!leaderSpans.length) {
      const leaders = parseLeaderSpans(table);
      if (leaders.length >= 3) leaderSpans = leaders;
    }
    if (!rankMilestones.length) {
      const ranks = parseRankMilestones(table);
      if (ranks.length >= 5) rankMilestones = ranks;
    }
    if (!pointsMilestones.length) {
      const pts = parsePointsMilestones(table);
      if (pts.length >= 5) pointsMilestones = pts;
    }
  }

  return {
    category,
    pageTitle: options.pageTitle ?? wikipediaWorldRankingsPageTitle(category),
    sourceUrl: options.sourceUrl ?? wikipediaWorldRankingsPageUrl(category),
    asOfDate: extractAsOfDate(html),
    currentTable,
    leaderSpans,
    rankMilestones,
    pointsMilestones,
  };
}
