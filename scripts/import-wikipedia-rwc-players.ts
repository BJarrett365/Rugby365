/**
 * Scrape Wikipedia Category:{year}_Rugby_World_Cup_players and enrich matching CMS players
 * (bios, caps, career stints, height/weight, positions).
 *
 * Writes JSON cache under docs/scraped/wikipedia/rugby-world-cup-players/{year}/
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rwc-players.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rwc-players.ts --years=1987,1991
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rwc-players.ts --years=1987 --scrape-only
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixturePlayers, fixtures, players } from "@rugby365/db";
import { fetchWikipediaCategoryMembers } from "@rugby365/import-sdk";
import { getDb } from "../apps/web/src/lib/db";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { normalizePlayerName, normalizedEntityKey } from "../apps/web/src/lib/entity-normalize";

const ROOT = join(process.cwd(), "docs/scraped/wikipedia/rugby-world-cup-players");
const BASE_YEARS = [1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023];

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));
const scrapeOnly = args.includes("--scrape-only");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 600);
const limitPlayers = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function wikiTitleToName(title: string): string {
  return title
    .replace(/\s*\(.*?\)\s*$/, "")
    .replace(/_/g, " ")
    .trim();
}

function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

type CategoryCache = {
  year: number;
  category: string;
  scrapedAt: string;
  members: Array<{ title: string; pageId: number; name: string; url: string }>;
};

async function scrapeYear(year: number): Promise<CategoryCache> {
  const category = `Category:${year}_Rugby_World_Cup_players`;
  const members = await fetchWikipediaCategoryMembers({
    categoryTitleOrUrl: category,
    limit: 5000,
  });
  const mapped = members
    .filter((m) => !m.title.startsWith("Category:"))
    .map((m) => ({
      title: m.title,
      pageId: m.pageId,
      name: wikiTitleToName(m.title),
      url: articleUrl(m.title),
    }));

  const payload: CategoryCache = {
    year,
    category,
    scrapedAt: new Date().toISOString(),
    members: mapped,
  };
  const dir = join(ROOT, String(year));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "category-members.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`  scraped ${mapped.length} members → ${year}/category-members.json`);
  return payload;
}

function loadYear(year: number): CategoryCache | null {
  const path = join(ROOT, String(year), "category-members.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as CategoryCache;
}

async function seasonPlayerIds(seasonId: string): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db.execute(sql`
    select distinct p.id, p.name, p.wikipedia_url
    from fixture_players fp
    join fixtures f on f.id = fp.fixture_id
    join players p on p.id = fp.player_id
    where f.season_id = ${seasonId}
  `);
  const byKey = new Map<string, string>();
  for (const row of rows as Array<{ id: string; name: string }>) {
    byKey.set(normalizedEntityKey(normalizePlayerName(row.name), "player"), row.id);
    // Also index surname for weak fallbacks later
    const parts = normalizePlayerName(row.name).split(/\s+/);
    if (parts.length > 1) {
      const surname = parts[parts.length - 1]!;
      const sKey = `surname:${normalizedEntityKey(surname, "player")}`;
      if (!byKey.has(sKey)) byKey.set(sKey, row.id);
    }
  }
  return byKey;
}

async function importYear(year: number, cache: CategoryCache) {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup missing");
  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
    .limit(1);
  if (!season) {
    console.warn(`  ! no season row for ${year}`);
    return;
  }

  const seasonPlayers = await seasonPlayerIds(season.id);
  console.log(`  season has ${seasonPlayers.size} keyed squad players`);

  let matched = 0;
  let enriched = 0;
  let failed = 0;
  let skipped = 0;
  const report: Array<Record<string, unknown>> = [];

  const members = limitPlayers > 0 ? cache.members.slice(0, limitPlayers) : cache.members;

  for (const [index, member] of members.entries()) {
    const key = normalizedEntityKey(normalizePlayerName(member.name), "player");
    let playerId = seasonPlayers.get(key) ?? null;

    // Global name lookup if not in season squad (wiki lists some who only covered / staff)
    if (!playerId) {
      const [global] = await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(sql`lower(${players.name}) = ${member.name.toLowerCase()}`)
        .limit(1);
      playerId = global?.id ?? null;
    }

    if (!playerId) {
      skipped += 1;
      report.push({ title: member.title, status: "unmatched" });
      continue;
    }

    matched += 1;
    if (scrapeOnly) {
      report.push({ title: member.title, status: "matched", playerId });
      continue;
    }

    if (index > 0) await sleep(delayMs);
    try {
      const result = await enrichPlayerFromWikipedia(playerId, member.name, {
        sourceUrl: member.url,
        fillMissingOnly: true,
      });
      if (result.enriched) {
        enriched += 1;
        report.push({ title: member.title, status: "enriched", playerId });
      } else {
        failed += 1;
        report.push({ title: member.title, status: "enrich_failed", playerId, reason: result.reason });
      }
    } catch (error) {
      failed += 1;
      report.push({
        title: member.title,
        status: "error",
        playerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if ((index + 1) % 25 === 0) {
      console.log(`  … ${index + 1}/${members.length} (enriched ${enriched})`);
    }
  }

  writeFileSync(
    join(ROOT, String(year), "import-report.json"),
    `${JSON.stringify(
      {
        year,
        scrapedAt: cache.scrapedAt,
        matched,
        enriched,
        failed,
        skipped,
        report,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`  matched=${matched} enriched=${enriched} failed=${failed} unmatched=${skipped}`);
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  const years = (onlyYears?.length ? onlyYears : BASE_YEARS).sort((a, b) => a - b);
  console.log(`Wikipedia RWC players: ${years.join(", ")}${scrapeOnly ? " (scrape-only)" : ""}`);

  for (const year of years) {
    console.log(`\n→ ${year}`);
    let cache = loadYear(year);
    if (!cache) cache = await scrapeYear(year);
    else console.log(`  using cached category-members.json (${cache.members.length})`);
    await importYear(year, cache);
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
