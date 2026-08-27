/**
 * Import licensed Alamy downloads dropped into media/alamy/inbox/.
 * Matches files to players by filename ≈ player name.
 * Copies into media/alamy/library/<slug>/ and registers player_images + optional primary.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-alamy-inbox-images.ts
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { createDb, playerImages, players } from "@rugby365/db";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = join(ROOT, "media/alamy/inbox");
const LIBRARY = join(ROOT, "media/alamy/library");
const PUBLIC_BASE =
  process.env.ALAMY_LOCAL_PUBLIC_BASE?.replace(/\/$/, "") ||
  "/media/alamy/library";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fileStemToQuery(file: string): string {
  return normalizeName(basename(file, extname(file)));
}

async function findPlayerByFilename(stem: string) {
  const db = createDb();
  const rows = await db.execute(sql`
    select id, name, slug, image_url
    from players
    where replace(lower(name), '-', ' ') = ${stem}
       or replace(lower(coalesce(full_name, '')), '-', ' ') = ${stem}
       or lower(slug) like ${stem.replace(/\s+/g, "-") + "%"}
    order by (slug like '%__legacy__%') asc, name asc
    limit 5
  `);
  const list = rows as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
  }>;
  // Prefer non-legacy slug
  return list.find((p) => !p.slug.includes("__legacy__")) ?? list[0] ?? null;
}

async function main() {
  if (!existsSync(INBOX)) {
    console.error(`Missing inbox: ${INBOX}`);
    process.exit(1);
  }
  mkdirSync(LIBRARY, { recursive: true });

  const files = readdirSync(INBOX).filter((f) => {
    if (f.startsWith(".") || f.toLowerCase() === "readme.md") return false;
    return IMAGE_EXT.has(extname(f).toLowerCase()) && statSync(join(INBOX, f)).isFile();
  });

  if (!files.length) {
    console.log(`No image files in ${INBOX}`);
    console.log("Drop downloads named like Abongile-Nonkontwana.jpg then re-run.");
    process.exit(0);
  }

  const db = createDb();
  let saved = 0;

  for (const file of files) {
    const stem = fileStemToQuery(file);
    const player = await findPlayerByFilename(stem);
    if (!player) {
      console.log(`skip (no player match): ${file}`);
      continue;
    }

    const destDir = join(LIBRARY, player.slug);
    mkdirSync(destDir, { recursive: true });
    const destName = `${normalizeName(player.name).replace(/\s+/g, "-")}${extname(file).toLowerCase()}`;
    const destPath = join(destDir, destName);
    copyFileSync(join(INBOX, file), destPath);

    // Serve from Next public folder mirror for local/dev
    const publicMirror = join(ROOT, "apps/web/public/media/alamy/library", player.slug);
    mkdirSync(publicMirror, { recursive: true });
    copyFileSync(destPath, join(publicMirror, destName));

    const imageUrl = `${PUBLIC_BASE}/${player.slug}/${destName}`;
    const canonicalUrl = `alamy-local:${player.slug}:${destName}`;

    const [existing] = await db
      .select({ id: playerImages.id })
      .from(playerImages)
      .where(eq(playerImages.canonicalUrl, canonicalUrl))
      .limit(1);

    if (!existing) {
      const [row] = await db
        .insert(playerImages)
        .values({
          playerId: player.id,
          imageUrl,
          canonicalUrl,
          sourceProvider: "alamy",
          caption: `Licensed Alamy download of ${player.name}`,
          altText: player.name,
          credit: "Alamy",
          agency: "Alamy",
          licence: "alamy",
          imageType: "action",
          role: player.image_url ? "gallery" : "primary",
          confidence: "high",
          confidenceScore: 95,
          status: "approved",
          isPublic: true,
          isAiGenerated: false,
          approvedAt: new Date(),
          discoveredAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (row && !player.image_url) {
        await db
          .update(players)
          .set({
            imageUrl: row.imageUrl,
            primaryImageId: row.id,
            primaryImageApprovedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(players.id, player.id));
      }
      saved += 1;
      console.log(`ok ${player.name} ← ${file} → ${imageUrl}`);
    } else {
      console.log(`exists ${player.name} ← ${file}`);
    }

    // Move processed file aside
    const doneDir = join(INBOX, "_imported");
    mkdirSync(doneDir, { recursive: true });
    renameSync(join(INBOX, file), join(doneDir, file));
  }

  console.log(`\nImported ${saved} image(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
