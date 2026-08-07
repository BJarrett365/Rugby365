/**
 * Scrape Rugby World Cup data from rugbydatabase.co.uk
 * (competitionGroupId=1 → every past tournament + match detail pages).
 *
 * Writes JSON under docs/scraped/rugbydatabase/rugby-world-cup/
 *
 * Usage:
 *   npx tsx scripts/scrape-rugbydatabase-rwc.ts
 *   npx tsx scripts/scrape-rugbydatabase-rwc.ts --years=1987,1995
 *   npx tsx scripts/scrape-rugbydatabase-rwc.ts --years=2015 --skip-games
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "docs/scraped/rugbydatabase/rugby-world-cup");
const BASE = "https://www.rugbydatabase.co.uk";
const GROUP_ID = 1;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Rugby365Scraper/1.0";

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));
const skipGames = args.includes("--skip-games");
const force = args.includes("--force");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 450);

type SeasonMeta = {
  competitionId: number;
  competitionName: string;
  season: number;
  teamCount: number;
  startDate: string;
  endDate: string;
  games: number;
};

type GameListRow = {
  gameId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  diff: number | null;
  kickoffUnix: number | null;
  kickoffText: string | null;
  venueId: number | null;
  venueName: string | null;
  competitionId: number | null;
  competitionLabel: string | null;
  sourceUrl: string;
};

type LineupPlayer = {
  jerseyNumber: number | null;
  playerId: number | null;
  name: string;
  positionName: string | null;
  squadRole: "starting" | "substitute";
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
  nation: string | null;
};

type MatchDetail = {
  gameId: number;
  sourceUrl: string;
  competitionId: number | null;
  competitionLabel: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string | null;
  awayName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  dateText: string | null;
  kickoffText: string | null;
  venueId: number | null;
  venueName: string | null;
  attendance: number | null;
  refereeId: number | null;
  refereeName: string | null;
  homeCoachId: number | null;
  homeCoachName: string | null;
  awayCoachId: number | null;
  awayCoachName: string | null;
  penaltyTries: Array<{ teamName: string; count: number }>;
  topScorer: { playerId: number | null; name: string; points: number } | null;
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  scrapedAt: string;
};

let cookieJar = "";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(path: string, data: unknown) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " "));
}

function parseIntSafe(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^\d+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractHrefId(html: string | null | undefined, key: string): number | null {
  if (!html) return null;
  const m = html.match(new RegExp(`${key}=(\\d+)`, "i"));
  return m ? Number(m[1]) : null;
}

function extractLinkName(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = stripTags(html);
  return text || null;
}

/** Extract `var tableData = [...]` even when the array spans many lines. */
function extractTableData<T = unknown>(html: string): T[] {
  const start = html.search(/var\s+tableData\s*=\s*\[/);
  if (start < 0) return [];
  const bracketStart = html.indexOf("[", start);
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escaped = false;
  for (let i = bracketStart; i < html.length; i++) {
    const ch = html[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        const raw = html.slice(bracketStart, i + 1);
        try {
          return JSON.parse(raw) as T[];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

async function fetchText(url: string, attempt = 1): Promise<{ ok: boolean; status: number; html: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        cookie: cookieJar || undefined,
        referer: `${BASE}/recurring-competitions/index.php?competitionGroupId=${GROUP_ID}`,
      },
      redirect: "follow",
    });
    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : (() => {
            const single = res.headers.get("set-cookie");
            return single ? [single] : [];
          })();
    if (setCookies.length) {
      const parts = setCookies.map((c) => c.split(";")[0]!).filter(Boolean);
      const map = new Map<string, string>();
      for (const part of [...(cookieJar ? cookieJar.split("; ") : []), ...parts]) {
        const [k, ...rest] = part.split("=");
        if (k) map.set(k, rest.join("="));
      }
      cookieJar = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const html = await res.text();
    if ((!res.ok || html.length < 200) && attempt < 5) {
      await sleep(1000 * attempt);
      return fetchText(url, attempt + 1);
    }
    return { ok: res.ok, status: res.status, html };
  } catch (error) {
    if (attempt < 5) {
      console.warn(`  retry ${attempt}/5 ${url} — ${error instanceof Error ? error.message : error}`);
      await sleep(1500 * attempt);
      return fetchText(url, attempt + 1);
    }
    throw error;
  }
}

function parseScoreFromResultHtml(resultHtml: string): { home: number | null; away: number | null; gameId: number | null } {
  const gameId = extractHrefId(resultHtml, "gameId");
  const text = stripTags(resultHtml);
  const m = text.match(/(-?\d+)\s*-\s*(-?\d+)/);
  return {
    gameId,
    home: m ? Number(m[1]) : null,
    away: m ? Number(m[2]) : null,
  };
}

function parseGameListRows(html: string): GameListRow[] {
  const rows = extractTableData<Record<string, unknown>>(html);
  const out: GameListRow[] = [];
  for (const row of rows) {
    const resultHtml = String(row.Result ?? "");
    const score = parseScoreFromResultHtml(resultHtml);
    const competitionsHtml = String(row.Competitions ?? "");
    out.push({
      gameId: score.gameId ?? 0,
      homeTeamId: extractHrefId(String(row.HomeTeam ?? ""), "teamId"),
      awayTeamId: extractHrefId(String(row.AwayTeam ?? ""), "teamId"),
      homeName: String(row.HomeName ?? extractLinkName(String(row.HomeTeam ?? "")) ?? "").trim(),
      awayName: String(row.AwayName ?? extractLinkName(String(row.AwayTeam ?? "")) ?? "").trim(),
      homeScore: score.home,
      awayScore: score.away,
      diff: parseIntSafe(row.Diff as string | number | null),
      kickoffUnix: parseIntSafe(row.RawKickOff as string | number | null),
      kickoffText: row.KickOff != null ? String(row.KickOff) : null,
      venueId: parseIntSafe(row.venueId as string | number | null),
      venueName: row.VenueName != null ? String(row.VenueName) : null,
      competitionId: extractHrefId(competitionsHtml, "competitionId"),
      competitionLabel: extractLinkName(competitionsHtml),
      sourceUrl: score.gameId ? `${BASE}/game.php?gameId=${score.gameId}` : "",
    });
  }
  return out.filter((r) => r.gameId > 0);
}

function parseStatCell(value: string): number {
  const t = value.trim();
  if (!t || t === "-" || t === "–" || t === "—") return 0;
  const n = Number(t.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseLineupTable(tableHtml: string): LineupPlayer[] {
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  const players: LineupPlayer[] = [];
  for (const rowMatch of rows) {
    const row = rowMatch[0];
    const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => c[1] ?? "");
    if (cells.length < 8) continue;
    const jerseyText = stripTags(cells[0] ?? "");
    if (!/^\d+$/.test(jerseyText)) continue;
    const jerseyNumber = Number(jerseyText);
    const playerCell = cells[1] ?? "";
    const playerId = extractHrefId(playerCell, "playerId");
    const name = stripTags(playerCell);
    if (!name) continue;
    const positionName = stripTags(cells[2] ?? "") || null;
    const squadRole = /reserve|bench|sub/i.test(positionName ?? "") || jerseyNumber >= 16 ? "substitute" : "starting";
    players.push({
      jerseyNumber,
      playerId,
      name,
      positionName,
      squadRole,
      tries: parseStatCell(stripTags(cells[3] ?? "")),
      conversions: parseStatCell(stripTags(cells[4] ?? "")),
      penalties: parseStatCell(stripTags(cells[5] ?? "")),
      dropGoals: parseStatCell(stripTags(cells[6] ?? "")),
      points: parseStatCell(stripTags(cells[7] ?? "")),
      nation: cells[8] != null ? stripTags(cells[8]) || null : null,
    });
  }
  return players;
}

function parseMatchDetail(gameId: number, html: string): MatchDetail {
  const sourceUrl = `${BASE}/game.php?gameId=${gameId}`;
  const scoreText = html.match(/class="score">\s*([^<]+)/i)?.[1] ?? "";
  const scoreMatch = stripTags(scoreText).match(/(-?\d+)\s*-\s*(-?\d+)/);
  const teamPairs = [...html.matchAll(/team\/index\.php\?teamId=(\d+)[^>]*>([^<]+)/gi)].map((m) => ({
    id: Number(m[1]),
    name: decodeHtml(m[2] ?? ""),
  }));
  const homeTeam = teamPairs[0] ?? null;
  const awayTeam = teamPairs[1] ?? null;

  const coachPairs = [...html.matchAll(/coach\/index\.php\?coachId=(\d+)[^>]*>([^<]+)/gi)].map((m) => ({
    id: Number(m[1]),
    name: decodeHtml(m[2] ?? ""),
  }));
  const refMatch = html.match(/referee\/index\.php\?refereeId=(\d+)[^>]*>([^<]+)/i);
  const venueMatch = html.match(/venue\/index\.php\?venueId=(\d+)[^>]*>([^<]+)/i);
  const compMatch = html.match(/competition\/index\.php\?competitionId=(\d+)[^>]*>([^<]+)/i);
  const attendanceRaw = html.match(/Attendance<\/h4>\s*<p>\s*([^<]+)/i)?.[1] ?? "";
  const dateText =
    html.match(/<div class="info-box">\s*<h4>Date<\/h4>\s*<p>([^<]+)/i)?.[1]?.trim() ??
    html.match(/\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}/)?.[0] ??
    null;
  const kickoffText = html.match(/Kick-?Off<\/h4>\s*<p>([^<]+)/i)?.[1]?.trim() ?? null;

  const penaltyTries: Array<{ teamName: string; count: number }> = [];
  const ptBlock = html.match(/Penalty Tries<\/div>\s*<div class="tile-value">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "";
  for (const m of ptBlock.matchAll(/>([^<]+?)\s+(\d+)\s*</g)) {
    penaltyTries.push({ teamName: decodeHtml(m[1] ?? ""), count: Number(m[2]) });
  }
  for (const m of ptBlock.matchAll(/yellow-card">([^<]+)\s+(\d+)/g)) {
    penaltyTries.push({ teamName: decodeHtml(m[1] ?? ""), count: Number(m[2]) });
  }

  let topScorer: MatchDetail["topScorer"] = null;
  const top = html.match(
    /Top Scorer<\/div>\s*<div class="tile-value"><a href="[^"]*playerId=(\d+)">([^<]+)<\/a>\s*<span class="pts">\((\d+)\s*pts\)/i,
  );
  if (top) {
    topScorer = { playerId: Number(top[1]), name: decodeHtml(top[2] ?? ""), points: Number(top[3]) };
  }

  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  const homeLineup = tables[0] ? parseLineupTable(tables[0]) : [];
  const awayLineup = tables[1] ? parseLineupTable(tables[1]) : [];

  return {
    gameId,
    sourceUrl,
    competitionId: compMatch ? Number(compMatch[1]) : null,
    competitionLabel: compMatch ? decodeHtml(compMatch[2] ?? "") : null,
    homeTeamId: homeTeam?.id ?? null,
    awayTeamId: awayTeam?.id ?? null,
    homeName: homeTeam?.name ?? null,
    awayName: awayTeam?.name ?? null,
    homeScore: scoreMatch ? Number(scoreMatch[1]) : null,
    awayScore: scoreMatch ? Number(scoreMatch[2]) : null,
    dateText,
    kickoffText,
    venueId: venueMatch ? Number(venueMatch[1]) : null,
    venueName: venueMatch ? decodeHtml(venueMatch[2] ?? "") : null,
    attendance: parseIntSafe(attendanceRaw),
    refereeId: refMatch ? Number(refMatch[1]) : null,
    refereeName: refMatch ? decodeHtml(refMatch[2] ?? "") : null,
    homeCoachId: coachPairs[0]?.id ?? null,
    homeCoachName: coachPairs[0]?.name ?? null,
    awayCoachId: coachPairs[1]?.id ?? null,
    awayCoachName: coachPairs[1]?.name ?? null,
    penaltyTries,
    topScorer,
    homeLineup,
    awayLineup,
    scrapedAt: new Date().toISOString(),
  };
}

async function scrapeSeasons(): Promise<SeasonMeta[]> {
  const url = `${BASE}/recurring-competitions/index.php?competitionGroupId=${GROUP_ID}`;
  const { html, ok, status } = await fetchText(url);
  if (!ok) throw new Error(`Failed to fetch seasons hub (${status})`);
  const rows = extractTableData<Record<string, unknown>>(html);
  return rows
    .map((row) => ({
      competitionId: Number(row.competitionId),
      competitionName: String(row.competitionName ?? "Rugby World Cup"),
      season: Number(row.Season),
      teamCount: Number(row.TeamCount ?? 0),
      startDate: String(row.StartDate ?? ""),
      endDate: String(row.EndDate ?? ""),
      games: Number(row.Games ?? 0),
    }))
    .filter((s) => Number.isFinite(s.season) && Number.isFinite(s.competitionId))
    .sort((a, b) => a.season - b.season);
}

async function scrapeGroupLists() {
  const targets: Array<{ key: string; path: string }> = [
    { key: "ladder", path: `/recurring-competitions/group-ladder.php?competitionGroupId=${GROUP_ID}` },
    { key: "coaches", path: `/recurring-competitions/coach-list.php?competitionGroupId=${GROUP_ID}` },
    { key: "referees", path: `/recurring-competitions/referee-list.php?competitionGroupId=${GROUP_ID}` },
  ];
  const groupDir = join(ROOT, "group");
  mkdirSync(groupDir, { recursive: true });
  for (const target of targets) {
    await sleep(delayMs);
    const { html, ok, status } = await fetchText(`${BASE}${target.path}`);
    const data = extractTableData(html);
    writeJson(join(groupDir, `${target.key}.json`), {
      sourceUrl: `${BASE}${target.path}`,
      ok,
      status,
      scrapedAt: new Date().toISOString(),
      rows: data,
    });
    console.log(`  group/${target.key}.json — ${data.length} rows (status ${status})`);
  }

  // Player list is large / sometimes session-gated; store when available.
  await sleep(delayMs);
  const playerUrl = `${BASE}/recurring-competitions/player-list.php?competitionGroupId=${GROUP_ID}`;
  const players = await fetchText(playerUrl);
  const playerData = extractTableData(players.html);
  if (playerData.length) {
    writeJson(join(groupDir, "players.json"), {
      sourceUrl: playerUrl,
      ok: players.ok,
      status: players.status,
      scrapedAt: new Date().toISOString(),
      rows: playerData,
    });
    console.log(`  group/players.json — ${playerData.length} rows`);
  } else {
    writeFileSync(join(groupDir, "players.raw.html"), players.html, "utf8");
    console.log(`  group/players.raw.html — no tableData (len=${players.html.length})`);
  }
}

async function scrapeSeason(season: SeasonMeta) {
  const yearDir = join(ROOT, String(season.season));
  mkdirSync(join(yearDir, "matches"), { recursive: true });

  writeJson(join(yearDir, "season.json"), {
    ...season,
    sourceUrls: {
      hub: `${BASE}/competition/index.php?competitionId=${season.competitionId}`,
      games: `${BASE}/recurring-competitions/competition-games.php?competitionGroupId=${GROUP_ID}&competitionId=${season.competitionId}`,
      conferences: `${BASE}/competition/conferences.php?competitionId=${season.competitionId}`,
      draw: `${BASE}/competition/draw.php?competitionId=${season.competitionId}`,
      wikipedia: `https://en.wikipedia.org/wiki/${season.season}_Rugby_World_Cup`,
    },
    scrapedAt: new Date().toISOString(),
  });

  await sleep(delayMs);
  const gamesUrl = `${BASE}/recurring-competitions/competition-games.php?competitionGroupId=${GROUP_ID}&competitionId=${season.competitionId}`;
  const gamesRes = await fetchText(gamesUrl);
  const games = parseGameListRows(gamesRes.html);
  writeJson(join(yearDir, "games.json"), {
    competitionId: season.competitionId,
    season: season.season,
    sourceUrl: gamesUrl,
    scrapedAt: new Date().toISOString(),
    count: games.length,
    games,
  });
  console.log(`  ${season.season}: ${games.length} games listed`);

  await sleep(delayMs);
  const confUrl = `${BASE}/competition/conferences.php?competitionId=${season.competitionId}`;
  const confRes = await fetchText(confUrl);
  writeJson(join(yearDir, "conferences.json"), {
    competitionId: season.competitionId,
    season: season.season,
    sourceUrl: confUrl,
    scrapedAt: new Date().toISOString(),
    rows: extractTableData(confRes.html),
  });

  await sleep(delayMs);
  const drawUrl = `${BASE}/competition/draw.php?competitionId=${season.competitionId}`;
  const drawRes = await fetchText(drawUrl);
  writeFileSync(join(yearDir, "draw.raw.html"), drawRes.html, "utf8");

  if (skipGames) return { season: season.season, listed: games.length, scraped: 0, skipped: 0 };

  let scraped = 0;
  let skipped = 0;
  for (const [index, game] of games.entries()) {
    const outPath = join(yearDir, "matches", `${game.gameId}.json`);
    if (!force && existsSync(outPath)) {
      skipped += 1;
      continue;
    }
    if (index > 0 || scraped > 0 || skipped > 0) await sleep(delayMs);
    const { html, ok, status } = await fetchText(game.sourceUrl);
    if (!ok || html.length < 1000) {
      console.warn(`    ! game ${game.gameId} failed status=${status} len=${html.length}`);
      writeJson(outPath.replace(/\.json$/, ".error.json"), {
        gameId: game.gameId,
        status,
        ok,
        length: html.length,
        scrapedAt: new Date().toISOString(),
      });
      continue;
    }
    const detail = parseMatchDetail(game.gameId, html);
    // Prefer list names if detail order is ambiguous.
    if (!detail.homeName) detail.homeName = game.homeName;
    if (!detail.awayName) detail.awayName = game.awayName;
    writeJson(outPath, detail);
    scraped += 1;
    if (scraped % 10 === 0 || scraped === games.length) {
      console.log(`    matches ${scraped}/${games.length} (skip existing ${skipped})`);
    }
  }
  return { season: season.season, listed: games.length, scraped, skipped };
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  console.log("Scraping rugbydatabase.co.uk Rugby World Cup (group 1)…");

  const seasons = await scrapeSeasons();
  writeJson(join(ROOT, "group", "seasons.json"), {
    competitionGroupId: GROUP_ID,
    sourceUrl: `${BASE}/recurring-competitions/index.php?competitionGroupId=${GROUP_ID}`,
    scrapedAt: new Date().toISOString(),
    seasons,
  });
  console.log(`Seasons found: ${seasons.map((s) => s.season).join(", ")}`);

  await scrapeGroupLists();

  const selected = seasons.filter((s) => !onlyYears?.length || onlyYears.includes(s.season));
  const summary = [];
  for (const season of selected) {
    console.log(`\n→ ${season.season} (competitionId=${season.competitionId})`);
    summary.push(await scrapeSeason(season));
  }

  writeJson(join(ROOT, "manifest.json"), {
    scrapedAt: new Date().toISOString(),
    groupId: GROUP_ID,
    delayMs,
    onlyYears: onlyYears ?? null,
    skipGames,
    summary,
  });
  console.log("\nDone.", summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
