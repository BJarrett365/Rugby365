/**
 * Generate cel-shaded cartoon avatars for players that already have a rights-safe
 * source photo (Wikimedia / Planet Rugby). Requires OPENAI_API_KEY (env or Admin → Keys).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/generate-cartoon-avatars.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/generate-cartoon-avatars.ts --limit=20
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/generate-cartoon-avatars.ts --limit=100 --delay=2000
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { createDb } from "../packages/db/src/client";
import { getOpenAiApiKey } from "../apps/web/src/lib/openai-client";
import { registerAiCartoonPlayerImage } from "../apps/web/src/lib/player-image-service";

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 25;
const delayArg = args.find((a) => a.startsWith("--delay="));
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 1500;
const modelArg = args.find((a) => a.startsWith("--model="));
const model = modelArg?.split("=")[1] ?? "gpt-image-1";

const STYLE_REF = join(
  process.cwd(),
  "docs/knowledge/assets/player-avatar-style-reference.png",
);
const OUT_DIR = join(process.cwd(), "apps/web/public/player-avatars");
const MANIFEST_PATH = join(OUT_DIR, "manifest.json");

type AvatarManifestEntry = {
  playerId: string;
  name: string;
  slug: string;
  imageUrl: string;
  sourcePhotoUrl: string;
  width: number;
  height: number;
};

const STYLE_PROMPT = `Transform the rugby player photograph into a cel-shaded vector cartoon sports avatar matching this exact illustration style:
- Clean digital vector / cel-shaded portrait with hard-edged colour planes (not photorealistic)
- Head-and-shoulders composition, subject facing forward, friendly confident expression
- Pure white background with soft painterly brushstroke accents behind the shoulders in the jersey team colours
- Crisp outlines, vibrant saturated colours, polished sports-card / esports avatar look
- Keep the player's real facial likeness, skin tone, hair, and jersey colours from the source photo
- Vertical 3:4 portrait framing with headroom above the hair and crop at mid-chest
- No text, watermarks, or readable sponsor logos`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function avatarFilename(slug: string) {
  return `${slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "player"}.png`;
}

function updateManifest(entry: AvatarManifestEntry) {
  const current = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as AvatarManifestEntry[])
    : [];
  const next = current.filter((row) => row.slug !== entry.slug);
  next.push(entry);
  next.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(next, null, 2)}\n`);
}

async function candidates() {
  const db = createDb();
  const rows = await db.execute(sql`
    select p.id, p.name, p.slug, p.image_url, p.club_name, p.country_name
    from players p
    where coalesce(p.image_url, '') <> ''
      and (
        p.image_url like '%wikimedia%'
        or p.image_url like '%wikipedia%'
        or p.image_url like '%planetrugby%'
        or p.image_url like '%ps-aws%'
        or p.image_url like '%cloudfront%'
      )
      and p.image_url not like '/player-avatars/%'
      and not exists (
        select 1 from player_images pi
        where pi.player_id = p.id
          and pi.is_ai_generated = true
          and pi.status in ('approved', 'candidate')
      )
    order by p.name asc
    limit ${limit}
  `);
  return rows as Array<{
    id: string;
    name: string;
    slug: string;
    image_url: string;
    club_name: string | null;
    country_name: string | null;
  }>;
}

async function downloadImage(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Rugby365Bot/1.0 (+https://rugby365.com)" },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}

async function generateCartoonPng(sourceBytes: Buffer, sourceType: string, playerName: string) {
  const key = await getOpenAiApiKey();
  if (!key) {
    throw new Error(
      "OpenAI API key missing. Add OPENAI_API_KEY to .env or save a key in Admin → Keys → OpenAI.",
    );
  }

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", `${STYLE_PROMPT}\n\nPlayer: ${playerName}`);
  form.append("size", "1024x1536");
  form.append("quality", "high");
  form.append(
    "image",
    new Blob([sourceBytes], { type: sourceType }),
    sourceType.includes("png") ? "source.png" : "source.jpg",
  );

  if (!existsSync(STYLE_REF)) {
    throw new Error(`Project style reference is missing: ${STYLE_REF}`);
  }
  const styleBytes = readFileSync(STYLE_REF);
  form.append("image", new Blob([styleBytes], { type: "image/png" }), "style-ref.png");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI images/edits failed (${res.status}): ${err.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = data.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error("Failed to download generated image URL");
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error("OpenAI response missing image data");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("=== Generate cartoon avatars ===");
  console.log(JSON.stringify({ auditOnly, limit, delayMs, model }, null, 2));

  const list = await candidates();
  console.log(`Candidates: ${list.length}`);
  if (auditOnly) {
    for (const row of list.slice(0, 25)) {
      console.log(`  · ${row.name} (${row.slug})`);
    }
    return;
  }

  const key = await getOpenAiApiKey();
  if (!key) {
    console.error(
      "\nNo OpenAI API key configured.\n" +
        "Add OPENAI_API_KEY to .env or Admin → Keys → OpenAI, then re-run.\n" +
        "Until then, source photos can still be pulled with:\n" +
        "  npm run pull:player-images -- --wikipedia --planet\n",
    );
    process.exit(2);
  }

  const summary = { processed: 0, generated: 0, failed: 0 };

  for (let i = 0; i < list.length; i++) {
    const row = list[i]!;
    summary.processed += 1;
    const filename = avatarFilename(row.slug);
    const absPath = join(OUT_DIR, filename);
    const publicUrl = `/player-avatars/${filename}`;

    try {
      console.log(`[${i + 1}/${list.length}] ${row.name} — downloading source…`);
      const { bytes, contentType } = await downloadImage(row.image_url);
      console.log(`[${i + 1}/${list.length}] ${row.name} — generating cartoon…`);
      const png = await generateCartoonPng(bytes, contentType, row.name);
      const profilePng = await sharp(png)
        .resize(1024, 1365, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      writeFileSync(absPath, profilePng);

      await registerAiCartoonPlayerImage({
        playerId: row.id,
        imageUrl: publicUrl,
        sourcePhotoUrl: row.image_url,
        widthPx: 1024,
        heightPx: 1365,
        setPrimary: true,
        updatedBy: "generate-cartoon-avatars-script",
      });
      updateManifest({
        playerId: row.id,
        name: row.name,
        slug: row.slug,
        imageUrl: publicUrl,
        sourcePhotoUrl: row.image_url,
        width: 1024,
        height: 1365,
      });

      summary.generated += 1;
      console.log(`[${i + 1}/${list.length}] ${row.name} — saved ${publicUrl}`);
    } catch (error) {
      summary.failed += 1;
      console.log(
        `[${i + 1}/${list.length}] ${row.name} — fail ${error instanceof Error ? error.message.slice(0, 200) : error}`,
      );
    }

    if (i < list.length - 1) await sleep(delayMs);
  }

  console.log("\nSummary:", JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
