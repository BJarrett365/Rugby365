/**
 * Register an AI cartoon avatar in player_images and optionally set as primary.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/register-cartoon-avatar.ts \
 *     --player-id=<uuid> \
 *     --image-url=/player-avatars/allan-alaalatoa.png \
 *     --source-url=https://upload.wikimedia.org/... \
 *     --set-primary
 */
import { playerImages } from "@rugby365/db";
import { and, eq } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { registerAiCartoonPlayerImage } from "../apps/web/src/lib/player-image-service";

const args = process.argv.slice(2);
const playerId = args.find((a) => a.startsWith("--player-id="))?.split("=")[1];
const imageUrl = args.find((a) => a.startsWith("--image-url="))?.split("=")[1];
const sourceUrl = args.find((a) => a.startsWith("--source-url="))?.split("=")[1];
const setPrimary = args.includes("--set-primary");
const widthPx = Number(args.find((a) => a.startsWith("--width="))?.split("=")[1] ?? 1024);
const heightPx = Number(args.find((a) => a.startsWith("--height="))?.split("=")[1] ?? 1365);

async function main() {
  if (!playerId || !imageUrl) {
    console.error("Required: --player-id= --image-url=");
    process.exit(1);
  }

  const db = getDb();

  if (sourceUrl) {
    const [existingSource] = await db
      .select({ id: playerImages.id })
      .from(playerImages)
      .where(and(eq(playerImages.playerId, playerId), eq(playerImages.imageUrl, sourceUrl)))
      .limit(1);

    if (!existingSource) {
      await db.insert(playerImages).values({
        playerId,
        imageUrl: sourceUrl,
        canonicalUrl: sourceUrl,
        sourceProvider: "wikipedia",
        caption: "Source photo (Wikimedia Commons)",
        altText: "Source photo",
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
      console.log("Registered source photo in gallery:", sourceUrl);
    }
  }

  const result = await registerAiCartoonPlayerImage({
    playerId,
    imageUrl,
    sourcePhotoUrl: sourceUrl,
    widthPx,
    heightPx,
    setPrimary,
    updatedBy: "register-cartoon-avatar-script",
  });

  console.log(JSON.stringify({
    playerId,
    imageId: result.image?.id,
    imageUrl: result.image?.imageUrl,
    role: result.image?.role,
    isAiGenerated: result.image?.isAiGenerated,
    playerImageUrl: result.player?.imageUrl,
    primaryImageId: result.player?.primaryImageId,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
