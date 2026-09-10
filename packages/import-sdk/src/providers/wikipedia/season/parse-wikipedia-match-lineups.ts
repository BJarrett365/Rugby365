import { parseRugbyChampionshipTeam, wikiPlayerNameFromMarkup } from "./parse-rugbybox-scoring";
import { extractTemplateBlocks, parseTemplateParams, parseWikiDate } from "./wiki-text-utils";

export type WikipediaLineupPlayer = {
  jerseyNumber: number;
  playerName: string;
  playerLabel: string;
  squadRole: "starting" | "substitute";
  minutesPlayed: number;
};

export type WikipediaMatchLineupSide = {
  teamName: string;
  coachName: string | null;
  players: WikipediaLineupPlayer[];
};

export type WikipediaMatchLineups = {
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  home: WikipediaMatchLineupSide;
  away: WikipediaMatchLineupSide;
};

const JERSEY_ROW =
  /^\|\s*(?:[A-Z0-9]{1,3}\s*)?\|\|\s*'''?\s*(\d{1,2})\s*'''?\s*\|\|\s*(.+)$/im;

function firstSubTemplateMinute(row: string, names: string[]): number | null {
  for (const name of names) {
    const match = row.match(new RegExp(`\\{\\{\\s*${name}\\s*\\|\\s*(\\d{1,3})`, "i"));
    if (match) return Number.parseInt(match[1]!, 10);
  }
  return null;
}

function minutesForRow(row: string, jersey: number): number {
  const subOff = firstSubTemplateMinute(row, ["suboff", "sub off"]);
  const subOn = firstSubTemplateMinute(row, ["subon", "sub on"]);
  if (jersey <= 15) {
    if (subOff != null && Number.isFinite(subOff)) return Math.max(1, Math.min(80, subOff));
    return 80;
  }
  if (subOn != null && Number.isFinite(subOn)) {
    return Math.max(0, Math.min(80, 80 - subOn));
  }
  return 0;
}

export function parseWikipediaLineupTable(wikitext: string, teamName: string): WikipediaMatchLineupSide | null {
  const players: WikipediaLineupPlayer[] = [];
  for (const rawLine of wikitext.split(/\n/)) {
    const line = rawLine.trim();
    const row = line.match(JERSEY_ROW);
    if (!row) continue;
    const jersey = Number.parseInt(row[1]!, 10);
    if (!Number.isFinite(jersey) || jersey < 1 || jersey > 23) continue;
    const { page, label } = wikiPlayerNameFromMarkup(row[2] ?? "");
    if (!page || page.length < 2) continue;
    players.push({
      jerseyNumber: jersey,
      playerName: page,
      playerLabel: label || page,
      squadRole: jersey <= 15 ? "starting" : "substitute",
      minutesPlayed: minutesForRow(line, jersey),
    });
  }
  if (players.filter((p) => p.jerseyNumber <= 15).length < 13) return null;

  const coachMatch = wikitext.match(
    /\|\s*colspan\s*=\s*"?4"?\s*\|\s*(?:\{\{flagicon\|[^}]+\}\}\s*)?(.+)/i,
  );
  let coachName: string | null = null;
  if (coachMatch && /coach/i.test(wikitext)) {
    const { label } = wikiPlayerNameFromMarkup(coachMatch[1] ?? "");
    coachName = label || null;
  }

  return { teamName, coachName, players };
}

function footballKitTitles(block: string): string[] {
  const titles: string[] = [];
  for (const kit of extractTemplateBlocks(block, "Football kit")) {
    const params = parseTemplateParams(kit);
    const title = parseRugbyChampionshipTeam(params.title ?? "") || (params.title ?? "").trim();
    if (title) titles.push(title);
  }
  return titles;
}

function lineupTableChunks(block: string): string[] {
  const chunks: string[] = [];
  const starts: number[] = [];
  const re = /\|\s*FB\s*\|\|/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) starts.push(match.index);
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i]!;
    const to = starts[i + 1] ?? Math.min(block.length, from + 4000);
    chunks.push(block.slice(from, to));
  }
  return chunks;
}

/**
 * Pair each Rugbybox with the two Wikipedia teamsheets that follow it.
 */
export function parseWikipediaChampionshipMatchLineups(wikitext: string): WikipediaMatchLineups[] {
  const boxes = [
    ...extractTemplateBlocks(wikitext, "Rugbybox"),
    ...extractTemplateBlocks(wikitext, "rugbybox"),
    ...extractTemplateBlocks(wikitext, "Rugbybox2"),
  ];
  const seen = new Set<string>();
  const out: WikipediaMatchLineups[] = [];

  for (const box of boxes) {
    if (seen.has(box)) continue;
    seen.add(box);
    const params = parseTemplateParams(box);
    const homeTeam = parseRugbyChampionshipTeam(params.home);
    const awayTeam = parseRugbyChampionshipTeam(params.away);
    if (!homeTeam || !awayTeam) continue;

    const boxIndex = wikitext.indexOf(box);
    if (boxIndex < 0) continue;
    const after = wikitext.slice(boxIndex + box.length, boxIndex + box.length + 12000);
    const titles = footballKitTitles(after);
    const tables = lineupTableChunks(after);
    if (tables.length < 2) continue;

    const firstName = titles[0] ?? homeTeam;
    const secondName = titles[1] ?? awayTeam;
    const first = parseWikipediaLineupTable(tables[0]!, firstName);
    const second = parseWikipediaLineupTable(tables[1]!, secondName);
    if (!first || !second) continue;

    const home =
      parseRugbyChampionshipTeam(first.teamName) === homeTeam
        ? first
        : parseRugbyChampionshipTeam(second.teamName) === homeTeam
          ? second
          : first;
    const away = home === first ? second : first;

    out.push({
      date: parseWikiDate(params.date),
      homeTeam,
      awayTeam,
      home: { ...home, teamName: homeTeam },
      away: { ...away, teamName: awayTeam },
    });
  }

  return out;
}
