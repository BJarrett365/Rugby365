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
    const winPoints = Number.parseInt(params.winpoints ?? params.win_points ?? "4", 10);
    const drawPoints = Number.parseInt(params.drawpoints ?? params.draw_points ?? "2", 10);
    const showBonus = !/^(no|false|0)$/i.test((params.show_bonus ?? "yes").trim());
    const computedPoints =
      won * (Number.isFinite(winPoints) ? winPoints : 4) +
      draw * (Number.isFinite(drawPoints) ? drawPoints : 2) +
      (showBonus ? tryBonusPoints + losingBonusPoints : 0) -
      pointsDeduction;
    const points =
      (ptsExplicit != null ? Number.parseInt(ptsExplicit, 10) : null) ??
      (Number.isFinite(winPoints) || Number.isFinite(drawPoints) || !showBonus
        ? computedPoints
        : rugbyPoints({
            won,
            draw,
            tryBonusPoints,
            losingBonusPoints,
            pointsDeduction,
          }));

    const sectionPool =
      (params.section ?? "").match(/(?:pool|conference)\s*([A-Z]|\d+)/i)?.[1]?.toUpperCase() ?? null;
    const sectionKind = /conference/i.test(params.section ?? "")
      ? ("conference" as const)
      : sectionPool
        ? ("pool" as const)
        : null;

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
      tryBonusPoints: showBonus ? tryBonusPoints : 0,
      losingBonusPoints: showBonus ? losingBonusPoints : 0,
      bonusPoints: showBonus ? bonusPoints : 0,
      pointsDeduction,
      points,
      isChampionMarker: /\(C\)/i.test(entry.nameRaw) || /^c$/i.test(params[`status_${codeKey}`] ?? ""),
      qualificationNotes: null,
      pool: sectionPool,
      groupKind: sectionKind,
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
  // Keep pool-local ranks when modules are sectioned (Celtic League 2001–02).
  if (rows.some((row) => row.pool)) return rows;
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
  while (searchFrom < wikitext.length) {
    const start = wikitext.indexOf("{|", searchFrom);
    if (start < 0) break;
    let depth = 0;
    let i = start;
    let end = -1;
    while (i < wikitext.length) {
      if (wikitext.startsWith("{|", i)) {
        depth += 1;
        i += 2;
        continue;
      }
      if (wikitext.startsWith("|}", i)) {
        depth -= 1;
        i += 2;
        if (depth === 0) {
          end = i;
          break;
        }
        continue;
      }
      i += 1;
    }
    if (end < 0) break;
    blocks.push(wikitext.slice(start, end));
    searchFrom = end;
  }
  return blocks;
}

/** Strip MediaWiki cell attributes (`align=left|`, `align="left"|`, `style=...|`). */
function stripWikitableCellAttrs(cell: string): string {
  let s = cell.trim();
  while (true) {
    const m = s.match(/^[A-Za-z_:][\w:-]*=(?:"[^"]*"|'[^']*'|[^\s|]+)\s*\|/);
    if (!m) break;
    s = s.slice(m[0].length).trim();
  }
  return s;
}

/**
 * Parse one wikitable data/header row into cell contents.
 * Handles MediaWiki `||` / `!!` separators and `attr=value|content` cells
 * (e.g. Celtic League `|1||align=left|{{flagicon|WAL}} [[Scarlets|Llanelli Scarlets]]`).
 */
function parseWikitableRowCells(row: string): string[] {
  let body = row.replace(/^\|-/, "");
  const cells: string[] = [];

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    // Row-level attributes alone (e.g. bgcolor=#d8ffeb) — not a cell line.
    if (!line.startsWith("|") && !line.startsWith("!")) {
      if (/^[A-Za-z_][\w-]*=/.test(line)) continue;
      continue;
    }

    const content = line.replace(/^[|!]+/, "");
    // Split on || / !! outside templates and wiki links.
    const segments: string[] = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i]!;
      const next = content[i + 1];
      if (ch === "{" && next === "{") {
        depth += 1;
        current += "{{";
        i += 1;
        continue;
      }
      if (ch === "}" && next === "}") {
        depth -= 1;
        current += "}}";
        i += 1;
        continue;
      }
      if (ch === "[" && next === "[") {
        depth += 1;
        current += "[[";
        i += 1;
        continue;
      }
      if (ch === "]" && next === "]") {
        depth -= 1;
        current += "]]";
        i += 1;
        continue;
      }
      if (depth === 0 && ((ch === "|" && next === "|") || (ch === "!" && next === "!"))) {
        segments.push(current.trim());
        current = "";
        i += 1;
        continue;
      }
      current += ch;
    }
    if (current.trim() || segments.length === 0) segments.push(current.trim());

    for (const seg of segments) {
      const cleaned = stripWikitableCellAttrs(seg);
      // Keep empty only when it is an intentional blank between || markers mid-row
      // (rare); drop trailing empties from formatting noise.
      if (cleaned === "" && cells.length === 0) continue;
      cells.push(cleaned);
    }
  }

  while (cells.length && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function isJunkStandingTeamName(name: string): boolean {
  const t = name.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/bonus\s+point\s+system/i.test(t)) return true;
  if (/^source\s*:/i.test(t)) return true;
  if (/^under\s+the\b/i.test(t)) return true;
  if (/\bcolspan\b/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.length > 120) return true;
  return false;
}

function isWikitableHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    (/\bteam\b/.test(joined) || /\bclub\b/.test(joined) || /\bnation\b/.test(joined)) &&
    (/\bpts?\b/.test(joined) || /\bpoints\b/.test(joined) || /\bplayed\b/.test(joined) || /\bp\b/.test(joined) || /\bpld\b/.test(joined))
  );
}

/** Detect Pool/Conference section banners inside a league wikitable. */
function parseSplitBanner(
  cells: string[],
  rawChunk: string,
): { kind: "pool" | "conference"; key: string } | null {
  const joined = stripWikiMarkup(cells.join(" "));
  if (!joined) return null;
  if (/legend|key\b|source:|bonus point|qualification/i.test(joined)) return null;
  const isBanner =
    cells.length <= 2 ||
    /colspan\s*=/i.test(rawChunk) ||
    /^conference\s+[a-z]$/i.test(joined) ||
    /^pool\s+[a-z0-9]+$/i.test(joined);
  if (!isBanner) return null;
  const conference = joined.match(/\bConference\s+([A-Z])\b/i)?.[1];
  if (conference) return { kind: "conference", key: conference.toUpperCase() };
  const pool = joined.match(/\bPool\s+([A-Z]|\d+)\b/i)?.[1];
  if (pool) return { kind: "pool", key: pool.toUpperCase() };
  return null;
}

/** Parse any league standings wikitables (club tables, conference tables, templates). */
export function parseLeagueWikitableStandings(wikitext: string): WikipediaStandingRow[] {
  const rows: WikipediaStandingRow[] = [];
  const seenTeams = new Set<string>();

  for (const block of extractWikitableBlocks(wikitext)) {
    const rowChunks = block.split(/\n\|-/);
    let hasStandingHeader = false;
    let currentPool: string | null = null;
    let currentKind: "pool" | "conference" | null = null;
    for (const chunk of rowChunks) {
      const raw = chunk.startsWith("|") || chunk.startsWith("!") ? chunk : `|-${chunk}`;
      const cells = parseWikitableRowCells(raw);
      if (!cells.length) continue;

      // Conference/Pool banners often appear *before* the Team/P/W header (Pro14 templates).
      const banner = parseSplitBanner(cells, raw);
      if (banner) {
        currentKind = banner.kind;
        currentPool = banner.key;
        continue;
      }

      if (isWikitableHeaderRow(cells)) {
        hasStandingHeader = true;
        continue;
      }
      if (!hasStandingHeader) continue;

      if (cells.length <= 2 && /legend|key\b|source:|bonus point/i.test(cells.join(" "))) {
        continue;
      }

      const place = Number.parseInt(stripWikiMarkup(cells[0] ?? ""), 10);
      const parsed = parseStandingRowFromCells(
        cells,
        Number.isFinite(place) ? place : rows.length + 1,
      );
      if (!parsed) continue;
      const key = parsed.teamName.toLowerCase();
      if (seenTeams.has(key)) continue;
      seenTeams.add(key);
      rows.push({
        ...parsed,
        pool: currentPool,
        groupKind: currentKind,
      });
    }
  }

  // Keep conference/pool-local ranks when split banners were present.
  if (rows.some((row) => row.pool)) return rows;

  return rows
    .slice()
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.pointsDiff - a.pointsDiff ||
        a.teamName.localeCompare(b.teamName),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function parseWikiSignedInt(raw: string): number | null {
  const cleaned = stripWikiMarkup(raw)
    .replace(/,/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/[^\d+-]/g, "")
    .trim();
  if (!/^[-+]?\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

function standingNumbersFromCells(cells: string[]): number[] {
  const teamIdx = cells.findIndex(
    (cell) => /\{\{(?:ru|Ru)/i.test(cell) || /\{\{\s*flag\s*icon/i.test(cell) || /\[\[/.test(cell),
  );
  const start = teamIdx >= 0 ? teamIdx + 1 : cells[0] && /^\d+$/.test(stripWikiMarkup(cells[0])) ? 1 : 0;
  return cells
    .slice(start)
    .map((cell) => parseWikiSignedInt(cell))
    .filter((value): value is number => value != null);
}

/** Map P/W/D/L/.../Pts columns used by club + international league tables. */
function mapStandingStats(numbers: number[]): {
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number | null;
  tryBonusPoints: number;
  losingBonusPoints: number;
  points: number;
} {
  const played = numbers[0] ?? 0;
  const won = numbers[1] ?? 0;
  const draw = numbers[2] ?? 0;
  const lost = numbers[3] ?? 0;

  // Celtic / URC style: P W D L PF PA PD TF TA TBP LBP Pts (12)
  if (numbers.length >= 12) {
    const pointsFor = numbers[4] ?? 0;
    const pointsAgainst = numbers[5] ?? 0;
    const tryBonusPoints = numbers[9] ?? 0;
    const losingBonusPoints = numbers[10] ?? 0;
    const points = numbers[11] ?? rugbyPoints({ won, draw, tryBonusPoints, losingBonusPoints, pointsDeduction: 0 });
    return {
      played,
      won,
      draw,
      lost,
      pointsFor,
      pointsAgainst,
      triesFor: numbers[7] ?? null,
      tryBonusPoints,
      losingBonusPoints,
      points,
    };
  }

  // Compact: P W D L Pts (5) — Challenge Cup-style
  if (numbers.length === 5) {
    return {
      played,
      won,
      draw,
      lost,
      pointsFor: 0,
      pointsAgainst: 0,
      triesFor: null,
      tryBonusPoints: 0,
      losingBonusPoints: 0,
      points: numbers[4] ?? won * 2 + draw,
    };
  }

  // Tri Nations / RC style: P W D L PF PA TBP LBP Pts (9) or with PD (10)
  if (numbers.length >= 9) {
    const pointsFor = numbers[4] ?? 0;
    const pointsAgainst = numbers[5] ?? 0;
    // 10 cols: P W D L PF PA PD TBP LBP Pts
    if (numbers.length >= 10 && Math.abs(numbers[6] ?? 0) === Math.abs(pointsFor - pointsAgainst)) {
      const tryBonusPoints = numbers[7] ?? 0;
      const losingBonusPoints = numbers[8] ?? 0;
      const points = numbers[9] ?? rugbyPoints({ won, draw, tryBonusPoints, losingBonusPoints, pointsDeduction: 0 });
      return {
        played,
        won,
        draw,
        lost,
        pointsFor,
        pointsAgainst,
        triesFor: null,
        tryBonusPoints,
        losingBonusPoints,
        points,
      };
    }
    const tryBonusPoints = numbers[6] ?? 0;
    const losingBonusPoints = numbers[7] ?? 0;
    const points = numbers[8] ?? rugbyPoints({ won, draw, tryBonusPoints, losingBonusPoints, pointsDeduction: 0 });
    return {
      played,
      won,
      draw,
      lost,
      pointsFor,
      pointsAgainst,
      triesFor: null,
      tryBonusPoints,
      losingBonusPoints,
      points,
    };
  }

  const pointsFor = numbers[4] ?? 0;
  const pointsAgainst = numbers[5] ?? 0;
  const points = numbers[numbers.length - 1] ?? won * 2 + draw;
  return {
    played,
    won,
    draw,
    lost,
    pointsFor,
    pointsAgainst,
    triesFor: null,
    tryBonusPoints: 0,
    losingBonusPoints: 0,
    points,
  };
}

function parseStandingRowFromCells(cells: string[], rank: number): WikipediaStandingRow | null {
  const teamCell =
    cells.find(
      (cell) =>
        /\{\{(?:ru|Ru)/i.test(cell) ||
        /\{\{\s*flag\s*icon/i.test(cell) ||
        /\[\[/.test(cell),
    ) ??
    cells.find(
      (cell, idx) =>
        idx > 0 && stripWikiMarkup(cell).trim().length > 1 && !/^-?\d+$/.test(stripWikiMarkup(cell)),
    ) ??
    cells[0];
  if (!teamCell) return null;
  const linkCount = (teamCell.match(/\[\[/g) ?? []).length;
  if (linkCount > 1) return null;
  const teamName = parseWikiTeamLabel(teamCell)
    .replace(/^\*+/, "")
    .replace(/\s*\((?:C|CH|RU|SF|QF|PO|P|R|T)\)\s*$/i, "")
    .replace(/\s*\(C\)\s*$/i, "")
    .trim();
  if (!teamName || /^(seed|rank|pool|qualification|team|nation|place|club)$/i.test(teamName)) return null;
  if (/^\d+$/.test(teamName) || /^#?\d{1,3}$/.test(teamName)) return null;
  if (isJunkStandingTeamName(teamName)) return null;
  // Nested title rows like "Pro12 table" / "2017–18 Pro14 tables"
  if (/\b(table|tables)\b/i.test(teamName) && !/\[\[/.test(teamCell)) return null;

  const numbers = standingNumbersFromCells(cells);
  // Require real P/W/D/L (or at least played + points) so title/legend rows drop out.
  if (numbers.length < 4) return null;
  const stats = mapStandingStats(numbers);
  if (stats.played === 0 && stats.points === 0 && stats.won === 0) return null;

  return {
    rank,
    teamName,
    played: stats.played,
    won: stats.won,
    draw: stats.draw,
    lost: stats.lost,
    pointsFor: stats.pointsFor,
    pointsAgainst: stats.pointsAgainst,
    pointsDiff: stats.pointsFor - stats.pointsAgainst,
    triesFor: stats.triesFor,
    tryBonusPoints: stats.tryBonusPoints,
    losingBonusPoints: stats.losingBonusPoints,
    bonusPoints: stats.tryBonusPoints + stats.losingBonusPoints,
    pointsDeduction: 0,
    points: stats.points,
    isChampionMarker: /\(C(?:H)?\)/i.test(teamCell),
    qualificationNotes: null,
  };
}

/** Parse Tri Nations / Rugby Championship / Celtic League points tables under ==Table==. */
export function parseInternationalTableStandings(wikitext: string): WikipediaStandingRow[] {
  const section = wikitext.match(/==\s*Table\s*==([\s\S]*?)(?=\n==[^=]|$)/i);
  if (!section) return [];
  // Prefer full league-table parse (handles nested wiki + club flagicon rows).
  const fromLeague = parseLeagueWikitableStandings(section[1]!);
  if (fromLeague.length) return fromLeague;

  const rows: WikipediaStandingRow[] = [];
  const seenTeams = new Set<string>();

  for (const block of extractWikitableBlocks(section[1]!)) {
    const rowChunks = block.split(/\n\|-/).slice(1);
    for (const chunk of rowChunks) {
      const cells = parseWikitableRowCells(`|-${chunk}`);
      if (!cells.length || isWikitableHeaderRow(cells)) continue;

      const place = Number.parseInt(stripWikiMarkup(cells[0] ?? ""), 10);
      const parsed = parseStandingRowFromCells(cells, Number.isFinite(place) ? place : rows.length + 1);
      if (!parsed) continue;

      const key = parsed.teamName.toLowerCase();
      if (seenTeams.has(key)) continue;
      seenTeams.add(key);
      rows.push(parsed);
    }
  }

  return rows.sort((a, b) => a.rank - b.rank);
}

/** Parse pool-stage wikitables (Challenge Cup Pool 1 / RWC Pool A). */
export function parsePoolWikitableStandings(wikitext: string): WikipediaStandingRow[] {
  const rows: WikipediaStandingRow[] = [];
  const seenTeams = new Set<string>();

  // Celtic League uses "===Pool A Table==="; Challenge Cup / RWC use "===Pool 1===" / "===Pool A===".
  const poolSections = [
    ...wikitext.matchAll(
      /===\s*Pool\s+([A-Z]|\d+)(?:\s+Table)?\s*===([\s\S]*?)(?=\n===|\n==[^=]|$)/gi,
    ),
  ];
  if (!poolSections.length) return rows;

  for (const match of poolSections) {
    const poolKey = String(match[1] ?? "").trim().toUpperCase();
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
        rows.push({ ...parsed, pool: poolKey || null, groupKind: poolKey ? "pool" : null });
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
  const names = setFromTemplateMatches(wikitext, [
    // RWC / Challenge Cup pool table templates
    /\{\{\s*([^}|{]+?\s+Pool\s+(?:[A-Z]|\d+)\s+table)\s*\}\}/gi,
    // Pro12 / Pro14 / URC / Celtic League season table templates
    /\{\{\s*((?:19|20)\d{2}[–-]\d{2}\s+(?:Celtic League|Pro12|Pro14|United Rugby Championship)\s+league table)\s*\}\}/gi,
    // Generic "... league table" transclusions under ==Table==
    /\{\{\s*([^}|{\n]+?\s+league table)\s*\}\}/gi,
  ]);
  return [...names];
}

function setFromTemplateMatches(wikitext: string, patterns: RegExp[]): Set<string> {
  const names = new Set<string>();
  for (const pattern of patterns) {
    for (const match of wikitext.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (!name) continue;
      // Skip non-standings templates that happen to contain "table"
      if (/match summary|fixture|results?/i.test(name)) continue;
      names.add(name);
    }
  }
  return names;
}

/** Titles of RWC/Challenge Cup pool subpages transcluded or linked from a season page. */
export function extractPoolSubpageTitles(wikitext: string, pageTitle?: string): string[] {
  // Domestic club leagues use inline / template league tables — do not chase linked
  // European cup "pool stage" pages (that contaminated Pro12/Pro14 standings).
  if (
    pageTitle &&
    /(?:Celtic League|Pro12|Pro14|United Rugby Championship|English Premiership|Premiership Rugby|Top 14|Currie Cup|Super Rugby)/i.test(
      pageTitle,
    )
  ) {
    return [];
  }

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

  return [...titles].filter(
    (title) => !/Champions Cup|Challenge Cup|Heineken Cup|European Rugby/i.test(title),
  );
}

async function resolveStandingsFromWikitext(
  wikitext: string,
  fetchTemplate: (templateName: string) => Promise<string>,
): Promise<WikipediaStandingRow[]> {
  const direct = parseSportsTableModule(wikitext);
  if (direct.length) {
    if (direct.some((row) => row.pool)) return direct;
    return dedupeStandings(direct);
  }

  // Prefer explicit league-table templates (Pro12/Pro14/URC) before scanning the page
  // for pool/cup wikitables that may be linked nearby.
  const templateNames = extractPoolTableTemplateNames(wikitext);
  const fromTemplates: WikipediaStandingRow[] = [];
  for (const templateName of templateNames) {
    try {
      const templateWikitext = await fetchTemplate(templateName);
      fromTemplates.push(...parseSportsTableModule(templateWikitext));
      fromTemplates.push(...parseLeagueWikitableStandings(templateWikitext));
    } catch {
      // Skip missing or rate-limited templates; other sources may still apply.
    }
  }
  if (fromTemplates.length) {
    // Preserve Conference A/B (or Pool A/B) identity from league-table templates.
    if (fromTemplates.some((row) => row.pool)) return fromTemplates;
    return dedupeStandings(fromTemplates);
  }

  const internationalTable = parseInternationalTableStandings(wikitext);
  if (internationalTable.length) return internationalTable;

  const poolRows = parsePoolWikitableStandings(wikitext);
  if (poolRows.length) {
    // Keep pool-local ranks when pools are labeled (Celtic League Pool A/B).
    // Only flatten into one overall ranking when pool identity is absent.
    if (poolRows.some((row) => row.pool)) return poolRows;
    return poolRows
      .slice()
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.pointsDiff - a.pointsDiff ||
          a.teamName.localeCompare(b.teamName),
      )
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

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
    // Preserve Pool A/B identity for Celtic League; only flatten unlabeled pools.
    if (standings.length && !standings.some((row) => row.pool)) {
      standings = [...standings]
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.pointsDiff - a.pointsDiff ||
            a.teamName.localeCompare(b.teamName),
        )
        .map((row, index) => ({ ...row, rank: index + 1 }));
    }
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
    // Only derive placeholder rows when we have no table at all — never invent
    // zeroed league tables over real Wikipedia data we failed to parse.
    standings = standingsFromFixtureTeams(fixtures, playoffFixtures);
    if (standings.length) {
      warnings.push("Standings derived from fixture participants");
    }
  } else if (standings.every((r) => r.played === 0 && r.points === 0)) {
    warnings.push("Standings rows present but all P=0/Pts=0 (likely incomplete wiki parse)");
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
