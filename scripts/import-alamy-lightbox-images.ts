/**
 * Import player images from an Alamy lightbox JSON dump.
 *
 * Extract dump (in Cursor browser after login) is written by the agent to:
 *   /tmp/alamy-lightbox-rugby365.json
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-alamy-lightbox-images.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-alamy-lightbox-images.ts --file=/tmp/alamy-lightbox-rugby365.json
 */
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createDb, players } from "@rugby365/db";
import { registerAlamyImagesForPlayer } from "../apps/web/src/lib/player-image-service";
import type { RawAlamyImage } from "../apps/web/src/lib/alamy-image-search-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const args = process.argv.slice(2);
const file =
  args.find((a) => a.startsWith("--file="))?.split("=")[1] ??
  "/tmp/alamy-lightbox-rugby365.json";
const maxPer = Number(args.find((a) => a.startsWith("--max="))?.split("=")[1] ?? 4);
const setPrimary = !args.includes("--no-primary");

type Dump = {
  lightboxId?: string;
  url?: string;
  extractedAt?: string;
  images: RawAlamyImage[];
};

async function loadTargetPlayers() {
  const db = createDb();
  const rows = await db.execute(sql`
    select distinct p.id, p.name, p.full_name, p.image_url
    from players p
    where p.international_team_id = ${SA_ID}
       or p.club_team_id = ${SA_ID}
       or exists (
         select 1 from player_transfers t where t.player_id = p.id
       )
    order by p.name asc
  `);
  return rows as unknown as Array<{
    id: string;
    name: string;
    full_name: string | null;
    image_url: string | null;
  }>;
}

async function main() {
  const raw = JSON.parse(readFileSync(file, "utf8")) as Dump;
  const images = (raw.images ?? []).filter((i) => i?.imageUrl);
  if (!images.length) {
    console.error(`No images in ${file}`);
    process.exit(1);
  }
  console.log(`Lightbox dump: ${images.length} images from ${file}`);

  const targets = await loadTargetPlayers();
  console.log(`Target players (SA + transfers): ${targets.length}`);

  let withHits = 0;
  let savedTotal = 0;
  let primarySet = 0;

  for (let i = 0; i < targets.length; i++) {
    const p = targets[i]!;
    const result = await registerAlamyImagesForPlayer(p.id, images, {
      setPrimaryIfMissing: setPrimary && !p.image_url,
      maxPerPlayer: maxPer,
    });
    if (result.savedCount > 0 || result.matched > 0) {
      withHits += 1;
      savedTotal += result.savedCount;
      if (setPrimary && !p.image_url && result.savedCount > 0) {
        const db = createDb();
        const [check] = await db
          .select({ imageUrl: players.imageUrl })
          .from(players)
          .where(eq(players.id, p.id))
          .limit(1);
        if (check?.imageUrl) primarySet += 1;
      }
      console.log(
        `[${i + 1}/${targets.length}] ${p.name}: matched=${result.matched} saved=${result.savedCount}`,
      );
    }
  }

  console.log(
    `\nDone. Players with matches: ${withHits}, rows saved: ${savedTotal}, primaries filled: ${primarySet}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
