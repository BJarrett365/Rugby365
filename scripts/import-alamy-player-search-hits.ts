/**
 * Build Alamy search dump for SA players missing images by browsing Alamy
 * search result pages (public). Used with Cursor browser CDP extraction, or:
 *
 *   Keep appending to /tmp/alamy-player-image-hits.json via agent, then:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-alamy-player-search-hits.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import { registerAlamyImagesForPlayer } from "../apps/web/src/lib/player-image-service";
import type { RawAlamyImage } from "../apps/web/src/lib/alamy-image-search-service";

const args = process.argv.slice(2);
const file =
  args.find((a) => a.startsWith("--file="))?.split("=")[1] ??
  "/tmp/alamy-player-image-hits.json";

type Hit = {
  playerId: string;
  playerName: string;
  searchUrl?: string;
  images: RawAlamyImage[];
};

async function main() {
  if (!existsSync(file)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }
  const hits = JSON.parse(readFileSync(file, "utf8")) as Hit[];
  let saved = 0;
  let players = 0;
  for (const hit of hits) {
    if (!hit.images?.length) continue;
    const r = await registerAlamyImagesForPlayer(hit.playerId, hit.images, {
      setPrimaryIfMissing: true,
      maxPerPlayer: 3,
    });
    if (r.savedCount > 0) {
      players += 1;
      saved += r.savedCount;
      console.log(`${hit.playerName}: saved ${r.savedCount}`);
    } else if (r.matched > 0) {
      console.log(`${hit.playerName}: matched ${r.matched} (already saved)`);
    } else {
      console.log(`${hit.playerName}: no name match on extracted alts`);
    }
  }
  console.log(`\nPlayers updated: ${players}, rows saved: ${saved}`);
}

/** Utility: print search URLs for a player list JSON */
export function printSearchPlan(playerListFile: string) {
  const list = JSON.parse(readFileSync(playerListFile, "utf8")) as Array<{
    id: string;
    name: string;
  }>;
  const plan = list.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    searchUrl: alamyStockPhotoSearchUrl(`${p.name} rugby`),
  }));
  writeFileSync("/tmp/alamy-search-plan.json", JSON.stringify(plan, null, 2));
  console.log(`Wrote ${plan.length} URLs to /tmp/alamy-search-plan.json`);
}

if (args.includes("--plan")) {
  printSearchPlan(
    args.find((a) => a.startsWith("--players="))?.split("=")[1] ??
      "/tmp/sa-players-missing-images.json",
  );
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
