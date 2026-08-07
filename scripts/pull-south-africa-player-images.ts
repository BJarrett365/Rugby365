/**
 * Pull Wikipedia/Planet Rugby images for South Africa internationals missing photos.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-south-africa-player-images.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-south-africa-player-images.ts --limit=60
 */
import { and, eq, or, sql } from "drizzle-orm";
import { createDb, playerImages, players } from "@rugby365/db";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { findPlanetRugbyImagesForPlayer } from "../apps/web/src/lib/player-image-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 60);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 450);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function registerWikiImage(playerId: string, imageUrl: string, playerName: string) {
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

async function main() {
  const db = createDb();
  const rows = await db.execute(sql`
    select id, name, slug, image_url, wikipedia_url
    from players
    where (international_team_id = ${SA_ID} or club_team_id = ${SA_ID})
      and coalesce(image_url, '') = ''
    order by (wikipedia_url is not null) desc, name asc
    limit ${limit}
  `);
  const list = rows as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    wikipedia_url: string | null;
  }>;

  console.log(`SA players missing images: ${list.length} (limit ${limit})`);

  let wikiHits = 0;
  let planetHits = 0;
  let failures = 0;

  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    process.stdout.write(`[${i + 1}/${list.length}] ${p.name}… `);
    try {
      let got = false;
      const wiki = await enrichPlayerFromWikipedia(p.id, p.name, {
        fillMissingOnly: true,
        ...(p.wikipedia_url ? { sourceUrl: p.wikipedia_url } : {}),
      });
      const [updated] = await db
        .select({ imageUrl: players.imageUrl })
        .from(players)
        .where(eq(players.id, p.id))
        .limit(1);
      if (updated?.imageUrl) {
        await registerWikiImage(p.id, updated.imageUrl, p.name);
        wikiHits += 1;
        got = true;
        console.log("wiki", wiki.reason ?? "ok");
      } else {
        const planet = await findPlanetRugbyImagesForPlayer(p.id);
        if (planet.length) {
          planetHits += 1;
          got = true;
          console.log(`planet(${planet.length})`);
        }
      }
      if (!got) {
        failures += 1;
        console.log("miss", wiki.reason ?? "");
      }
    } catch (e) {
      failures += 1;
      console.log("error", e instanceof Error ? e.message : e);
    }
    await sleep(delayMs);
  }

  const [after] = await db.execute(sql`
    select
      count(*)::int as linked,
      count(*) filter (where image_url is not null and length(btrim(image_url)) > 0)::int as with_img
    from players
    where international_team_id = ${SA_ID} or club_team_id = ${SA_ID}
  `);
  console.log("\nDone.", { wikiHits, planetHits, failures, after });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
