/**
 * Attach photos to every transfer-list player who is missing one.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fill-transfer-player-images.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fill-transfer-player-images.ts --write --planet --limit=400
 */
import { readFileSync } from "node:fs";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { playerImages, playerTransfers, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { normalizePlayerName } from "../apps/web/src/lib/entity-normalize";
import {
  findPlanetRugbyImagesForPlayer,
  registerWikipediaHeadshotIfMissing,
} from "../apps/web/src/lib/player-image-service";
import { fetchWikipediaOriginalImages } from "../apps/web/src/lib/wikipedia-page-image";

const args = process.argv.slice(2);
const write = args.includes("--write");
const skipWiki = args.includes("--skip-wiki");
const doPlanet = args.includes("--planet");
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.slice(8) ?? 400);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyHeadshot(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (/\.svg($|\?)/i.test(value)) return false;
  return !/flag_of|coat_of_arms|crest_of|wikimedia-button|pictogram|placeholder|question_book|crystal_clear|nuvola|logo/i.test(
    value,
  );
}

function isCommonSurname(name: string): boolean {
  const last = name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? "";
  return /^(smith|jones|williams|brown|taylor|wilson|davies|evans|thomas|lewis|harris|clark|clarke|hall|moore|martin|king|baker|green|white|lee|walker|wright|young|scott|adams|allen|anderson|bell|bennett|brooks|campbell|carter|collins|cook|cooper|cox|edwards|ellis|foster|gray|griffiths|hughes|james|jenkins|johnson|kelly|kennedy|marshall|mason|mitchell|morgan|morris|murphy|murray|owen|parker|phillips|price|reed|reid|richards|roberts|robinson|rogers|ross|russell|ryan|sanders|simpson|stevens|stewart|turner|ward|watson|wilkins|wood)$/i.test(
    last,
  );
}

function wikiTitlesForPlayer(name: string, wikipediaUrl: string | null): string[] {
  const titles: string[] = [];
  const fromUrl = titleFromWikipediaUrl(wikipediaUrl);
  if (fromUrl) titles.push(fromUrl);
  const trimmed = name.trim();
  titles.push(`${trimmed} (rugby union)`);
  if (trimmed.split(/\s+/).length >= 3 || !isCommonSurname(trimmed)) titles.push(trimmed);
  return [...new Set(titles)];
}

function titleFromWikipediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1].replace(/_/g, " "));
  } catch {
    return null;
  }
}

async function coverage() {
  const db = getDb();
  const [row] = await db.execute(sql`
    select
      count(*)::int as players,
      count(*) filter (where coalesce(p.image_url, '') <> '')::int as with_image
    from (select distinct player_id from player_transfers) x
    join players p on p.id = x.player_id
  `);
  return row as { players: number; with_image: number };
}

async function loadMissingPlayers() {
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      wikipediaUrl: players.wikipediaUrl,
      birthDate: players.birthDate,
    })
    .from(players)
    .innerJoin(playerTransfers, eq(playerTransfers.playerId, players.id))
    .where(sql`coalesce(${players.imageUrl}, '') = ''`)
    .groupBy(players.id)
    .orderBy(desc(sql`max(${playerTransfers.effectiveDate})`));
  return limit > 0 ? rows.slice(0, limit) : rows;
}

async function promoteExistingGallery() {
  const db = getDb();
  const missing = await loadMissingPlayers();
  if (!missing.length) return 0;
  const ids = missing.map((row) => row.id);
  const gallery = await db
    .select({
      id: playerImages.id,
      playerId: playerImages.playerId,
      imageUrl: playerImages.imageUrl,
      status: playerImages.status,
      sourceProvider: playerImages.sourceProvider,
      confidence: playerImages.confidence,
      confidenceScore: playerImages.confidenceScore,
    })
    .from(playerImages)
    .where(
      and(
        inArray(playerImages.playerId, ids),
        sql`coalesce(${playerImages.imageUrl}, '') <> ''`,
        sql`${playerImages.status} not in ('rejected', 'incorrect_player', 'removed')`,
        or(
          eq(playerImages.status, "approved"),
          inArray(playerImages.sourceProvider, ["wikipedia", "wikimedia", "name_twin", "alamy", "commons", "planet_rugby"]),
          eq(playerImages.confidence, "high"),
        ),
      ),
    );

  const best = new Map<string, (typeof gallery)[number]>();
  for (const img of gallery) {
    if (!isLikelyHeadshot(img.imageUrl)) continue;
    const current = best.get(img.playerId);
    const score =
      (img.status === "approved" ? 1000 : 0) +
      (["wikipedia", "wikimedia", "commons"].includes(img.sourceProvider) ? 100 : 0) +
      (img.sourceProvider === "alamy" ? 80 : 0) +
      (img.confidence === "high" ? 50 : 0) +
      (img.confidenceScore ?? 0);
    const currentScore = current
      ? (current.status === "approved" ? 1000 : 0) +
        (["wikipedia", "wikimedia", "commons"].includes(current.sourceProvider) ? 100 : 0) +
        (current.sourceProvider === "alamy" ? 80 : 0) +
        (current.confidence === "high" ? 50 : 0) +
        (current.confidenceScore ?? 0)
      : -1;
    if (!current || score > currentScore) best.set(img.playerId, img);
  }

  if (!write) return best.size;
  let applied = 0;
  for (const [playerId, img] of best) {
    await db
      .update(players)
      .set({
        imageUrl: img.imageUrl,
        primaryImageId: img.id,
        primaryImageApprovedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(players.id, playerId), sql`coalesce(${players.imageUrl}, '') = ''`));
    applied += 1;
  }
  return applied;
}

async function copyNameTwins() {
  const missing = await loadMissingPlayers();
  if (!missing.length) return 0;
  const db = getDb();
  const withPhotos = await db
    .select({ name: players.name, imageUrl: players.imageUrl })
    .from(players)
    .where(sql`coalesce(${players.imageUrl}, '') <> ''`);
  const byExact = new Map<string, string>();
  const byKey = new Map<string, string>();
  for (const row of withPhotos) {
    if (!row.imageUrl || !isLikelyHeadshot(row.imageUrl)) continue;
    if (!byExact.has(row.name)) byExact.set(row.name, row.imageUrl);
    const key = normalizePlayerName(row.name).toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, row.imageUrl);
  }

  let applied = 0;
  for (const row of missing) {
    const url = byExact.get(row.name) || byKey.get(normalizePlayerName(row.name).toLowerCase());
    if (!url) continue;
    applied += 1;
    if (!write) continue;
    await db
      .update(players)
      .set({ imageUrl: url, updatedAt: new Date() })
      .where(and(eq(players.id, row.id), sql`coalesce(${players.imageUrl}, '') = ''`));
  }
  return applied;
}

async function attachCartoonAvatars() {
  const missing = await loadMissingPlayers();
  if (!missing.length) return 0;
  let manifest: Array<{ playerId: string; imageUrl: string; name: string }> = [];
  try {
    manifest = JSON.parse(readFileSync("apps/web/public/player-avatars/manifest.json", "utf8")) as Array<{
      playerId: string;
      imageUrl: string;
      name: string;
    }>;
  } catch {
    return 0;
  }
  const byId = new Map(manifest.filter((row) => row.imageUrl).map((row) => [row.playerId, row]));
  let applied = 0;
  for (const row of missing) {
    const avatar = byId.get(row.id);
    if (!avatar?.imageUrl) continue;
    if (!write) {
      applied += 1;
      continue;
    }
    if (await registerWikipediaHeadshotIfMissing(row.id, avatar.imageUrl, row.name)) applied += 1;
  }
  return applied;
}

async function fillFromWikipedia() {
  const missing = await loadMissingPlayers();
  if (!missing.length) return 0;

  const titles = missing.flatMap((row) => wikiTitlesForPlayer(row.name, row.wikipediaUrl));
  const uniqueTitles = [...new Set(titles)];
  console.log(`Wikipedia lookup: ${missing.length} players, ${uniqueTitles.length} titles`);
  const images = await fetchWikipediaOriginalImages(uniqueTitles);
  console.log(`Wikipedia hits: ${images.size}`);
  let applied = 0;
  for (const row of missing) {
    const candidates = wikiTitlesForPlayer(row.name, row.wikipediaUrl);
    const url = candidates.map((title) => images.get(title)).find((value) => value && isLikelyHeadshot(value)) || null;
    if (!url || !isLikelyHeadshot(url)) continue;
    if (!write) {
      applied += 1;
      continue;
    }
    if (await registerWikipediaHeadshotIfMissing(row.id, url, row.name)) applied += 1;
  }
  return applied;
}

async function fillFromPlanetRugby() {
  const db = getDb();
  const missing = await loadMissingPlayers();
  if (!missing.length) return 0;
  let applied = 0;
  for (let i = 0; i < missing.length; i++) {
    const row = missing[i]!;
    process.stdout.write(`[planet ${i + 1}/${missing.length}] ${row.name}… `);
    try {
      const result = await findPlanetRugbyImagesForPlayer(row.id);
      const ranked = [...result.candidates]
        .filter((candidate) => isLikelyHeadshot(candidate.imageUrl))
        .sort((a, b) => b.match.score - a.match.score);
      const best =
        ranked.find((candidate) => candidate.match.level === "high") ||
        ranked.find((candidate) => candidate.match.score >= 35) ||
        ranked[0];
      if (write && best) {
        await db
          .update(players)
          .set({ imageUrl: best.imageUrl, updatedAt: new Date() })
          .where(and(eq(players.id, row.id), sql`coalesce(${players.imageUrl}, '') = ''`));
        applied += 1;
        console.log(`photo (${best.match.level}/${best.match.score})`);
      } else {
        console.log(result.savedCount ? `candidates=${result.savedCount}` : "miss");
      }
    } catch (error) {
      console.log(error instanceof Error ? error.message.slice(0, 80) : "error");
    }
    if (i < missing.length - 1) await sleep(delayMs);
  }
  return applied;
}

async function main() {
  const before = await coverage();
  console.log(`${write ? "WRITE" : "DRY"} · transfer players ${before.with_image}/${before.players} have photos`);

  const gallery = await promoteExistingGallery();
  console.log(`Existing gallery/headshots attached: ${gallery}`);
  const twins = await copyNameTwins();
  console.log(`Name-twin photos: ${twins}`);
  const cartoons = await attachCartoonAvatars();
  console.log(`Cartoon avatars: ${cartoons}`);
  if (!skipWiki) {
    const wiki = await fillFromWikipedia();
    console.log(`Wikipedia photos: ${wiki}`);
  }
  let planet = 0;
  if (doPlanet) {
    planet = await fillFromPlanetRugby();
    console.log(`Planet Rugby photos: ${planet}`);
  }

  const after = await coverage();
  console.log(
    `Done · ${after.with_image}/${after.players} transfer players have photos (was ${before.with_image})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
