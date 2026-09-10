import { parseWikiLinkLabel, stripWikiMarkup } from "./wiki-text-utils";

export const RUGBY_CHAMPIONSHIP_TEAM_CODES: Record<string, string> = {
  NZL: "New Zealand",
  NZ: "New Zealand",
  AUS: "Australia",
  RSA: "South Africa",
  SA: "South Africa",
  ARG: "Argentina",
};

const TEAM_ALIASES: Record<string, string> = {
  "all blacks": "New Zealand",
  "new zealand": "New Zealand",
  wallabies: "Australia",
  australia: "Australia",
  springboks: "South Africa",
  "south africa": "South Africa",
  pumas: "Argentina",
  argentina: "Argentina",
};

export type WikipediaScoringKind = "try" | "conversion" | "penalty" | "drop_goal";

export type WikipediaScoringEntry = {
  playerName: string;
  playerLabel: string;
  count: number;
  kind: WikipediaScoringKind;
};

export type WikipediaRugbyboxScoring = {
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  home: WikipediaScoringEntry[];
  away: WikipediaScoringEntry[];
};

export function parseRugbyChampionshipTeam(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const ru = raw.match(/\{\{\s*ru(?:-rt)?\s*\|\s*([A-Za-z]+)/i);
  if (ru) {
    const code = ru[1]!.toUpperCase();
    return RUGBY_CHAMPIONSHIP_TEAM_CODES[code] ?? code;
  }
  const flag = raw.match(/\{\{\s*flagicon\s*\|\s*([^}]+)\s*\}\}/i);
  if (flag) {
    const token = flag[1]!.trim().toUpperCase();
    if (RUGBY_CHAMPIONSHIP_TEAM_CODES[token]) return RUGBY_CHAMPIONSHIP_TEAM_CODES[token]!;
  }
  const label = parseWikiLinkLabel(raw);
  return TEAM_ALIASES[label.toLowerCase()] ?? label;
}

export function isRugbyChampionshipNation(name: string): boolean {
  const key = name.trim().toLowerCase();
  return Boolean(TEAM_ALIASES[key]);
}

export function wikiPlayerNameFromMarkup(raw: string): { page: string; label: string } {
  const link = raw.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (link) {
    const page = cleanWikiPlayerTitle(link[1]!.trim());
    const label = cleanWikiPlayerTitle((link[2] ?? link[1]!).trim());
    return { page, label };
  }
  const text = stripWikiMarkup(raw);
  return { page: cleanWikiPlayerTitle(text), label: cleanWikiPlayerTitle(text) };
}

export function cleanWikiPlayerTitle(name: string): string {
  return name
    .replace(/\s*\(rugby union[^)]*\)/gi, "")
    .replace(/\s*\(rugby player[^)]*\)/gi, "")
    .replace(/\s*\(rugby[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countFromMinutes(raw: string): number {
  const minutes = [...raw.matchAll(/\d+\s*(?:\+|\u2032|')/g)];
  return minutes.length;
}

export function parseRugbyboxScoringList(
  raw: string | undefined,
  kind: WikipediaScoringKind,
): WikipediaScoringEntry[] {
  if (!raw?.trim()) return [];
  const chunks = raw
    .split(/<br\s*\/?>/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const entries: WikipediaScoringEntry[] = [];

  for (const chunk of chunks) {
    const { page, label } = wikiPlayerNameFromMarkup(chunk);
    if (!page || /^penalty\s*tr/i.test(page)) continue;

    const madeAttempt = chunk.match(/\((\d+)\s*\/\s*\d+\)/);
    const grouped = chunk.match(/\((\d+)\)/);
    const minuteCount = countFromMinutes(chunk);
    let count = 1;
    if (kind === "try") {
      count = grouped && !madeAttempt ? Number.parseInt(grouped[1]!, 10) : Math.max(1, minuteCount || 1);
    } else if (madeAttempt) {
      count = Number.parseInt(madeAttempt[1]!, 10);
    } else if (minuteCount > 0) {
      count = minuteCount;
    } else if (grouped) {
      count = Number.parseInt(grouped[1]!, 10);
    }
    if (!Number.isFinite(count) || count <= 0) continue;
    entries.push({ playerName: page, playerLabel: label || page, count, kind });
  }
  return entries;
}

export function parseRugbyboxScoringBlock(
  params: Record<string, string>,
  date: string | null,
): WikipediaRugbyboxScoring | null {
  const homeTeam = parseRugbyChampionshipTeam(params.home);
  const awayTeam = parseRugbyChampionshipTeam(params.away);
  if (!homeTeam || !awayTeam) return null;
  if (!isRugbyChampionshipNation(homeTeam) || !isRugbyChampionshipNation(awayTeam)) return null;

  const score = (params.score ?? "").replace(/[–—]/g, "-").match(/(\d+)\s*-\s*(\d+)/);

  return {
    date,
    homeTeam,
    awayTeam,
    homeScore: score ? Number.parseInt(score[1]!, 10) : null,
    awayScore: score ? Number.parseInt(score[2]!, 10) : null,
    home: [
      ...parseRugbyboxScoringList(params.try1 ?? params.try, "try"),
      ...parseRugbyboxScoringList(params.con1 ?? params.con, "conversion"),
      ...parseRugbyboxScoringList(params.pen1 ?? params.pen, "penalty"),
      ...parseRugbyboxScoringList(params.drop1 ?? params.drop, "drop_goal"),
    ],
    away: [
      ...parseRugbyboxScoringList(params.try2, "try"),
      ...parseRugbyboxScoringList(params.con2, "conversion"),
      ...parseRugbyboxScoringList(params.pen2, "penalty"),
      ...parseRugbyboxScoringList(params.drop2, "drop_goal"),
    ],
  };
}
