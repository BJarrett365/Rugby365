/** Shared helpers for Wikipedia season / sport module parsing. */

export function stripWikiMarkup(value: string): string {
  let text = value.trim();
  text = text.replace(/'''/g, "").replace(/''/g, "");
  text = text.replace(/\{\{nowrap\|([^{}]+)\}\}/gi, "$1");
  // [[Page|Label]] or [[Page]]
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\{\{[^}]+\}\}/g, "");
  text = text.replace(/\}\}/g, "");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^/]*\/>/gi, "");
  text = text.replace(/<\/?small>/gi, "");
  text = text.replace(/<\/?s>/gi, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/\([^)]*BP[^)]*\)/gi, "");
  text = text.replace(/\(\d+(?:st|nd|rd|th)?\s+title\)/gi, "");
  text = text.replace(/\b\d+(?:st|nd|rd|th)\s+title\b/gi, "");
  text = text.replace(/\(\d+\)/g, "");
  text = text.replace(/\b\((?:C|SF|QF|RU|F|PO|P|Q|Q1|Q2|Q3)\)\b/gi, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/,/g, "");
  return text.replace(/\s+/g, " ").trim();
}

export function parseWikiLinkLabel(value: string): string {
  return stripWikiMarkup(value);
}

export function parseAttendance(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = stripWikiMarkup(value).replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseScore(value: string | undefined): { home: number; away: number } | null {
  if (!value) return null;
  const cleaned = stripWikiMarkup(value).replace(/–/g, "-").replace(/—/g, "-");
  const match = cleaned.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return { home: Number.parseInt(match[1]!, 10), away: Number.parseInt(match[2]!, 10) };
}

/** Parse dates like "20 September 2024" or "6 June 2025". */
export function parseWikiDate(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = stripWikiMarkup(value);
  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;
  const day = Number.parseInt(match[1]!, 10);
  const monthName = match[2]!.toLowerCase();
  const year = Number.parseInt(match[3]!, 10);
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const month = months[monthName];
  if (month == null) return null;
  const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return iso;
}

export function parseWikiTime(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = stripWikiMarkup(value);
  const match = cleaned.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

export function combineDateTimeUtc(dateIso: string | null, time: string | null): string | null {
  if (!dateIso) return null;
  const [h, m] = (time ?? "15:00").split(":").map((p) => Number.parseInt(p, 10));
  // Premiership kickoffs are UK local; store as approximate UTC by treating as UTC for consistency with existing data windows.
  return new Date(Date.UTC(
    Number.parseInt(dateIso.slice(0, 4), 10),
    Number.parseInt(dateIso.slice(5, 7), 10) - 1,
    Number.parseInt(dateIso.slice(8, 10), 10),
    h ?? 15,
    m ?? 0,
  )).toISOString();
}

export function extractTemplateBlocks(wikitext: string, templateName: string): string[] {
  const lower = wikitext;
  const needle = `{{${templateName}`;
  const blocks: string[] = [];
  let searchFrom = 0;
  while (true) {
    const start = lower.toLowerCase().indexOf(needle.toLowerCase(), searchFrom);
    if (start < 0) break;
    let depth = 0;
    let i = start;
    for (; i < lower.length - 1; i++) {
      if (lower[i] === "{" && lower[i + 1] === "{") {
        depth += 1;
        i += 1;
        continue;
      }
      if (lower[i] === "}" && lower[i + 1] === "}") {
        depth -= 1;
        i += 1;
        if (depth === 0) {
          blocks.push(lower.slice(start, i + 1));
          searchFrom = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return blocks;
}

export function parseTemplateParams(block: string): Record<string, string> {
  // Strip outer {{...}}
  const inner = block.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === "{" && inner[i + 1] === "{") {
      depth += 1;
      current += "{{";
      i += 1;
      continue;
    }
    if (ch === "}" && inner[i + 1] === "}") {
      depth -= 1;
      current += "}}";
      i += 1;
      continue;
    }
    if (ch === "[" && inner[i + 1] === "[") {
      depth += 1;
      current += "[[";
      i += 1;
      continue;
    }
    if (ch === "]" && inner[i + 1] === "]") {
      depth -= 1;
      current += "]]";
      i += 1;
      continue;
    }
    if (ch === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);

  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    params[key] = value;
  }
  return params;
}

export function detectSeasonStartYearFromTitle(title: string): number | null {
  const cross = title.match(/(20\d{2})[–-](\d{2}|\d{4})/);
  if (cross) return Number.parseInt(cross[1]!, 10);
  const single = title.match(/\b(20\d{2})\b/);
  return single ? Number.parseInt(single[1]!, 10) : null;
}
