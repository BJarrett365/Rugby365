/**
 * Fill missing Rugby World Cup 1987 ranking player photos from:
 *   1) Wikipedia "1987 Rugby World Cup players" category pageimages
 *   2) Wikipedia rugby-title search / headshots
 *   3) Alamy public search (existing Chrome scraper + import)
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fill-rwc-1987-player-images.ts
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { competitions, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { foldRankingClubKey } from "../apps/web/src/lib/player-ranking-engine";
import { registerWikipediaHeadshotIfMissing } from "../apps/web/src/lib/player-image-service";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import {
  fetchWikipediaOriginalImages,
  fetchWikipediaPlayerHeadshots,
  fetchWikipediaThumbnails,
  fetchLanguageWikipediaHeadshots,
  fetchCommonsPortraitForPerson,
} from "../apps/web/src/lib/wikipedia-page-image";

const YEAR = 1987;
const CATEGORY = "Category:1987 Rugby World Cup players";
const ALAMY_BATCH = "/tmp/alamy-rwc-1987-batch.json";
const ALAMY_HITS = "/tmp/alamy-rwc-1987-hits.json";

function foldPerson(name: string): string {
  return foldRankingClubKey(name.replace(/\s*\([^)]*\)\s*/g, " "));
}

async function wikiQuery(params: Record<string, string>): Promise<Record<string, unknown>> {
  const search = new URLSearchParams({ format: "json", formatversion: "2", redirects: "1", ...params });
  const res = await fetch("https://en.wikipedia.org/w/api.php", {
    method: "POST",
    headers: {
      "User-Agent": "Rugby365ArchiveImport/1.0 (read-only archive enrichment)",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: search,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return {};
  return (await res.json()) as Record<string, unknown>;
}

async function categoryMemberTitles(categoryTitle: string): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;
  for (let page = 0; page < 8; page++) {
    const payload = await wikiQuery({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmtype: "page",
      cmlimit: "500",
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    const query = payload.query as { categorymembers?: Array<{ title?: string }> } | undefined;
    for (const row of query?.categorymembers ?? []) {
      if (row.title && !row.title.startsWith("Category:")) titles.push(row.title);
    }
    cmcontinue = (payload.continue as { cmcontinue?: string } | undefined)?.cmcontinue;
    if (!cmcontinue) break;
  }
  return [...new Set(titles)];
}

async function loadMissingPlayers() {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup competition missing");
  const rows = await db.execute<{ id: string; name: string; birth_date: string | null }>(sql`
    SELECT DISTINCT p.id, p.name, p.birth_date
    FROM players p
    JOIN player_match_ratings pmr ON pmr.player_id = p.id
    JOIN competition_seasons s ON s.id = pmr.season_id
    WHERE pmr.competition_id = ${competition.id}
      AND s.year = ${YEAR}
      AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
      AND p.name !~* 'to be announced|^tba$|^tbc$'
    ORDER BY p.name
  `);
  return rows;
}

function imageForPlayer(
  name: string,
  thumbs: Map<string, string>,
): string | null {
  const folded = foldPerson(name);
  for (const [title, url] of thumbs) {
    if (foldPerson(title) === folded) return url;
  }
  return null;
}

async function applyPhoto(playerId: string, playerName: string, url: string): Promise<boolean> {
  return registerWikipediaHeadshotIfMissing(playerId, url, playerName);
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", cwd: process.cwd() });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  const missing = await loadMissingPlayers();
  console.log(`1987 rated players missing photos: ${missing.length}`);
  if (!missing.length) return;

  const categoryTitles = await categoryMemberTitles(CATEGORY);
  console.log(`wikipedia category titles: ${categoryTitles.length}`);
  const thumbs = await fetchWikipediaOriginalImages([
    ...categoryTitles,
    ...missing.flatMap((row) => [row.name, `${row.name} (rugby union)`, `${row.name} (rugby)`]),
  ]);
  const extra = await fetchWikipediaThumbnails([...thumbs.keys(), ...categoryTitles]);
  for (const [title, url] of extra) {
    if (!thumbs.has(title)) thumbs.set(title, url);
  }

  let wikiHits = 0;
  const stillMissing: typeof missing = [];
  for (const row of missing) {
    const url = imageForPlayer(row.name, thumbs);
    if (!url) {
      stillMissing.push(row);
      continue;
    }
    const saved = await applyPhoto(row.id, row.name, url);
    if (saved) wikiHits += 1;
  }
  console.log(`wikipedia category/originals attached=${wikiHits} remaining=${stillMissing.length}`);

  if (stillMissing.length) {
    const searched = await fetchWikipediaPlayerHeadshots(
      stillMissing.map((row) => ({
        name: row.name,
        birthYear: row.birth_date ? Number.parseInt(String(row.birth_date).slice(0, 4), 10) : null,
      })),
    );
    let searchHits = 0;
    const afterSearch: typeof missing = [];
    for (const row of stillMissing) {
      const url = searched.get(row.name) ?? null;
      if (!url) {
        afterSearch.push(row);
        continue;
      }
      const saved = await applyPhoto(row.id, row.name, url);
      if (saved) searchHits += 1;
    }
    console.log(`wikipedia search attached=${searchHits} remaining=${afterSearch.length}`);
    stillMissing.length = 0;
    stillMissing.push(...afterSearch);
  }

  if (stillMissing.length) {
    const translated = await fetchLanguageWikipediaHeadshots(stillMissing.map((row) => row.name));
    const afterLang: typeof missing = [];
    let langHits = 0;
    for (const row of stillMissing) {
      const url = translated.get(row.name) ?? (await fetchCommonsPortraitForPerson(row.name));
      if (!url) {
        afterLang.push(row);
        continue;
      }
      const saved = await applyPhoto(row.id, row.name, url);
      if (saved) langHits += 1;
      else afterLang.push(row);
    }
    console.log(`language/commons attached=${langHits} remaining=${afterLang.length}`);
    stillMissing.length = 0;
    stillMissing.push(...afterLang);
  }

  if (stillMissing.length) {
    const plan = stillMissing.map((row) => ({
      playerId: row.id,
      playerName: row.name,
      searchUrl: alamyStockPhotoSearchUrl(`${row.name} rugby ${YEAR}`),
    }));
    writeFileSync(ALAMY_BATCH, JSON.stringify(plan, null, 2));
    console.log(`alamy batch ${plan.length} → ${ALAMY_BATCH}`);
    await runCommand("npx", [
      "tsx",
      "scripts/scrape-alamy-player-searches.ts",
      `--batch=${ALAMY_BATCH}`,
      `--out=${ALAMY_HITS}`,
      `--limit=${plan.length}`,
      "--delay=700",
    ]);
    await runCommand("npx", [
      "tsx",
      "--env-file=.env",
      "--require",
      "./scripts/stub-server-only.cjs",
      "scripts/import-alamy-player-search-hits.ts",
      `--file=${ALAMY_HITS}`,
    ]);
  }

  const leftover = await loadMissingPlayers();
  console.log(`1987 still missing after fill: ${leftover.length}`);
  if (leftover.length) {
    console.log(leftover.map((row) => row.name).join(", "));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
