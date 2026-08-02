/**
 * Pull player source photos from Wikipedia + Planet Rugby (rights-safe hosts).
 * Does not create players. Does not overwrite approved primary images.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-player-source-images.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-player-source-images.ts --wikipedia --limit=200
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-player-source-images.ts --planet --days=365 --limit=300
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-player-source-images.ts --wikipedia --planet --limit=500
 */
import { sql } from "drizzle-orm";
import { createDb, playerImages, players } from "@rugby365/db";
import { eq, and } from "drizzle-orm";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { findPlanetRugbyImagesForPlayer } from "../apps/web/src/lib/player-image-service";

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const doWiki = args.includes("--wikipedia");
const doPlanet = args.includes("--planet");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;
const daysArg = args.find((a) => a.startsWith("--days="));
const days = daysArg ? Number(daysArg.split("=")[1]) : 365;
const delayArg = args.find((a) => a.startsWith("--delay="));
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 450;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function coverage() {
  const db = createDb();
  const [c] = await db.execute(sql`
    select
      count(*)::int as players,
      count(*) filter (where coalesce(image_url,'') <> '')::int as with_image,
      count(*) filter (where image_url like '%wikimedia%' or image_url like '%wikipedia%')::int as wiki,
      count(*) filter (where image_url like '%planetrugby%' or image_url like '%ps-aws%' or image_url like '%cloudfront%')::int as planet,
      count(*) filter (where image_url like '/player-avatars/%')::int as cartoons,
      (select count(*)::int from player_images where is_ai_generated and status='approved') as approved_cartoons
    from players
  `);
  return c;
}

async function registerWikiImageInGallery(playerId: string, imageUrl: string, playerName: string) {
  const db = createDb();
  const [existing] = await db
    .select({ id: playerImages.id })
    .from(playerImages)
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.imageUrl, imageUrl)))
    .limit(1);
  if (existing) return;
  await db.insert(playerImages).values({
    playerId,
    imageUrl,
    canonicalUrl: imageUrl,
    sourceProvider: "wikipedia",
    caption: `Wikipedia / Wikimedia Commons photo of ${playerName}`,
    altText: playerName,
    credit: "Wikimedia Commons",
    licence: "creative_commons",
    imageType: "headshot",
    role: "gallery",
    confidence: "high",
    confidenceScore: 90,
    status: "approved",
    isPublic: true,
    isAiGenerated: false,
    approvedAt: new Date(),
    discoveredAt: new Date(),
    updatedAt: new Date(),
  });
}

async function wikiCandidates() {
  const db = createDb();
  // Prefer linked wikipedia pages, then any incomplete recent players
  const rows = await db.execute(sql`
    select id, name, slug, wikipedia_url, image_url
    from players
    where coalesce(image_url, '') = ''
      and (
        wikipedia_url is not null
        or wikidata_id is not null
      )
    order by (wikipedia_url is not null) desc, name asc
    limit ${limit}
  `);
  return rows as Array<{
    id: string;
    name: string;
    slug: string;
    wikipedia_url: string | null;
    image_url: string | null;
  }>;
}

async function planetCandidates() {
  const db = createDb();
  const rows = await db.execute(sql`
    select p.id, p.name, p.slug, count(*)::int as appearances
    from players p
    join fixture_players fp on fp.player_id = p.id
    join fixtures f on f.id = fp.fixture_id
    where f.kickoff_at > now() - (${days}::int * interval '1 day')
      and coalesce(p.image_url, '') = ''
      and not exists (
        select 1 from player_images pi
        where pi.player_id = p.id and pi.source_provider = 'planet_rugby'
      )
    group by p.id
    order by count(*) desc, p.name asc
    limit ${limit}
  `);
  return rows as Array<{ id: string; name: string; slug: string; appearances: number }>;
}

async function main() {
  if (!auditOnly && !doWiki && !doPlanet) {
    console.error("Pass --wikipedia and/or --planet (or --audit)");
    process.exit(1);
  }

  console.log("=== Pull player source images ===");
  console.log(JSON.stringify({ auditOnly, doWiki, doPlanet, limit, days, delayMs }, null, 2));
  console.log("Coverage before:", await coverage());

  if (auditOnly) {
    const wiki = await wikiCandidates();
    const planet = await planetCandidates();
    console.log(`Wikipedia candidates: ${wiki.length}`);
    console.log(`Planet Rugby candidates: ${planet.length}`);
    return;
  }

  const summary = {
    wikiProcessed: 0,
    wikiImages: 0,
    wikiMiss: 0,
    planetProcessed: 0,
    planetCandidates: 0,
    planetErrors: 0,
  };

  if (doWiki) {
    const list = await wikiCandidates();
    console.log(`Wikipedia enrich: ${list.length}`);
    for (let i = 0; i < list.length; i++) {
      const row = list[i]!;
      summary.wikiProcessed += 1;
      try {
        const result = await enrichPlayerFromWikipedia(row.id, row.name, {
          fillMissingOnly: true,
        });
        const db = createDb();
        const [updated] = await db
          .select({ imageUrl: players.imageUrl })
          .from(players)
          .where(eq(players.id, row.id))
          .limit(1);
        if (updated?.imageUrl && !row.image_url) {
          summary.wikiImages += 1;
          await registerWikiImageInGallery(row.id, updated.imageUrl, row.name);
          console.log(`[wiki ${i + 1}/${list.length}] ${row.name} — image ${updated.imageUrl.slice(0, 70)}`);
        } else {
          summary.wikiMiss += 1;
          console.log(
            `[wiki ${i + 1}/${list.length}] ${row.name} — ${result.reason ?? (result.fieldsUpdated?.join(",") || "no image")}`,
          );
        }
      } catch (error) {
        summary.wikiMiss += 1;
        console.log(
          `[wiki ${i + 1}/${list.length}] ${row.name} — error ${error instanceof Error ? error.message.slice(0, 120) : error}`,
        );
      }
      if (i < list.length - 1) await sleep(delayMs);
    }
  }

  if (doPlanet) {
    const list = await planetCandidates();
    console.log(`Planet Rugby find: ${list.length}`);
    for (let i = 0; i < list.length; i++) {
      const row = list[i]!;
      summary.planetProcessed += 1;
      try {
        const result = await findPlanetRugbyImagesForPlayer(row.id);
        summary.planetCandidates += result.savedCount;
        console.log(
          `[planet ${i + 1}/${list.length}] ${row.name} — saved ${result.savedCount}, pages ${result.searchedPages}`,
        );
      } catch (error) {
        summary.planetErrors += 1;
        console.log(
          `[planet ${i + 1}/${list.length}] ${row.name} — error ${error instanceof Error ? error.message.slice(0, 120) : error}`,
        );
      }
      if (i < list.length - 1) await sleep(Math.max(delayMs, 800));
    }
  }

  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  console.log("Coverage after:", await coverage());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
