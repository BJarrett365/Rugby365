/**
 * Parse Wikipedia player Honours sections into discrete award / team-honour rows.
 */
import { stripWikiMarkup } from "./season/wiki-text-utils";

export type WikipediaPlayerHonourKind = "personal_award" | "team_honour";

export type WikipediaPlayerHonour = {
  kind: WikipediaPlayerHonourKind;
  title: string;
  year: number;
  seasonLabel?: string | null;
  /** Parent bullet group, e.g. "SA Rugby Awards". */
  groupLabel?: string | null;
  /** Bold nation/club heading above the list, e.g. "South Africa". */
  teamName?: string | null;
  placing: "WINNER" | "OTHER";
  sourceLine: string;
};

function cleanHonourText(raw: string): string {
  let text = raw;
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^/]*\/>/gi, "");
  text = text.replace(/\{\{[^{}]*\}\}/g, "");
  // Nested cite templates left over
  text = text.replace(/\{\{[^{}]*\}\}/g, "");
  text = stripWikiMarkup(text);
  return text.replace(/\s+/g, " ").trim();
}

export function extractHonoursSectionWikitext(wikitext: string): string | null {
  const m = wikitext.match(
    /(?:^|\n)==\s*Honours?\s*==\s*\n([\s\S]*?)(?=\n==\s*[^=]|\n\{\{[Pp]layer\b|\Z)/,
  );
  return m?.[1]?.trim() ? m[1] : null;
}

function extractYear(text: string): { year: number; rest: string; seasonLabel: string | null } | null {
  // "…: 2024" or "… 2024" or "… 2024/25"
  const colonYear = text.match(/^(.*?)\s*[:—–-]\s*(\d{4})(?:\s*[\/–-]\s*(\d{2}|\d{4}))?\s*$/);
  if (colonYear) {
    const year = Number(colonYear[2]);
    const end = colonYear[3];
    const seasonLabel =
      end != null
        ? `${year}/${end.length === 2 ? end : end.slice(-2)}`
        : null;
    if (year >= 1900 && year <= 2100) {
      return { year, rest: colonYear[1].trim(), seasonLabel };
    }
  }

  const trailing = text.match(/^(.*?)\s+(\d{4})(?:\s*[\/–-]\s*(\d{2}|\d{4}))?\s*$/);
  if (trailing) {
    const year = Number(trailing[2]);
    const end = trailing[3];
    const seasonLabel =
      end != null
        ? `${year}/${end.length === 2 ? end : end.slice(-2)}`
        : null;
    if (year >= 1900 && year <= 2100 && trailing[1].trim().length >= 3) {
      return { year, rest: trailing[1].trim(), seasonLabel };
    }
  }

  const leading = text.match(/^(\d{4})\s+(.+)$/);
  if (leading) {
    const year = Number(leading[1]);
    if (year >= 1900 && year <= 2100) {
      return { year, rest: leading[2].trim(), seasonLabel: null };
    }
  }

  return null;
}

function isTeamHonourPhrase(text: string): boolean {
  return /\b(winner|winners|champion|champions|runner[- ]?up|finalist)\b/i.test(text);
}

function placingFromText(text: string): "WINNER" | "OTHER" {
  if (/\b(runner[- ]?up|finalist)\b/i.test(text)) return "OTHER";
  if (/\b(winner|winners|champion|champions)\b/i.test(text)) return "WINNER";
  return "WINNER";
}

function stripPlacingWords(text: string): string {
  return text
    .replace(/\b(winner|winners|champion|champions|runner[- ]?up|finalist)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a Wikipedia Honours section (wikitext body only) into structured rows.
 */
export function parsePlayerHonoursFromWikitext(wikitext: string): WikipediaPlayerHonour[] {
  const section = extractHonoursSectionWikitext(wikitext) ?? wikitext;
  const lines = section.split(/\r?\n/);
  const out: WikipediaPlayerHonour[] = [];

  let teamName: string | null = null;
  let groupLabel: string | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // '''South Africa'''
    const boldOnly = trimmed.match(/^'{2,3}\s*(.+?)\s*'{2,3}$/);
    if (boldOnly && !trimmed.startsWith("*")) {
      teamName = cleanHonourText(boldOnly[1]);
      groupLabel = null;
      continue;
    }

    const bullet = trimmed.match(/^(\*+)\s*(.+)$/);
    if (!bullet) continue;
    const depth = bullet[1].length;
    const bodyRaw = bullet[2];
    const body = cleanHonourText(bodyRaw);
    if (!body) continue;

    // Nested award under a group
    if (depth >= 2) {
      const parsed = leadingYearOrTitle(body);
      if (!parsed) continue;
      out.push({
        kind: isTeamHonourPhrase(body) ? "team_honour" : "personal_award",
        title: parsed.title,
        year: parsed.year,
        seasonLabel: parsed.seasonLabel,
        groupLabel,
        teamName,
        placing: placingFromText(body),
        sourceLine: body,
      });
      continue;
    }

    // Top-level bullet
    if (isTeamHonourPhrase(body)) {
      const parsed = leadingYearOrTitle(body);
      if (parsed) {
        out.push({
          kind: "team_honour",
          title: stripPlacingWords(parsed.title) || parsed.title,
          year: parsed.year,
          seasonLabel: parsed.seasonLabel,
          groupLabel: null,
          teamName,
          placing: placingFromText(body),
          sourceLine: body,
        });
      }
      continue;
    }

    const withYear = leadingYearOrTitle(body);
    if (withYear) {
      out.push({
        kind: "personal_award",
        title: withYear.title,
        year: withYear.year,
        seasonLabel: withYear.seasonLabel,
        groupLabel,
        teamName,
        placing: "WINNER",
        sourceLine: body,
      });
      continue;
    }

    // Group heading without year (e.g. "SA Rugby Awards")
    groupLabel = body;
  }

  return dedupeHonours(out);
}

function leadingYearOrTitle(body: string): {
  title: string;
  year: number;
  seasonLabel: string | null;
} | null {
  const extracted = extractYear(body);
  if (!extracted) return null;
  let title = stripPlacingWords(extracted.rest);
  title = title.replace(/\s*[:—–-]\s*$/, "").trim();
  if (!title || title.length < 3) return null;
  return { title, year: extracted.year, seasonLabel: extracted.seasonLabel };
}

function dedupeHonours(rows: WikipediaPlayerHonour[]): WikipediaPlayerHonour[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.kind}|${r.title.toLowerCase()}|${r.year}|${r.placing}|${r.teamName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fallback: parse Honours from Wikipedia HTML (REST HTML dump).
 */
export function parsePlayerHonoursFromHtml(html: string): WikipediaPlayerHonour[] {
  const sectionMatch = html.match(
    /<h2[^>]*>[\s\S]*?\bHonours?\b[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[\s>])/i,
  );
  if (!sectionMatch) return [];

  const section = sectionMatch[1] ?? "";
  // Convert nested lists to pseudo-wikitext bullets
  const lines: string[] = [];
  let teamName: string | null = null;

  // Bold paragraph headings
  for (const m of section.matchAll(/<(?:p|div)[^>]*>\s*<b>([^<]+)<\/b>\s*<\/(?:p|div)>/gi)) {
    teamName = cleanHonourText(m[1]);
    if (teamName) lines.push(`'''${teamName}'''`);
  }

  // Walk list items with nesting via <ul><li>
  const walk = (htmlChunk: string, depth: number) => {
    const liRe = /<li\b[^>]*>([\s\S]*?)(?=<\/li>|<li\b)/gi;
    let match: RegExpExecArray | null;
    while ((match = liRe.exec(htmlChunk))) {
      const inner = match[1] ?? "";
      const textPart = inner.replace(/<ul[\s\S]*$/i, "");
      const text = cleanHonourText(textPart.replace(/<[^>]+>/g, " "));
      if (text) lines.push(`${"*".repeat(Math.max(1, depth))} ${text}`);
      const nested = inner.match(/<ul\b[^>]*>([\s\S]*)<\/ul>/i);
      if (nested) walk(nested[1] ?? "", depth + 1);
    }
  };
  walk(section, 1);

  if (!lines.length) return [];
  return parsePlayerHonoursFromWikitext(`==Honours==\n${lines.join("\n")}`);
}
