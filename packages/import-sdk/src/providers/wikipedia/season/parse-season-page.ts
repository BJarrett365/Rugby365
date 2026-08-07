import type {
  WikipediaFixtureRow,
  WikipediaScoringEvent,
  WikipediaSeasonPageParse,
  WikipediaSeasonStage,
  WikipediaStandingRow,
} from "./types";
import {
  combineDateTimeUtc,
  detectSeasonStartYearFromTitle,
  extractTemplateBlocks,
  parseAttendance,
  parseScore,
  parseTemplateParams,
  parseWikiDate,
  parseWikiLinkLabel,
  parseWikiTeamLabel,
  parseWikiTime,
  stripWikiMarkup,
} from "./wiki-text-utils";

function playedFrom(row: { won: number; draw: number; lost: number }) {
  return row.won + row.draw + row.lost;
}

function rugbyPoints(row: {
  won: number;
  draw: number;
  tryBonusPoints: number;
  losingBonusPoints: number;
  pointsDeduction: number;
}) {
  return row.won * 4 + row.draw * 2 + row.tryBonusPoints + row.losingBonusPoints - row.pointsDeduction;
}

function parseOneSportsTableBlock(block: string): WikipediaStandingRow[] {
  const params = parseTemplateParams(block);

  const orderRaw = params.team_order ?? params.teamorder ?? "";
  const orderCodes = orderRaw
    .split(/[,|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const nameEntries: Array<{ codeKey: string; nameRaw: string }> = [];
  for (const [key, value] of Object.entries(params)) {
    const match = key.match(/^name_(.+)$/);
    if (match) nameEntries.push({ codeKey: match[1]!.toLowerCase(), nameRaw: value });
  }

  const entries =
    nameEntries.length > 0
      ? [...nameEntries].sort((a, b) => {
          const ai = orderCodes.indexOf(a.codeKey);
          const bi = orderCodes.indexOf(b.codeKey);
          if (ai >= 0 && bi >= 0) return ai - bi;
          if (ai >= 0) return -1;
          if (bi >= 0) return 1;
          const aRank = Number.parseInt(
            Object.entries(params).find(
              ([key, value]) => /^team\d+$/.test(key) && value.trim().toLowerCase() === a.codeKey,
            )?.[0]?.replace(/^team/, "") ?? "",
            10,
          );
          const bRank = Number.parseInt(
            Object.entries(params).find(
              ([key, value]) => /^team\d+$/.test(key) && value.trim().toLowerCase() === b.codeKey,
            )?.[0]?.replace(/^team/, "") ?? "",
            10,
          );
          if (Number.isFinite(aRank) && Number.isFinite(bRank)) return aRank - bRank;
          return a.codeKey.localeCompare(b.codeKey);
        })
      : (() => {
          const teamCodes: Array<{ code: string; rank: number }> = [];
          for (const [key, value] of Object.entries(params)) {
            const match = key.match(/^team(\d+)$/);
            if (!match) continue;
            teamCodes.push({ rank: Number.parseInt(match[1]!, 10), code: value.trim() });
          }
          teamCodes.sort((a, b) => a.rank - b.rank);
          return teamCodes.map(({ code, rank }) => ({
            codeKey: code.toLowerCase(),
            nameRaw: params[`name_${code.toLowerCase()}`] ?? code,
            rank,
          }));
        })();

  const rows: WikipediaStandingRow[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const codeKey = entry.codeKey;
    const teamName = parseWikiTeamLabel(entry.nameRaw).replace(/\s*\(C\)\s*$/i, "").trim();
    if (!teamName) continue;
    const dedupeKey = teamName.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const won = Number.parseInt(params[`win_${codeKey}`] ?? "0", 10) || 0;
    const draw = Number.parseInt(params[`draw_${codeKey}`] ?? "0", 10) || 0;
    const lost = Number.parseInt(params[`loss_${codeKey}`] ?? "0", 10) || 0;
    const pf = Number.parseInt(params[`pf_${codeKey}`] ?? "0", 10) || 0;
    const pa = Number.parseInt(params[`pa_${codeKey}`] ?? "0", 10) || 0;
    const tfRaw = params[`tf_${codeKey}`];
    const tb = Number.parseInt(params[`tb_${codeKey}`] ?? "0", 10) || 0;
    const lb = Number.parseInt(params[`lb_${codeKey}`] ?? "0", 10) || 0;
    const combinedBonus = Number.parseInt(params[`b_${codeKey}`] ?? "0", 10) || 0;
    const tryBonusPoints = tb || (lb ? 0 : combinedBonus);
    const losingBonusPoints = lb;
    const bonusPoints = tb || lb ? tb + lb : combinedBonus;
    const adjust = Number.parseInt(params[`adjust_${codeKey}`] ?? params[`deduct_${codeKey}`] ?? "0", 10) || 0;
    const ptsExplicit = params[`pts_${codeKey}`];
    const pointsDeduction = adjust < 0 ? -adjust : 0;
    const played = Number.parseInt(params[`played_${codeKey}`] ?? "", 10) || playedFrom({ won, draw, lost });
    const points =
      (ptsExplicit != null ? Number.parseInt(ptsExplicit, 10) : null) ??
      rugbyPoints({
        won,
        draw,
        tryBonusPoints: bonusPoints,
        losingBonusPoints: 0,
        pointsDeduction,
      });

    rows.push({
      rank: index + 1,
      teamName,
      played,
      won,
      draw,
      lost,
      pointsFor: pf,
      pointsAgainst: pa,
      pointsDiff: pf - pa,
      triesFor: tfRaw != null ? Number.parseInt(tfRaw, 10) || 0 : null,
      tryBonusPoints,
      losingBonusPoints,
      bonusPoints,
      pointsDeduction,
      points,
      isChampionMarker: /\(C\)/i.test(entry.nameRaw),
      qualificationNotes: null,
    });
  }

  return rows;
}

export function parseSportsTableModule(wikitext: string): WikipediaStandingRow[] {
  const blocks = extractTemplateBlocks(wikitext, "#invoke:sports table").concat(
    extractTemplateBlocks(wikitext, "#invoke:Sports table"),
  );
  if (!blocks.length) return [];

  const rows: WikipediaStandingRow[] = [];
  for (const block of blocks) {
    rows.push(...parseOneSportsTableBlock(block));
  }
  return dedupeStandings(rows);
}

function stageFromRoundLabel(round: string | null, defaultStage: WikipediaSeasonStage): WikipediaSeasonStage {
  if (!round) return defaultStage;
  const value = round.toLowerCase();
  if (/\bbronze\b|\bthird[- ]place\b/.test(value)) return "playoff";
  if (/\bfinal\b/.test(value) && !/semi/.test(value) && !/quarter/.test(value) && !/bronze/.test(value)) {
    return "final";
  }
  if (/semi/.test(value)) return "semi_final";
  if (/quarter/.test(value)) return "quarter_final";
  if (/play-?off/.test(value)) return "playoff";
  if (/pool\s+[a-z0-9]+/i.test(value)) return "regular";
  return defaultStage;
}

function isBracketPlaceholderTeam(name: string): boolean {
  return /^(winner|runner[- ]?up|loser|third place|fourth place)\b/i.test(name.trim());
}

/** Parse try/conversion/penalty/drop lists from {{rugby box}} scoring params. */
export function parseRugbyboxScoringEvents(params: Record<string, string>): WikipediaScoringEvent[] {
  const events: WikipediaScoringEvent[] = [];
  const fields: Array<{ key: string; eventType: WikipediaScoringEvent["eventType"]; teamSide: "home" | "away" }> = [
    { key: "try1", eventType: "try", teamSide: "home" },
    { key: "con1", eventType: "conversion", teamSide: "home" },
    { key: "pen1", eventType: "penalty", teamSide: "home" },
    { key: "drop1", eventType: "drop_goal", teamSide: "home" },
    { key: "try2", eventType: "try", teamSide: "away" },
    { key: "con2", eventType: "conversion", teamSide: "away" },
    { key: "pen2", eventType: "penalty", teamSide: "away" },
    { key: "drop2", eventType: "drop_goal", teamSide: "away" },
  ];

  for (const field of fields) {
    const raw = params[field.key];
    if (!raw?.trim()) continue;
    const chunks = raw.split(/<br\s*\/?>/i).map((c) => c.trim()).filter(Boolean);
    for (const chunk of chunks) {
      const playerMatch =
        chunk.match(/\[\[([^\]|]+)\|([^\]]+)\]\]/) ?? chunk.match(/\[\[([^\]]+)\]\]/);
      const playerName = playerMatch
        ? (playerMatch[2] ?? playerMatch[1] ?? "").trim()
        : stripWikiMarkup(chunk.replace(/\d+\s*'.*$/s, "")).trim();
      if (!playerName) continue;

      const minutes = [...chunk.matchAll(/(\d+)\s*'/g)].map((m) => Number.parseInt(m[1]!, 10));
      const converted =
        field.eventType === "try"
          ? /\bc\b/i.test(chunk.replace(/\[\[.*?\]\]/g, ""))
            ? true
            : /\bm\b/i.test(chunk.replace(/\[\[.*?\]\]/g, ""))
              ? false
              : null
          : null;

      if (!minutes.length) {
        events.push({
          eventType: field.eventType,
          teamSide: field.teamSide,
          minute: 0,
          playerName,
          ...(converted != null ? { converted } : {}),
        });
        continue;
      }
      for (const minute of minutes) {
        events.push({
          eventType: field.eventType,
          teamSide: field.teamSide,
          minute,
          playerName,
          ...(converted != null ? { converted } : {}),
        });
      }
    }
  }

  return events.sort((a, b) => a.minute - b.minute || a.teamSide.localeCompare(b.teamSide));
}

function formatScoringNotes(events: WikipediaScoringEvent[]): string | null {
  if (!events.length) return null;
  const groups: Array<[string, WikipediaScoringEvent["eventType"]]> = [
    ["Tries", "try"],
    ["Cons", "conversion"],
    ["Pens", "penalty"],
    ["Drops", "drop_goal"],
  ];
  const parts: string[] = [];
  for (const [label, type] of groups) {
    const rows = events.filter((e) => e.eventType === type);
    if (!rows.length) continue;
    const text = rows
      .map((e) => {
        const side = e.teamSide === "home" ? "H" : "A";
        const min = e.minute > 0 ? ` ${e.minute}'` : "";
        return `${e.playerName}${min} (${side})`;
      })
      .join(", ");
    parts.push(`${label}: ${text}`);
  }
  return parts.join(" · ") || null;
}

function parseStadiumName(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const firstLink = raw.match(/\[\[([^\]]+)\]\]/)?.[0];
  const label = parseWikiLinkLabel(firstLink ?? raw);
  return label || null;
}

export function parseRugbyboxFixtures(
  wikitext: string,
  options: { defaultRound?: string | null; defaultStage?: WikipediaSeasonStage; matchweek?: number | null } = {},
): WikipediaFixtureRow[] {
  // Deduplicate: "rugby box" would also match inside "#invoke:rugby box" start needles if
  // we only used indexOf clumsily; extract by each distinct template form then unique by block text.
  const blocks = [
    ...extractTemplateBlocks(wikitext, "Rugbybox"),
    ...extractTemplateBlocks(wikitext, "rugbybox"),
    ...extractTemplateBlocks(wikitext, "Rugby box"),
    ...extractTemplateBlocks(wikitext, "rugby box"),
    ...extractTemplateBlocks(wikitext, "#invoke:rugby box"),
    ...extractTemplateBlocks(wikitext, "#invoke:Rugby box"),
  ];
  const seen = new Set<string>();
  const fixtures: WikipediaFixtureRow[] = [];

  for (const block of blocks) {
    if (seen.has(block)) continue;
    seen.add(block);
    const params = parseTemplateParams(block);
    const home = parseWikiTeamLabel(params.home ?? params.team1 ?? "");
    const away = parseWikiTeamLabel(params.away ?? params.team2 ?? "");
    if (!home || !away) continue;
    if (isBracketPlaceholderTeam(home) || isBracketPlaceholderTeam(away)) continue;

    const score = parseScore(params.score);
    const date = parseWikiDate(params.date);
    const time = parseWikiTime(params.time);
    const round = options.defaultRound ?? null;
    const stage = stageFromRoundLabel(round, options.defaultStage ?? "regular");
    const postponed = /postponed/i.test(params.score ?? "") || /postponed/i.test(params.note ?? "");
    const cancelled = /cancelled|canceled|abandoned/i.test(params.score ?? "");
    const scoringEvents = parseRugbyboxScoringEvents(params);
    const scoringNotes = formatScoringNotes(scoringEvents);
    const noteBits = [params.note ? stripWikiMarkup(params.note) : null, scoringNotes].filter(Boolean);

    fixtures.push({
      date,
      kickoffAt: combineDateTimeUtc(date, time),
      homeTeam: home,
      awayTeam: away,
      homeScore: score?.home ?? null,
      awayScore: score?.away ?? null,
      venueName: parseStadiumName(params.stadium),
      attendance: parseAttendance(params.attendance),
      refereeName: params.referee ? parseWikiLinkLabel(params.referee) : null,
      round,
      matchweek: options.matchweek ?? null,
      stage,
      status: cancelled
        ? "cancelled"
        : postponed
          ? "postponed"
          : score
            ? "full_time"
            : "scheduled",
      notes: noteBits.length ? noteBits.join(" · ") : null,
      scoringEvents,
    });
  }

  return fixtures;
}

/** Strip leading wiki table cell attributes (`align=right|…`). */
function wikiTableCellContent(raw: string): string {
  let cell = raw.trim();
  while (/^[a-zA-Z_][\w-]*=/.test(cell)) {
    const pipe = cell.indexOf("|");
    if (pipe < 0) break;
    const before = cell.slice(0, pipe);
    if (!/^[a-zA-Z_][\w-]*=[^\n|]*$/.test(before)) break;
    cell = cell.slice(pipe + 1).trim();
  }
  return cell;
}

/**
 * Parse international result tables like Nations Cup:
 * `|align=right|4 July 2026||align=right|{{ru-rt|URU}}||align=center|[[…|34–41]]||{{ru|GEO}}||venue`
 */
export function parseResultTableFixtures(
  wikitext: string,
  options: { defaultRound?: string | null; defaultStage?: WikipediaSeasonStage; matchweek?: number | null } = {},
): WikipediaFixtureRow[] {
  const fixtures: WikipediaFixtureRow[] = [];
  const round = options.defaultRound ?? null;
  const stage = stageFromRoundLabel(round, options.defaultStage ?? "regular");

  for (const rowMatch of wikitext.matchAll(/^\|(?![-+}])(.+)$/gm)) {
    const line = rowMatch[1] ?? "";
    if (/^!/.test(line.trim()) || /width\s*=/i.test(line)) continue;

    const cells = line.split("||").map((part) => wikiTableCellContent(part.replace(/^\|/, "")));

    if (cells.length < 4) continue;

    let dateIdx = -1;
    for (let i = 0; i < Math.min(cells.length, 3); i++) {
      if (parseWikiDate(cells[i])) {
        dateIdx = i;
        break;
      }
    }
    if (dateIdx < 0 || dateIdx + 3 >= cells.length) continue;

    const date = parseWikiDate(cells[dateIdx]!);
    const home = parseWikiTeamLabel(cells[dateIdx + 1] ?? "");
    const scoreCell = cells[dateIdx + 2] ?? "";
    const away = parseWikiTeamLabel(cells[dateIdx + 3] ?? "");
    if (!home || !away) continue;
    if (isBracketPlaceholderTeam(home) || isBracketPlaceholderTeam(away)) continue;

    const score = parseScore(scoreCell);
    const postponed = /postponed/i.test(scoreCell);
    const cancelled = /cancelled|canceled|abandoned/i.test(scoreCell);
    const venueRaw = cells[dateIdx + 4] ?? null;
    const venueName = venueRaw
      ? parseWikiLinkLabel(venueRaw).replace(/^TBA\b.*$/i, "").trim() || null
      : null;

    fixtures.push({
      date,
      kickoffAt: combineDateTimeUtc(date, null),
      homeTeam: home,
      awayTeam: away,
      homeScore: score?.home ?? null,
      awayScore: score?.away ?? null,
      venueName,
      attendance: null,
      refereeName: null,
      round,
      matchweek: options.matchweek ?? null,
      stage,
      status: cancelled ? "cancelled" : postponed ? "postponed" : score ? "full_time" : "scheduled",
      notes: null,
    });
  }

  return fixtures;
}

const INFOBOX_CHAMPION_TEMPLATES = [
  "Infobox rugby union season",
  "Infobox European Rugby Cup season",
  "Infobox European Cup Rugby season",
  "Infobox rugby tournament",
  "Infobox Rugby World Cup",
  "Infobox rugby world cup",
];

export function parseInfoboxChampion(wikitext: string): {
  championName: string | null;
  runnersUpName: string | null;
  competitionHint: string | null;
} {
  const blocks = INFOBOX_CHAMPION_TEMPLATES.flatMap((name) => extractTemplateBlocks(wikitext, name));
  if (!blocks.length) {
    return { championName: null, runnersUpName: null, competitionHint: null };
  }
  const params = parseTemplateParams(blocks[0]!);
  const championRaw = params.champions ?? params.champion ?? "";
  const runnersRaw =
    params.runnersup ?? params.runnerup ?? params["runner-up"] ?? params["runners-up"] ?? "";
  return {
    championName: championRaw ? parseWikiTeamLabel(championRaw) : null,
    runnersUpName: runnersRaw ? parseWikiTeamLabel(String(runnersRaw)) : null,
    competitionHint: params.name ? stripWikiMarkup(params.name) : null,
  };
}

function extractWikitableBlocks(wikitext: string): string[] {
  const blocks: string[] = [];
  let searchFrom = 0;
  while (true) {
    const start = wikitext.indexOf("{|", searchFrom);
    if (start < 0) break;
    const end = wikitext.indexOf("|}", start);
    if (end < 0) break;
    blocks.push(wikitext.slice(start, end + 2));
    searchFrom = end + 2;
  }
  return blocks;
}

function parseWikitableRowCells(row: string): string[] {
  const trimmed = row.replace(/^\|-[^\n]*\n?/, "").trim();
  if (!trimmed.startsWith("|")) return [];
  const cells: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch === "{" && trimmed[i + 1] === "{") {
      depth += 1;
      current += "{{";
      i += 1;
      continue;
    }
    if (ch === "}" && trimmed[i + 1] === "}") {
      depth -= 1;
      current += "}}";
      i += 1;
      continue;
    }
    if (ch === "[" && trimmed[i + 1] === "[") {
      depth += 1;
      current += "[[";
      i += 1;
      continue;
    }
    if (ch === "]" && trimmed[i + 1] === "]") {
      depth -= 1;
      current += "]]";
      i += 1;
      continue;
    }
    if (ch === "|" && depth === 0) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) cells.push(current.trim());
  return cells;
}

function isWikitableHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    /\bteam\b/.test(joined) &&
    (/\bpts?\b/.test(joined) || /\bplayed\b/.test(joined) || /\bp\b/.test(joined))
  );
}

function parseStandingRowFromCells(cells: string[], rank: number): WikipediaStandingRow | null {
  const teamCell = cells.find((cell) => /\{\{(?:ru|Ru)/i.test(cell) || /\[\[/.test(cell)) ?? cells[0];
  if (!teamCell) return null;
  const linkCount = (teamCell.match(/\[\[/g) ?? []).length;
  if (linkCount > 1) return null;
  const teamName = parseWikiTeamLabel(teamCell)
    .replace(/^\*+/, "")
    .replace(/\s*\(C\)\s*$/i, "")
    .trim();
  if (!teamName || /^(seed|rank|pool|qualification)$/i.test(teamName)) return null;
  if (/^\d+$/.test(teamName) || /^#?\d{1,3}$/.test(teamName)) return null;

  const numbers = cells
    .flatMap((cell) => stripWikiMarkup(cell).split(/\|\||\|/))
    .map((value) => value.replace(/[^\d+-]/g, "").trim())
    .filter((value) => /^-?\d+$/.test(value))
    .map((value) => Number.parseInt(value, 10));

  const numericCells = cells
    .slice(1)
    .map((cell) => {
      const cleaned = stripWikiMarkup(cell).replace(/,/g, "");
      if (!/^-?\d+$/.test(cleaned)) return null;
      return Number.parseInt(cleaned, 10);
    })
    .filter((value): value is number => value != null);

  const played = numericCells[0] ?? numbers[0] ?? 0;
  const won = numericCells[1] ?? numbers[1] ?? 0;
  const draw = numericCells[2] ?? numbers[2] ?? 0;
  const lost = numericCells[3] ?? numbers[3] ?? 0;
  const pointsFor = numericCells.find((_, idx) => idx >= 4 && idx <= 8) ?? 0;
  const pointsAgainst = numericCells.find((_, idx) => idx >= 5 && idx <= 9) ?? 0;
  const points = numericCells[numericCells.length - 1] ?? won * 2 + draw;

  return {
    rank,
    teamName,
    played,
    won,
    draw,
    lost,
    pointsFor,
    pointsAgainst,
    pointsDiff: pointsFor - pointsAgainst,
    triesFor: null,
    tryBonusPoints: 0,
    losingBonusPoints: 0,
    bonusPoints: 0,
    pointsDeduction: 0,
    points,
    isChampionMarker: /\(C\)/i.test(teamCell),
    qualificationNotes: null,
  };
}

/** Parse Tri Nations / Rugby Championship points tables under ==Table==. */
export function parseInternationalTableStandings(wikitext: string): WikipediaStandingRow[] {
  const section = wikitext.match(/==\s*Table\s*==([\s\S]*?)(?=\n==[^=]|$)/i);
  if (!section) return [];

  const rows: WikipediaStandingRow[] = [];
  const seenTeams = new Set<string>();

  for (const block of extractWikitableBlocks(section[1]!)) {
    const rowChunks = block.split(/\n\|-/).slice(1);
    for (const chunk of rowChunks) {
      const cells = parseWikitableRowCells(`|-${chunk}`);
      if (!cells.length || isWikitableHeaderRow(cells)) continue;

      const place = Number.parseInt(stripWikiMarkup(cells[0] ?? ""), 10);
      const nationCell = cells.find((cell) => /\{\{(?:ru|Ru)/i.test(cell)) ?? cells[1];
      if (!nationCell) continue;
      const teamName = parseWikiTeamLabel(nationCell).trim();
      if (!teamName || /^(place|nation|team)$/i.test(teamName)) continue;

      const key = teamName.toLowerCase();
      if (seenTeams.has(key)) continue;
      seenTeams.add(key);

      const numbers = cells
        .slice(2)
        .map((cell) => {
          const cleaned = stripWikiMarkup(cell).replace(/[^\d+-]/g, "");
          return /^-?\d+$/.test(cleaned) ? Number.parseInt(cleaned, 10) : null;
        })
        .filter((value): value is number => value != null);

      const played = numbers[0] ?? 0;
      const won = numbers[1] ?? 0;
      const draw = numbers[2] ?? 0;
      const lost = numbers[3] ?? 0;
      const pointsFor = numbers[4] ?? 0;
      const pointsAgainst = numbers[5] ?? 0;
      const tryBonus = numbers[6] ?? 0;
      const losingBonus = numbers[7] ?? 0;
      const points = numbers[8] ?? won * 4 + draw * 2 + tryBonus + losingBonus;

      rows.push({
        rank: Number.isFinite(place) ? place : rows.length + 1,
        teamName,
        played,
        won,
        draw,
        lost,
        pointsFor,
        pointsAgainst,
        pointsDiff: pointsFor - pointsAgainst,
        triesFor: null,
        tryBonusPoints: tryBonus,
        losingBonusPoints: losingBonus,
        bonusPoints: tryBonus + losingBonus,
        pointsDeduction: 0,
        points,
        isChampionMarker: false,
        qualificationNotes: null,
      });
    }
  }

  return rows.sort((a, b) => a.rank - b.rank);
}

/** Parse pool-stage wikitables (Challenge Cup Pool 1 / RWC Pool A). */
export function parsePoolWikitableStandings(wikitext: string): WikipediaStandingRow[] {
  const rows: WikipediaStandingRow[] = [];
  const seenTeams = new Set<string>();

  const poolSections = [
    ...wikitext.matchAll(/===\s*Pool\s+([A-Z]|\d+)\s*===([\s\S]*?)(?=\n===|\n==[^=]|$)/gi),
  ];
  if (!poolSections.length) return rows;

  for (const match of poolSections) {
    const body = match[2]!;
    for (const block of extractWikitableBlocks(body)) {
      const rowChunks = block.split(/\n\|-/).slice(1);
      let rank = 0;
      for (const chunk of rowChunks) {
        const cells = parseWikitableRowCells(`|-${chunk}`);
        if (!cells.length || isWikitableHeaderRow(cells)) continue;
        rank += 1;
        const parsed = parseStandingRowFromCells(cells, rank);
        if (!parsed) continue;
        if (isBracketPlaceholderTeam(parsed.teamName)) continue;
        const key = parsed.teamName.toLowerCase();
        if (seenTeams.has(key)) continue;
        seenTeams.add(key);
        rows.push(parsed);
      }
    }
  }

  return rows;
}

/** Parse the modern "Team details" qualification table when pool standings are absent. */
export function parseTeamDetailsWikitableStandings(wikitext: string): WikipediaStandingRow[] {
  const section = wikitext.match(/===\s*Team details\s*===([\s\S]*?)(?=\n===|\n==[^=]|$)/i);
  if (!section) return [];

  const rows: WikipediaStandingRow[] = [];
  const seenTeams = new Set<string>();
  let rank = 0;

  for (const block of extractWikitableBlocks(section[1]!)) {
    const rowChunks = block.split(/\n\|-/).slice(1);
    for (const chunk of rowChunks) {
      const cells = parseWikitableRowCells(`|-${chunk}`);
      if (!cells.length || isWikitableHeaderRow(cells)) continue;
      const teamCell = cells.find((cell) => /\[\[/.test(cell));
      if (!teamCell || (teamCell.match(/\[\[/g) ?? []).length !== 1) continue;
      const teamName = parseWikiLinkLabel(teamCell).trim();
      if (!teamName || /^entering\b/i.test(teamName)) continue;
      const key = teamName.toLowerCase();
      if (seenTeams.has(key)) continue;
      seenTeams.add(key);
      rank += 1;
      rows.push({
        rank,
        teamName,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        triesFor: null,
        tryBonusPoints: 0,
        losingBonusPoints: 0,
        bonusPoints: 0,
        pointsDeduction: 0,
        points: 0,
        isChampionMarker: false,
        qualificationNotes: null,
      });
    }
  }

  return rows;
}

export function standingsFromFixtureTeams(
  fixtures: WikipediaFixtureRow[],
  playoffFixtures: WikipediaFixtureRow[] = [],
): WikipediaStandingRow[] {
  const teams = new Set<string>();
  for (const row of [...fixtures, ...playoffFixtures]) {
    if (row.homeTeam) teams.add(row.homeTeam);
    if (row.awayTeam) teams.add(row.awayTeam);
  }

  return [...teams]
    .sort((a, b) => a.localeCompare(b))
    .map((teamName, index) => ({
      rank: index + 1,
      teamName,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      triesFor: null,
      tryBonusPoints: 0,
      losingBonusPoints: 0,
      bonusPoints: 0,
      pointsDeduction: 0,
      points: 0,
      isChampionMarker: false,
      qualificationNotes: null,
    }));
}

function dedupeStandings(rows: WikipediaStandingRow[]): WikipediaStandingRow[] {
  const seen = new Set<string>();
  const out: WikipediaStandingRow[] = [];
  for (const row of rows) {
    const key = row.teamName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...row, rank: out.length + 1 });
  }
  return out;
}

export function extractPoolTableTemplateNames(wikitext: string): string[] {
  const names = new Set<string>();
  for (const match of wikitext.matchAll(/\{\{\s*([^}|{]+?\s+Pool\s+(?:[A-Z]|\d+)\s+table)\s*\}\}/gi)) {
    names.add(match[1]!.trim());
  }
  return [...names];
}

/** Titles of RWC/Challenge Cup pool subpages transcluded or linked from a season page. */
export function extractPoolSubpageTitles(wikitext: string, pageTitle?: string): string[] {
  const titles = new Set<string>();

  for (const match of wikitext.matchAll(/\{\{\s*:\s*([^}|{\n]+?)\s*[|}]/g)) {
    const title = match[1]!.trim();
    if (/pool\s+[a-z0-9]+/i.test(title)) titles.add(title);
  }
  for (const match of wikitext.matchAll(/\{\{\s*Main\s*\|\s*([^}|{\n]+)/gi)) {
    const title = match[1]!.trim();
    if (/pool\s+[a-z0-9]+/i.test(title)) titles.add(title);
  }
  for (const match of wikitext.matchAll(/\{\{\s*#section:\s*([^}|{\n]+)/gi)) {
    const title = match[1]!.trim();
    if (/pool\s+[a-z0-9]+/i.test(title)) titles.add(title);
  }
  for (const match of wikitext.matchAll(/\[\[[^\]|#]+?Pool\s+[A-Z0-9]+(?:\|[^\]]+)?\]\]/gi)) {
    const inner = match[0].replace(/^\[\[|\]\]$/g, "");
    const title = inner.split("|")[0]!.trim();
    if (/pool\s+[a-z0-9]+/i.test(title)) titles.add(title);
  }

  // Fallback: invent pool subpage titles from year + Pool A–D / 1–4 headings when Main links are absent.
  if (!titles.size && pageTitle) {
    const year = detectSeasonStartYearFromTitle(pageTitle);
    if (year != null) {
      for (const match of wikitext.matchAll(/===\s*Pool\s+([A-Z]|\d+)\s*===/gi)) {
        titles.add(`${year} Rugby World Cup Pool ${match[1]!.toUpperCase()}`);
      }
    }
  }

  return [...titles];
}

async function resolveStandingsFromWikitext(
  wikitext: string,
  fetchTemplate: (templateName: string) => Promise<string>,
): Promise<WikipediaStandingRow[]> {
  const direct = parseSportsTableModule(wikitext);
  if (direct.length) return dedupeStandings(direct);

  const internationalTable = parseInternationalTableStandings(wikitext);
  if (internationalTable.length) return internationalTable;

  const templateNames = extractPoolTableTemplateNames(wikitext);
  const fromTemplates: WikipediaStandingRow[] = [];
  for (const templateName of templateNames) {
    try {
      const templateWikitext = await fetchTemplate(templateName);
      fromTemplates.push(...parseSportsTableModule(templateWikitext));
    } catch {
      // Skip missing or rate-limited templates; other sources may still apply.
    }
  }
  if (fromTemplates.length) return dedupeStandings(fromTemplates);

  const poolRows = parsePoolWikitableStandings(wikitext);
  if (poolRows.length) return poolRows;

  const teamDetailsRows = parseTeamDetailsWikitableStandings(wikitext);
  if (teamDetailsRows.length) return teamDetailsRows;

  return [];
}

function fixtureKey(f: WikipediaFixtureRow): string {
  return [
    f.date ?? "",
    f.homeTeam.toLowerCase(),
    f.awayTeam.toLowerCase(),
    f.homeScore ?? "",
    f.awayScore ?? "",
    f.stage,
  ].join("|");
}

function dedupeFixtures(rows: WikipediaFixtureRow[]): WikipediaFixtureRow[] {
  const seen = new Set<string>();
  const out: WikipediaFixtureRow[] = [];
  for (const row of rows) {
    const key = fixtureKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function splitByRoundSections(wikitext: string): Array<{ round: string; matchweek: number | null; body: string }> {
  const headings = [
    ...wikitext.matchAll(
      /^(={2,})\s*(Pool\s+[A-Z0-9]+|Round\s+(\d+)|Quarter-?finals?|Semi-?finals?|Bronze\s+final|Third[- ]place(?:\s+play-?off)?|Final|Fixtures|Results|Matches)\s*\1/gim,
    ),
  ];
  if (!headings.length) {
    return [{ round: "Regular season", matchweek: null, body: wikitext }];
  }

  const sections: Array<{ round: string; matchweek: number | null; body: string }> = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]!;
    const start = heading.index! + heading[0].length;
    const end = i + 1 < headings.length ? headings[i + 1]!.index! : wikitext.length;
    const label = heading[2]!;
    const week = heading[3] ? Number.parseInt(heading[3], 10) : null;
    let round = label;
    if (/semi/i.test(label)) round = "Semi-finals";
    else if (/quarter/i.test(label)) round = "Quarter-finals";
    else if (/bronze/i.test(label)) round = "Bronze final";
    else if (/third[- ]place/i.test(label)) round = "Third-place play-off";
    else if (/^final$/i.test(label)) round = "Final";
    else if (/^matches$/i.test(label)) round = "Pool stage";
    sections.push({
      round,
      matchweek: week,
      body: wikitext.slice(start, end),
    });
  }
  return sections;
}

export function parsePremiershipSeasonWikitext(input: {
  pageTitle: string;
  wikipediaUrl: string;
  revisionId: number | null;
  wikitext: string;
  standings?: WikipediaStandingRow[];
}): WikipediaSeasonPageParse {
  const warnings: string[] = [];
  const { championName, runnersUpName, competitionHint } = parseInfoboxChampion(input.wikitext);
  const seasonStartYear = detectSeasonStartYearFromTitle(input.pageTitle);
  if (seasonStartYear == null) warnings.push("Could not detect season start year from page title");

  const standingsInput = input.standings ?? parseSportsTableModule(input.wikitext);
  let standings = standingsInput;
  if (!standings.length) {
    standings = parseInternationalTableStandings(input.wikitext);
  }
  if (!standings.length) {
    standings = parsePoolWikitableStandings(input.wikitext);
  }
  if (!standings.length) {
    standings = parseTeamDetailsWikitableStandings(input.wikitext);
  }
  if (!standings.length) warnings.push("No standings table found");

  const fixtureSections = splitByRoundSections(input.wikitext);
  const fixturesRaw: WikipediaFixtureRow[] = [];
  const playoffRaw: WikipediaFixtureRow[] = [];

  for (const section of fixtureSections) {
    const isPlayoff =
      /quarter|semi|bronze|third.?place|final/i.test(section.round) &&
      !/^Round\s+\d+/i.test(section.round) &&
      !/^Pool\b/i.test(section.round);
    const opts = {
      defaultRound: section.round,
      defaultStage: isPlayoff ? stageFromRoundLabel(section.round, "playoff") : ("regular" as const),
      matchweek: section.matchweek,
    };
    const parsed = [
      ...parseRugbyboxFixtures(section.body, opts),
      ...parseResultTableFixtures(section.body, opts),
    ];
    if (isPlayoff) playoffRaw.push(...parsed);
    else fixturesRaw.push(...parsed);
  }

  const fixtures = dedupeFixtures(fixturesRaw);
  const playoffFixtures = dedupeFixtures(playoffRaw);

  if (!standings.length) {
    standings = standingsFromFixtureTeams(fixtures, playoffFixtures);
    if (standings.length) warnings.push("Standings derived from fixture participants");
  }

  const venues = [
    ...new Set(
      [...fixtures, ...playoffFixtures]
        .map((f) => f.venueName)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const referees = [
    ...new Set(
      [...fixtures, ...playoffFixtures]
        .map((f) => f.refereeName)
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  if (!fixtures.length) warnings.push("No regular-season fixtures found (Rugbybox or result tables)");
  if (!playoffFixtures.length) warnings.push("No playoff fixtures found");
  if (!championName) warnings.push("No champion found in infobox");

  return {
    pageTitle: input.pageTitle,
    wikipediaUrl: input.wikipediaUrl,
    revisionId: input.revisionId,
    seasonStartYear,
    competitionHint,
    championName,
    runnersUpName,
    standings,
    fixtures,
    playoffFixtures,
    venues,
    referees,
    warnings,
  };
}

export async function parseWikipediaSeasonPage(urlOrTitle: string): Promise<WikipediaSeasonPageParse> {
  const { fetchWikipediaSeasonPage } = await import("./fetch-season-page");
  const page = await fetchWikipediaSeasonPage(urlOrTitle);

  const poolTitles = extractPoolSubpageTitles(page.wikitext, page.pageTitle);
  const poolWikitextParts: string[] = [];
  for (const title of poolTitles) {
    try {
      const poolPage = await fetchWikipediaSeasonPage(title);
      poolWikitextParts.push(`\n== ${poolPage.pageTitle} ==\n===Pool ${title.match(/Pool\s+([A-Z0-9]+)/i)?.[1] ?? ""}===\n${poolPage.wikitext}`);
    } catch {
      // Missing or rate-limited pool pages — continue with what we have.
    }
  }
  const combinedWikitext =
    poolWikitextParts.length > 0
      ? `${page.wikitext}\n${poolWikitextParts.join("\n")}`
      : page.wikitext;

  const standings = await resolveStandingsFromWikitext(combinedWikitext, async (templateName) => {
    const templatePage = await fetchWikipediaSeasonPage(`Template:${templateName}`);
    return templatePage.wikitext;
  });

  const filteredStandings = standings.filter((row) => !isBracketPlaceholderTeam(row.teamName));
  return parsePremiershipSeasonWikitext({
    ...page,
    wikitext: combinedWikitext,
    standings: filteredStandings,
  });
}
