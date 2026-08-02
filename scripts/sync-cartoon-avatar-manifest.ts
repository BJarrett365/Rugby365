/**
 * Re-register project-owned cartoon avatar assets in the canonical database.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-cartoon-avatar-manifest.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-cartoon-avatar-manifest.ts --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { registerAiCartoonPlayerImage } from "../apps/web/src/lib/player-image-service";

type AvatarManifestEntry = {
  playerId?: string;
  name: string;
  slug: string;
  imageUrl: string;
  sourcePhotoUrl: string;
  width: number;
  height: number;
};

const dryRun = process.argv.includes("--dry-run");
const manifestPath = join(
  process.cwd(),
  "apps/web/public/player-avatars/manifest.json",
);

async function main() {
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as AvatarManifestEntry[];
  const db = getDb();
  let synced = 0;
  let missing = 0;

  for (const entry of manifest) {
    const assetPath = join(process.cwd(), "apps/web/public", entry.imageUrl);
    if (!existsSync(assetPath)) {
      console.log(`missing asset: ${entry.imageUrl}`);
      missing += 1;
      continue;
    }

    const [player] = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(eq(players.slug, entry.slug))
      .limit(1);
    if (!player) {
      console.log(`missing player: ${entry.name} (${entry.slug})`);
      missing += 1;
      continue;
    }

    if (!dryRun) {
      await registerAiCartoonPlayerImage({
        playerId: player.id,
        imageUrl: entry.imageUrl,
        sourcePhotoUrl: entry.sourcePhotoUrl,
        widthPx: entry.width,
        heightPx: entry.height,
        setPrimary: true,
        updatedBy: "sync-cartoon-avatar-manifest",
      });
    }
    synced += 1;
    console.log(`${dryRun ? "would sync" : "synced"}: ${player.name}`);
  }

  console.log(JSON.stringify({ entries: manifest.length, synced, missing, dryRun }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
