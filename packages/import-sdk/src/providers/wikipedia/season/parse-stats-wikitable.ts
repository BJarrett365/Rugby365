import {
  parseRugbyChampionshipTeam,
  wikiPlayerNameFromMarkup,
  type WikipediaRugbyboxScoring,
  type WikipediaScoringKind,
} from "./parse-rugbybox-scoring";

export type WikipediaSeasonStatRow = {
  playerName: string;
  teamName: string;
  tries: number;
  points: number;
};

function splitWikitableRows(table: string): string[] {
  return table
    .split(/^\s*\|-/m)
    .map((row) => row.trim())
    .filter((row) => row && !row.startsWith("!"));
}

function cellsFromRow(row: string): string[] {
  const lines = row
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.startsWith("|-") && !line.startsWith("|+"));
  return lines.map((line) => cellValue(line)).filter(Boolean);
}

function cellValue(line: string): string {
  let value = line.replace(/^\|/, "").trim();
  value = value.replace(/^(?:rowspan|colspan|align|style|bgcolor|class)\s*=\s*("[^"]*"|[^\s|]+)\s*\|/i, "");
  return value.trim();
}

function parseIntCell(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d+)/);
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

function sectionAfterHeading(wikitext: string, heading: RegExp): string {
  const match = wikitext.match(heading);
  if (!match || match.index == null) return "";
  const rest = wikitext.slice(match.index + match[0].length);
  const next = rest.search(/\n==+/);
  return next === -1 ? rest : rest.slice(0, next);
}

export function parseWikipediaScorerWikitable(
  wikitext: string,
  metric: "tries" | "points",
): WikipediaSeasonStatRow[] {
  const heading =
    metric === "tries"
      ? /==+\s*(?:Leading\s+)?Try[-\s]?scorers?\s*==+/i
      : /==+\s*(?:Leading\s+)?Points?\s*scorers?\s*==+/i;
  const section = sectionAfterHeading(wikitext, heading);
  if (!section) return [];
  const tableMatch = section.match(/\{\|[\s\S]*?\|\}/);
  if (!tableMatch) return [];

  const rows: WikipediaSeasonStatRow[] = [];
  let pendingTries: number | null = null;
  let pendingPoints: number | null = null;

  for (const row of splitWikitableRows(tableMatch[0]!)) {
    const cells = cellsFromRow(row);
    if (cells.length < 2) continue;
    const hasName = cells.some((cell) => cell.includes("[["));
    if (!hasName) continue;

    const nameCell = cells.find((cell) => cell.includes("[["));
    const teamCell =
      cells.find((cell) => /\{\{\s*ru(?:-rt)?\s*\|/i.test(cell) || /\{\{\s*flag(?:icon|deco)/i.test(cell)) ??
      cells.find((cell) => parseRugbyChampionshipTeam(cell));
    if (!nameCell || !teamCell) continue;

    const playerName = wikiPlayerNameFromMarkup(nameCell).page;
    const teamName = parseRugbyChampionshipTeam(teamCell);
    if (!playerName || !teamName) continue;

    const numericCells = cells
      .map((cell) => parseIntCell(cell))
      .filter((n): n is number => n != null && n > 0 && n < 200);
    const lastNumeric = numericCells.at(-1) ?? null;

    if (metric === "tries") {
      if (lastNumeric != null) pendingTries = lastNumeric;
      if (pendingTries == null) continue;
      rows.push({ playerName, teamName, tries: pendingTries, points: 0 });
    } else {
      if (lastNumeric != null) pendingPoints = lastNumeric;
      if (pendingPoints == null) continue;
      rows.push({ playerName, teamName, tries: 0, points: pendingPoints });
    }
  }
  return rows;
}

export function mergeWikipediaSeasonStatRows(
  tryRows: WikipediaSeasonStatRow[],
  pointRows: WikipediaSeasonStatRow[],
): WikipediaSeasonStatRow[] {
  const byKey = new Map<string, WikipediaSeasonStatRow>();
  const keyOf = (row: WikipediaSeasonStatRow) =>
    `${row.playerName.toLowerCase()}|${row.teamName.toLowerCase()}`;
  for (const row of [...tryRows, ...pointRows]) {
    const key = keyOf(row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row });
      continue;
    }
    existing.tries = Math.max(existing.tries, row.tries);
    existing.points = Math.max(existing.points, row.points);
  }
  return [...byKey.values()];
}

const RUGBYBOX_POINTS: Record<WikipediaScoringKind, number> = {
  try: 5,
  conversion: 2,
  penalty: 3,
  drop_goal: 3,
};

/** Roll rugbybox try/con/pen/drop lists into season leaderboard rows. */
export function seasonStatsFromRugbyboxScoring(
  boxes: WikipediaRugbyboxScoring[],
): WikipediaSeasonStatRow[] {
  const byKey = new Map<string, WikipediaSeasonStatRow>();
  for (const box of boxes) {
    for (const side of ["home", "away"] as const) {
      const teamName = side === "home" ? box.homeTeam : box.awayTeam;
      for (const entry of box[side]) {
        const key = `${entry.playerName.toLowerCase()}|${teamName.toLowerCase()}`;
        const existing = byKey.get(key) ?? {
          playerName: entry.playerName,
          teamName,
          tries: 0,
          points: 0,
        };
        if (entry.kind === "try") existing.tries += entry.count;
        existing.points += (RUGBYBOX_POINTS[entry.kind] ?? 0) * entry.count;
        byKey.set(key, existing);
      }
    }
  }
  return [...byKey.values()];
}
