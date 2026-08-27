/**
 * Import Springboks player careers from Wikipedia and derive club transfers.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-sa-wiki-transfers.ts
 */
import { eq, ilike, or, sql } from "drizzle-orm";
import { players, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";
import { resolvePlayer } from "../apps/web/src/lib/entity-resolve-service";
import {
  enrichPlayerFromWikipedia,
  importWikipediaArchive,
} from "../apps/web/src/lib/wikipedia-import-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";

const SEED_PLAYER_URLS = [
  "https://en.wikipedia.org/wiki/Siya_Kolisi",
  "https://en.wikipedia.org/wiki/Cheslin_Kolbe",
  "https://en.wikipedia.org/wiki/Eben_Etzebeth",
  "https://en.wikipedia.org/wiki/Handr%C3%A9_Pollard",
  "https://en.wikipedia.org/wiki/Damian_de_Allende",
  "https://en.wikipedia.org/wiki/Pieter-Steph_du_Toit",
  "https://en.wikipedia.org/wiki/Faf_de_Klerk",
  "https://en.wikipedia.org/wiki/Malcolm_Marx",
  "https://en.wikipedia.org/wiki/Kwagga_Smith",
  "https://en.wikipedia.org/wiki/Jesse_Kriel",
];

const SQUAD_PAGE = "https://en.wikipedia.org/wiki/South_Africa_national_rugby_union_team";

function titleFromWikiUrl(url: string): string {
  const path = new URL(url).pathname.replace(/^\/wiki\//, "");
  return decodeURIComponent(path.replace(/_/g, " "));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWikitext(titleOrUrl: string): Promise<string> {
  const title = titleOrUrl.includes("wikipedia.org")
    ? titleFromWikiUrl(titleOrUrl)
    : titleOrUrl;
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "parse");
  api.searchParams.set("page", title);
  api.searchParams.set("prop", "wikitext");
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  const res = await fetch(api, {
    headers: { "User-Agent": "Rugby365Bot/1.0 (transfer-import; local)" },
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status} for ${title}`);
  const json = (await res.json()) as { parse?: { wikitext?: string }; error?: { info?: string } };
  if (json.error?.info) throw new Error(json.error.info);
  return json.parse?.wikitext ?? "";
}

/** Extract linked player names from Current squad rugby templates. */
function extractSquadPlayerNames(wikitext: string): string[] {
  const section =
    wikitext.split(/==\s*Current squad\s*==/i)[1]?.split(/^==[^=]/m)[0] ?? "";
  if (!section) return [];
  const names = new Set<string>();
  // {{Rlp|Siya Kolisi}} / player = [[Name]] / name = [[Name]]
  for (const match of section.matchAll(
    /\{\{\s*(?:rlp|rugbyunionplayer|player)\s*\|\s*([^}|]+)/gi,
  )) {
    const name = match[1]!.replace(/_/g, " ").trim();
    if (name && /\s/.test(name)) names.add(name);
  }
  for (const match of section.matchAll(
    /(?:player|name|captain)\s*=\s*\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/gi,
  )) {
    const name = match[1]!.trim();
    if (name && /\s/.test(name) && !/rugby|stadium|cup/i.test(name)) names.add(name);
  }
  return [...names];
}

async function ensureSaTeam() {
  const db = getDb();
  const [sa] = await db.select().from(teams).where(eq(teams.id, SA_ID)).limit(1);
  if (!sa) throw new Error(`South Africa team ${SA_ID} not found`);
  if (sa.teamType !== "international") {
    await db.update(teams).set({ teamType: "international", shortName: sa.shortName ?? "Springboks" }).where(eq(teams.id, SA_ID));
  }
}

async function linkPlayerToSa(playerId: string) {
  const db = getDb();
  await db
    .update(players)
    .set({
      internationalTeamId: SA_ID,
      countryName: "South Africa",
      nationCode: "ZA",
    })
    .where(eq(players.id, playerId));
}

async function importPlayerByWikiUrl(url: string) {
  const title = titleFromWikiUrl(url);
  const imported = await importWikipediaArchive({
    articleTitleOrUrl: url,
    entityType: "player",
  });
  if (imported.entityType !== "player") {
    throw new Error(`${title} is not a player article`);
  }

  await linkPlayerToSa(imported.entityId);
  // Career upsert already syncs transfers; run again to be safe if older code path skipped it.
  const sync = await syncTransfersFromClubCareerStints(imported.entityId);
  const clubStints =
    imported.archive && "clubCareer" in imported.archive
      ? (imported.archive.clubCareer?.length ?? 0)
      : 0;

  return {
    name: imported.archive.name,
    playerId: imported.entityId,
    created: imported.created,
    clubStints,
    sync,
  };
}

async function importPlayerByName(name: string) {
  const db = getDb();
  const [existing] = await db
    .select({ id: players.id, wikipediaUrl: players.wikipediaUrl })
    .from(players)
    .where(or(ilike(players.name, name), sql`lower(${players.name}) = ${name.toLowerCase()}`))
    .limit(1);

  let playerId = existing?.id;
  if (!playerId) {
    const resolved = await resolvePlayer({ name, createIfMissing: true, skipArchiveEnrich: true });
    playerId = resolved?.id;
  }
  if (!playerId) throw new Error(`Could not resolve player ${name}`);

  const result = await enrichPlayerFromWikipedia(playerId, name, {
    fillMissingOnly: false,
    sourceUrl: existing?.wikipediaUrl ?? undefined,
  });
  await linkPlayerToSa(playerId);
  const sync = await syncTransfersFromClubCareerStints(playerId);
  return { name, playerId, enriched: result.enriched, reason: result.reason, sync };
}

async function main() {
  await ensureSaTeam();
  const seedOnly = process.argv.includes("--seed-only");

  console.log("→ Importing seed Springbok Wikipedia pages…");
  for (const url of SEED_PLAYER_URLS) {
    try {
      const result = await importPlayerByWikiUrl(url);
      console.log(
        `  ✓ ${result.name}: clubs=${result.clubStints} transfers +${result.sync.created}/~${result.sync.updated}`,
      );
    } catch (error) {
      console.error(`  ✗ ${titleFromWikiUrl(url)}:`, error instanceof Error ? error.message : error);
    }
    await sleep(400);
  }

  if (!seedOnly) {
    console.log("\n→ Harvesting extra names from Current squad…");
    const squadText = await fetchWikitext(SQUAD_PAGE);
    const seedTitles = new Set(SEED_PLAYER_URLS.map(titleFromWikiUrl));
    const extra = extractSquadPlayerNames(squadText)
      .filter((n) => !seedTitles.has(n))
      .slice(0, 35);
    console.log(`  Found ${extra.length} extra squad player names…`);

    for (const name of extra) {
      try {
        const result = await importPlayerByName(name);
        console.log(
          `  ✓ ${result.name}: enriched=${result.enriched} transfers +${result.sync.created}/~${result.sync.updated}${
            result.reason ? ` (${result.reason})` : ""
          }`,
        );
      } catch (error) {
        console.error(`  ✗ ${name}:`, error instanceof Error ? error.message : error);
      }
      await sleep(450);
    }
  }

  const db = getDb();
  const { playerTransfers } = await import("@rugby365/db");
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .where(eq(players.internationalTeamId, SA_ID));
  console.log(`\nDone. Transfers for Springboks-linked players: ${row?.n ?? "?"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
