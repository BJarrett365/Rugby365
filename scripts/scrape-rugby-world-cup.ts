/**
 * Scrape Rugby World Cup data from Ultimate Rugby + rugbyworldcup.com.
 *
 * Writes JSON under docs/scraped/rugby-world-cup/{year}/…
 *
 * Usage:
 *   npx tsx scripts/scrape-rugby-world-cup.ts
 *   npx tsx scripts/scrape-rugby-world-cup.ts --years=2019,2023,2027
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "docs/scraped/rugby-world-cup");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Rugby365Scraper/1.0";

const ALL_YEARS = [1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023, 2027] as const;

type PoolStandingRow = {
  pool: string;
  rank: number;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  draw: number;
  pointsFor: number | null;
  pointsAgainst: number | null;
  pointsDiff: number | null;
  triesFor: number | null;
  triesAgainst: number | null;
  tryBonus: number | null;
  losingBonus: number | null;
  points: number;
};

type KnockoutMatch = {
  stage: string;
  label: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  venueName: string | null;
  dateText: string | null;
  sourceUrl: string | null;
};

type OfficialTournamentPage = {
  year: number;
  title: string | null;
  dateRange: string | null;
  host: string | null;
  description: string | null;
  pools: Array<{
    pool: string;
    rows: Array<{
      rank: number;
      teamCode: string;
      teamName?: string;
      played: number;
      pointsDiff: number;
      points: number;
    }>;
  }>;
  sourceUrl: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; html: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  const html = await res.text();
  return { ok: res.ok, status: res.status, html };
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

function parseSlashPair(value: string): { a: number | null; b: number | null } {
  const m = value.match(/(-?\d+)\s*\/\s*(-?\d+)/);
  if (!m) return { a: null, b: null };
  return { a: Number(m[1]), b: Number(m[2]) };
}

function parseIntSafe(value: string | undefined | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^\d+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Ultimate Rugby packs all pools into one HTML <table>, with header rows between pools. */
function parseUltimateRugbyPools(html: string): { pools: Array<{ pool: string; rows: PoolStandingRow[] }>; rawTables: number } {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { pools: [], rawTables: 0 };
  const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => stripTags(cell[1] ?? "")),
  );

  const pools: Array<{ pool: string; rows: PoolStandingRow[] }> = [];
  let current: PoolStandingRow[] = [];
  let poolIndex = 0;

  const flush = () => {
    if (!current.length) return;
    const letter = String.fromCharCode(65 + poolIndex); // A, B, C…
    pools.push({
      pool: `Pool ${letter}`,
      rows: current.map((row, i) => ({ ...row, pool: `Pool ${letter}`, rank: i + 1 })),
    });
    poolIndex += 1;
    current = [];
  };

  for (const cells of rows) {
    if (!cells.length) continue;
    const isHeader = cells.some((c) => c === "P") && cells.some((c) => /points/i.test(c));
    if (isHeader) {
      flush();
      continue;
    }
    const teamName = cells[0]?.trim();
    if (!teamName || /^(P|W|L|D)$/i.test(teamName)) continue;
    const pfpa = parseSlashPair(cells[5] ?? "");
    const tries = parseSlashPair(cells[7] ?? "");
    current.push({
      pool: "",
      rank: current.length + 1,
      teamName,
      played: parseIntSafe(cells[1]) ?? 0,
      won: parseIntSafe(cells[2]) ?? 0,
      lost: parseIntSafe(cells[3]) ?? 0,
      draw: parseIntSafe(cells[4]) ?? 0,
      pointsFor: pfpa.a,
      pointsAgainst: pfpa.b,
      pointsDiff: parseIntSafe(cells[6]),
      triesFor: tries.a,
      triesAgainst: tries.b,
      tryBonus: parseIntSafe(cells[8]),
      losingBonus: parseIntSafe(cells[9]),
      points: parseIntSafe(cells[10]) ?? 0,
    });
  }
  flush();
  return { pools, rawTables: 1 };
}

function parseUltimateKnockouts(html: string, sourceUrl: string): KnockoutMatch[] {
  const matches: KnockoutMatch[] = [];
  // Stage headings like <h2>Quarter-finals</h2>
  const stageBlocks = [...html.matchAll(/<h2[^>]*>\s*(Quarter-finals|Semi-finals|Final|Bronze|3rd Place)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/gi)];
  for (const block of stageBlocks) {
    const stage = decodeHtml(block[1] ?? "Knockout");
    const body = block[2] ?? "";
    const links = [...body.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const link of links) {
      const label = stripTags(link[2] ?? "");
      if (!/vs/i.test(label)) continue;
      // "England Vs Australia at Oita Stadium 19th Oct 2019"
      const m = label.match(/^(.+?)\s+Vs\s+(.+?)(?:\s+at\s+(.+?))?(?:\s+(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}))?$/i);
      if (!m) continue;
      // Scores often appear near the link in sibling markup: team 40 16 team
      const href = link[1] ?? "";
      const around = body.slice(Math.max(0, body.indexOf(link[0]) - 50), body.indexOf(link[0]) + link[0].length + 400);
      const scoreBits = stripTags(around).match(/(\d{1,3})\s+(\d{1,3})/);
      matches.push({
        stage,
        label,
        homeTeam: decodeHtml(m[1] ?? ""),
        awayTeam: decodeHtml(m[2] ?? ""),
        homeScore: scoreBits ? Number(scoreBits[1]) : null,
        awayScore: scoreBits ? Number(scoreBits[2]) : null,
        venueName: m[3] ? decodeHtml(m[3]) : null,
        dateText: m[4] ? decodeHtml(m[4]) : null,
        sourceUrl: href.startsWith("http") ? href : href ? `https://www.ultimaterugby.com${href}` : sourceUrl,
      });
    }
  }
  return matches;
}

function parseUltimateMatchLinks(html: string): Array<{ url: string; slug: string; matchId: string | null }> {
  const out: Array<{ url: string; slug: string; matchId: string | null }> = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="((?:https:\/\/www\.ultimaterugby\.com)?\/(?:app\/public\/index\.php\/)?match\/([^"]+))"/gi)) {
    const href = m[1]!.startsWith("http") ? m[1]! : `https://www.ultimaterugby.com${m[1]}`;
    if (seen.has(href)) continue;
    if (/\/match\/list/i.test(href)) continue;
    seen.add(href);
    const idMatch = href.match(/\/(\d+)(?:\/|$)/);
    out.push({ url: href, slug: decodeURIComponent(m[2] ?? ""), matchId: idMatch?.[1] ?? null });
  }
  return out;
}

function parseOfficialPastTournament(html: string, year: number, sourceUrl: string): OfficialTournamentPage {
  const title = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").trim()) || null;
  const dateHost = stripTags((html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "").trim()) || null;
  let dateRange: string | null = null;
  let host: string | null = null;
  if (dateHost) {
    const parts = dateHost.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      dateRange = parts.slice(0, -1).join(", ");
      host = parts[parts.length - 1] ?? null;
    } else {
      dateRange = dateHost;
    }
  }
  const description =
    stripTags((html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "").trim()) || null;

  const pools: OfficialTournamentPage["pools"] = [];

  // Each pool panel: <div ... data-pool="a"> … <table class="pools-summary__table"> …
  const panels = [
    ...html.matchAll(
      /data-pool=["']([a-f])["'][\s\S]*?(<table class="pools-summary__table"[\s\S]*?<\/table>)/gi,
    ),
  ];

  const seen = new Set<string>();
  for (const panel of panels) {
    const poolId = (panel[1] ?? "").toUpperCase();
    if (!poolId || seen.has(poolId)) continue;
    seen.add(poolId);
    const tableHtml = panel[2] ?? "";
    const rows: OfficialTournamentPage["pools"][number]["rows"] = [];
    for (const tr of tableHtml.matchAll(/<tr class="pools-summary__table-row[\s\S]*?<\/tr>/gi)) {
      const cells = [...tr[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => c[1] ?? "");
      if (cells.length < 5) continue;
      const rank = parseIntSafe(stripTags(cells[1] ?? ""));
      const teamHtml = cells[2] ?? "";
      const teamName =
        teamHtml.match(/title=["']([^"']+)["']/i)?.[1] ??
        teamHtml.match(/alt=["']([^"']+)["']/i)?.[1] ??
        stripTags(teamHtml);
      const teamCode = stripTags(teamHtml.match(/pools-summary__team[^>]*>([\s\S]*?)</i)?.[1] ?? "") || teamName;
      const played = parseIntSafe(stripTags(cells[3] ?? ""));
      const pointsDiff = parseIntSafe(stripTags(cells[4] ?? ""));
      const points = parseIntSafe(stripTags(cells[5] ?? ""));
      if (rank == null || !teamName || played == null || points == null) continue;
      rows.push({
        rank,
        teamCode: teamCode || teamName,
        teamName: decodeHtml(teamName),
        played,
        pointsDiff: pointsDiff ?? 0,
        points,
      });
    }
    if (rows.length) pools.push({ pool: `Pool ${poolId}`, rows });
  }

  // Fallback: sequential tables if data-pool panels missing.
  if (!pools.length) {
    const tables = [...html.matchAll(/<table class="pools-summary__table"[\s\S]*?<\/table>/gi)];
    tables.forEach((table, index) => {
      const rows: OfficialTournamentPage["pools"][number]["rows"] = [];
      for (const tr of table[0].matchAll(/<tr class="pools-summary__table-row[\s\S]*?<\/tr>/gi)) {
        const cells = [...tr[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => c[1] ?? "");
        if (cells.length < 5) continue;
        const rank = parseIntSafe(stripTags(cells[1] ?? ""));
        const teamHtml = cells[2] ?? "";
        const teamName =
          teamHtml.match(/title=["']([^"']+)["']/i)?.[1] ??
          stripTags(teamHtml);
        const teamCode = stripTags(teamHtml.match(/pools-summary__team[^>]*>([\s\S]*?)</i)?.[1] ?? "") || teamName;
        const played = parseIntSafe(stripTags(cells[3] ?? ""));
        const pointsDiff = parseIntSafe(stripTags(cells[4] ?? ""));
        const points = parseIntSafe(stripTags(cells[5] ?? ""));
        if (rank == null || !teamName || played == null || points == null) continue;
        rows.push({
          rank,
          teamCode: teamCode || teamName,
          teamName: decodeHtml(teamName),
          played,
          pointsDiff: pointsDiff ?? 0,
          points,
        });
      }
      if (rows.length) {
        pools.push({ pool: `Pool ${String.fromCharCode(65 + index)}`, rows });
      }
    });
  }

  return {
    year,
    title,
    dateRange,
    host,
    description,
    pools,
    sourceUrl,
  };
}

function competitionMeta(year: number, official: OfficialTournamentPage | null) {
  const formats: Record<number, { teams: number; pools: number; poolSize: number; matches: number; notes: string }> = {
    1987: { teams: 16, pools: 4, poolSize: 4, matches: 32, notes: "Inaugural tournament; 4 pools of 4." },
    1991: { teams: 16, pools: 4, poolSize: 4, matches: 32, notes: "4 pools of 4." },
    1995: { teams: 16, pools: 4, poolSize: 4, matches: 32, notes: "4 pools of 4; first professional era." },
    1999: { teams: 20, pools: 5, poolSize: 4, matches: 41, notes: "5 pools of 4 + quarter-final play-offs." },
    2003: { teams: 20, pools: 4, poolSize: 5, matches: 48, notes: "4 pools of 5." },
    2007: { teams: 20, pools: 4, poolSize: 5, matches: 48, notes: "4 pools of 5." },
    2011: { teams: 20, pools: 4, poolSize: 5, matches: 48, notes: "4 pools of 5." },
    2015: { teams: 20, pools: 4, poolSize: 5, matches: 48, notes: "4 pools of 5." },
    2019: { teams: 20, pools: 4, poolSize: 5, matches: 45, notes: "4 pools of 5; three pool matches cancelled (typhoon)." },
    2023: { teams: 20, pools: 4, poolSize: 5, matches: 48, notes: "4 pools of 5." },
    2027: { teams: 24, pools: 6, poolSize: 4, matches: 52, notes: "Expanded: 6 pools of 4 + round of 16." },
  };
  const format = formats[year] ?? { teams: 0, pools: 0, poolSize: 0, matches: 0, notes: "" };
  return {
    competitionName: "Rugby World Cup",
    competitionSlug: "rugby-world-cup",
    competitionType: "International",
    governingBody: "World Rugby",
    officialWebsite: "https://www.rugbyworldcup.com/",
    ultimateRugbyUrl: `https://www.ultimaterugby.com/rugby-world-cup-${year}/table`,
    rugbyWorldCupUrl: year === 2027
      ? "https://www.rugbyworldcup.com/2027/en"
      : `https://www.rugbyworldcup.com/2027/en/past-tournaments/${year}`,
    year,
    host: official?.host ?? null,
    dateRange: official?.dateRange ?? null,
    description: official?.description ?? null,
    tournamentFormat: format.notes,
    numberOfTeams: format.teams,
    numberOfPools: format.pools,
    poolSize: format.poolSize,
    numberOfMatches: format.matches,
    startDate: null as string | null,
    endDate: null as string | null,
  };
}

async function scrapeYear(year: number) {
  const dir = join(ROOT, String(year));
  mkdirSync(dir, { recursive: true });

  const urTableUrl = `https://www.ultimaterugby.com/rugby-world-cup-${year}/table`;
  const urResultsUrl = `https://www.ultimaterugby.com/rugby-world-cup-${year}/results`;
  const urFixturesUrl = `https://www.ultimaterugby.com/rugby-world-cup-${year}/fixtures`;
  const officialUrl =
    year === 2027
      ? "https://www.rugbyworldcup.com/2027/en"
      : `https://www.rugbyworldcup.com/2027/en/past-tournaments/${year}`;

  console.log(`\n=== RWC ${year} ===`);
  const [tablePage, resultsPage, fixturesPage, officialPage] = await Promise.all([
    fetchText(urTableUrl),
    fetchText(urResultsUrl),
    fetchText(urFixturesUrl),
    fetchText(officialUrl),
  ]);

  writeFileSync(join(dir, "ultimate-rugby-table.html"), tablePage.html);
  writeFileSync(join(dir, "ultimate-rugby-results.html"), resultsPage.html);
  writeFileSync(join(dir, "ultimate-rugby-fixtures.html"), fixturesPage.html);
  writeFileSync(join(dir, "official-past-tournament.html"), officialPage.html);

  const pools = parseUltimateRugbyPools(tablePage.html);
  const knockouts = parseUltimateKnockouts(tablePage.html, urTableUrl);
  const matchLinks = [
    ...parseUltimateMatchLinks(resultsPage.html),
    ...parseUltimateMatchLinks(tablePage.html),
    ...parseUltimateMatchLinks(fixturesPage.html),
  ].filter((m, i, arr) => arr.findIndex((x) => x.url === m.url) === i);

  // Keep only likely tournament matches (slug contains year or stadium markers from table page)
  const tournamentMatchLinks = matchLinks.filter((m) => {
    const s = m.slug.toLowerCase();
    return s.includes(String(year)) || /oct|nov|sep|aug|jun|jul|may/.test(s);
  });

  const official = officialPage.ok
    ? parseOfficialPastTournament(officialPage.html, year, officialUrl)
    : null;

  const payload = {
    scrapedAt: new Date().toISOString(),
    year,
    sources: {
      ultimateRugbyTable: { url: urTableUrl, status: tablePage.status },
      ultimateRugbyResults: { url: urResultsUrl, status: resultsPage.status },
      ultimateRugbyFixtures: { url: urFixturesUrl, status: fixturesPage.status },
      official: { url: officialUrl, status: officialPage.status },
    },
    competition: competitionMeta(year, official),
    ultimateRugby: {
      pools: pools.pools,
      knockouts,
      matchLinks: tournamentMatchLinks,
    },
    official,
  };

  writeFileSync(join(dir, "tournament.json"), JSON.stringify(payload, null, 2));
  console.log(
    `  pools=${pools.pools.length} standingRows=${pools.pools.reduce((n, p) => n + p.rows.length, 0)} knockouts=${knockouts.length} matchLinks=${tournamentMatchLinks.length} officialPools=${official?.pools.length ?? 0}`,
  );
  return payload;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--years="));
  const years = arg
    ? arg
        .slice("--years=".length)
        .split(",")
        .map((y) => Number(y.trim()))
        .filter((y) => ALL_YEARS.includes(y as (typeof ALL_YEARS)[number]))
    : [...ALL_YEARS];

  mkdirSync(ROOT, { recursive: true });
  const index: Array<{ year: number; path: string; pools: number; rows: number }> = [];

  for (const year of years) {
    const payload = await scrapeYear(year);
    index.push({
      year,
      path: `${year}/tournament.json`,
      pools: payload.ultimateRugby.pools.length || payload.official?.pools.length || 0,
      rows: payload.ultimateRugby.pools.reduce((n, p) => n + p.rows.length, 0),
    });
    await sleep(400);
  }

  const competitionRoot = {
    scrapedAt: new Date().toISOString(),
    competitionName: "Rugby World Cup",
    competitionSlug: "rugby-world-cup",
    competitionType: "International",
    governingBody: "World Rugby",
    officialWebsite: "https://www.rugbyworldcup.com/",
    logoHint: "https://www.rugbyworldcup.com/",
    seasons: index,
    notes:
      "Pool tables + knockout summaries from Ultimate Rugby; host/date/description/pool codes from rugbyworldcup.com past-tournament pages. Match events/refs/coaches on Ultimate Rugby match pages are app/JS-gated — use Wikipedia / SDMS enrich for those fields.",
  };
  writeFileSync(join(ROOT, "index.json"), JSON.stringify(competitionRoot, null, 2));
  console.log(`\nWrote ${index.length} seasons to ${ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
