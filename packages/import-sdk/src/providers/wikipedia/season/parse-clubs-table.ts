import { parseWikiLinkLabel, stripWikiMarkup } from "./wiki-text-utils";

export type WikipediaClubRow = {
  clubName: string;
  headCoach: string | null;
  captain: string | null;
  stadium: string | null;
  capacity: number | null;
  cityArea: string | null;
};

function parseCell(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") && !trimmed.startsWith("!")) return null;
  if (/^\|?\s*-\s*$/.test(trimmed) || trimmed === "|-") return null;
  const body = trimmed.replace(/^[!|]+/, "").trim();
  if (!body || body === "-") return null;
  return stripWikiMarkup(body.replace(/<br\s*\/?>/gi, " "));
}

function parseCapacity(value: string): number | null {
  // Prefer the first capacity when pages list dual figures (e.g. "8,300 / 10,000").
  const cleaned = stripWikiMarkup(value)
    .replace(/&nbsp;/g, " ")
    .split(/[/–—]| or /i)[0]!
    .trim();
  const match = cleaned.match(/(\d[\d,]*)/);
  if (!match) return null;
  const n = Number.parseInt(match[1]!.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n > 0 && n < 200_000 ? n : null;
}

function extractWikiTableRows(wikitext: string): string[][] {
  const tableStart = wikitext.search(/\{\|[\s\S]*?class="wikitable/i);
  if (tableStart < 0) return [];

  const slice = wikitext.slice(tableStart);
  const tableEnd = slice.indexOf("\n|}");
  const tableBlock = tableEnd > 0 ? slice.slice(0, tableEnd) : slice;

  const tableRows: string[][] = [];
  let current: string[] = [];

  for (const line of tableBlock.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed === "|-") {
      if (current.length) {
        tableRows.push(current);
        current = [];
      }
      continue;
    }
    const cell = parseCell(line);
    if (cell != null) current.push(cell);
  }
  if (current.length) tableRows.push(current);

  return tableRows;
}

function rowToClub(headerCells: string[], cells: string[]): WikipediaClubRow | null {
  if (!cells.length) return null;

  const clubName = parseWikiLinkLabel(cells[0] ?? "");
  if (!clubName) return null;

  const getCol = (...names: string[]) => {
    const idx = headerCells.findIndex((h) =>
      names.some((n) => {
        if (n === "city") return /\bcity\b/.test(h) || h.includes("city/area");
        if (n === "area") return h.includes("city/area") || /\barea\b/.test(h);
        if (n === "capacity") return h.includes("capacity");
        if (n === "captain") return h.includes("captain");
        if (n === "stadium" || n === "ground" || n === "venue") {
          return h.includes("stadium") || h.includes("ground") || h.includes("venue");
        }
        if (n === "director" || n === "head coach" || n === "coach") {
          return h.includes("coach") || h.includes("director");
        }
        return h.includes(n);
      }),
    );
    if (idx < 0 || idx >= cells.length) return null;
    const val = cells[idx]?.trim();
    return val ? parseWikiLinkLabel(val) : null;
  };

  const coachHeader = headerCells.findIndex(
    (h) => h.includes("coach") || h.includes("director"),
  );
  const coach =
    coachHeader >= 0 && cells[coachHeader]
      ? parseWikiLinkLabel(cells[coachHeader])
      : null;

  let captain: string | null = null;
  let stadium: string | null = null;
  let capacity: number | null = null;
  let cityArea: string | null = null;

  if (headerCells.some((h) => h.includes("captain"))) {
    captain = getCol("captain");
    stadium = getCol("stadium", "ground", "venue");
    const capIdx = headerCells.findIndex((h) => h.includes("capacity"));
    capacity = capIdx >= 0 && cells[capIdx] ? parseCapacity(cells[capIdx]) : null;
    cityArea = getCol("city", "area", "location");
  } else if (headerCells.length === 4 && headerCells[1]?.includes("stadium")) {
    stadium = cells[1] ? parseWikiLinkLabel(cells[1]) : null;
    capacity = cells[2] ? parseCapacity(cells[2]) : null;
    cityArea = cells[3] ? stripWikiMarkup(cells[3]) : null;
  } else {
    stadium = getCol("stadium", "ground", "venue") ?? (cells[1] ? parseWikiLinkLabel(cells[1]) : null);
    const capIdx = headerCells.findIndex((h) => h.includes("capacity"));
    capacity =
      capIdx >= 0 && cells[capIdx]
        ? parseCapacity(cells[capIdx])
        : cells[2]
          ? parseCapacity(cells[2])
          : null;
    cityArea = getCol("city", "area", "location") ?? (cells[3] ? stripWikiMarkup(cells[3]) : null);
  }

  return {
    clubName,
    headCoach: coach,
    captain,
    stadium,
    capacity,
    cityArea,
  };
}

/** Parse club / stadium / coach table from Teams section wikitext. */
export function parseClubsTableFromWikitext(wikitext: string): WikipediaClubRow[] {
  const tableRows = extractWikiTableRows(wikitext);
  if (!tableRows.length) return [];

  let headerCells: string[] = [];
  const clubs: WikipediaClubRow[] = [];

  for (const cells of tableRows) {
    const first = cells[0]?.toLowerCase() ?? "";
    if (first.includes("club") || first.includes("team")) {
      headerCells = cells.map((c) => c.toLowerCase());
      continue;
    }
    if (!headerCells.length) continue;

    const club = rowToClub(headerCells, cells);
    if (club) clubs.push(club);
  }

  return clubs;
}

export function findTeamsSectionIndex(
  sections: Array<{ index: string; line: string }>,
): string | null {
  const teams = sections.find((s) => /^teams$/i.test(s.line.trim()));
  return teams?.index ?? null;
}
