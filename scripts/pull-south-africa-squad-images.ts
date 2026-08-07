/**
 * Prioritise images for the current Springboks match-day 23 (latest full-time fixture).
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-south-africa-squad-images.ts
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { createDb, fixturePlayers, fixtures, playerImages, players } from "@rugby365/db";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { findPlanetRugbyImagesForPlayer } from "../apps/web/src/lib/player-image-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const delayMs = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Known wiki title overrides when DB names are messy. */
const WIKI_OVERRIDES: Record<string, string> = {
  "malcolm marx": "Malcolm Marx",
  "pieter-steph du toit": "Pieter-Steph du Toit",
  "damian de allende": "Damian de Allende",
  "damian willemse": "Damian Willemse",
  "kurt-lee arendse": "Kurt-Lee Arendse",
  "jesse kriel": "Jesse Kriel",
  "jasper wiese": "Jasper Wiese",
  "cobus reinach": "Cobus Reinach",
  "manie libbok": "Manie Libbok",
  "aphelele fassi": "Aphelele Fassi",
  "wilco louw": "Wilco Louw",
  "marco van staden": "Marco van Staden",
  "hershel jantjies": "Herschel Jantjies",
  "herschel jantjies": "Herschel Jantjies",
  "ruben van heerden": "Ruben van Heerden",
  "gerhard steenkamp": "Gerhard Steenkamp (rugby union)",
  "jaco williams": "Jaco Williams (rugby union)",
  "andre-hugo venter": "Andre-Hugo Venter",
  "carlu sadie": "Carlu Sadie",
  "cobus wiese": "Cobus Wiese",
  "jan hendrik wessels": "Jan-Hendrik Wessels",
  "ben jason dixon": "Ben-Jason Dixon",
  "paul de villiers": "Paul de Villiers (rugby union)",
  "moyo simphiwe vusi": "Sacha Feinberg-Mngomezulu",
  "sacha feinberg-mngomezulu": "Sacha Feinberg-Mngomezulu",
};

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
  const [fx] = await db
    .select({ id: fixtures.id, kickoffAt: fixtures.kickoffAt })
    .from(fixtures)
    .where(
      and(
        or(eq(fixtures.homeTeamId, SA_ID), eq(fixtures.awayTeamId, SA_ID)),
        eq(fixtures.status, "full_time"),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);
  if (!fx) throw new Error("No SA full-time fixture");

  const squad = await db
    .select({
      id: players.id,
      name: players.name,
      imageUrl: players.imageUrl,
      wikipediaUrl: players.wikipediaUrl,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(and(eq(fixturePlayers.fixtureId, fx.id), eq(fixturePlayers.teamId, SA_ID)));

  const missing = squad.filter((p) => !p.imageUrl?.trim());
  console.log(`Latest squad fixture ${fx.kickoffAt?.toISOString()} — missing images: ${missing.length}`);

  let wikiHits = 0;
  let planetHits = 0;
  let misses = 0;

  for (let i = 0; i < missing.length; i++) {
    const p = missing[i]!;
    const override = WIKI_OVERRIDES[p.name.trim().toLowerCase()];
    process.stdout.write(`[${i + 1}/${missing.length}] ${p.name}${override ? ` → ${override}` : ""}… `);
    try {
      await enrichPlayerFromWikipedia(p.id, override ?? p.name, {
        fillMissingOnly: true,
        ...(override
          ? { sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(override.replace(/ /g, "_"))}` }
          : p.wikipediaUrl
            ? { sourceUrl: p.wikipediaUrl }
            : {}),
      });
      const [updated] = await db
        .select({ imageUrl: players.imageUrl })
        .from(players)
        .where(eq(players.id, p.id))
        .limit(1);
      if (updated?.imageUrl) {
        await registerWikiImage(p.id, updated.imageUrl, p.name);
        wikiHits += 1;
        console.log("wiki");
      } else {
        const planet = await findPlanetRugbyImagesForPlayer(p.id);
        const candidates = planet.candidates ?? [];
        if (candidates.length) {
          const best =
            candidates.find((c) => c.match?.level === "high") ??
            candidates.find((c) => (c.match?.score ?? 0) >= 70) ??
            candidates[0]!;
          await db
            .update(players)
            .set({ imageUrl: best.imageUrl })
            .where(and(eq(players.id, p.id), sql`coalesce(image_url,'') = ''`));
          planetHits += 1;
          console.log(`planet(${candidates.length})`);
        } else {
          misses += 1;
          console.log("miss", planet.warnings?.join("; ") || "");
        }
      }
    } catch (e) {
      misses += 1;
      console.log("error", e instanceof Error ? e.message : e);
    }
    await sleep(delayMs);
  }

  const after = await db
    .select({ name: players.name, imageUrl: players.imageUrl })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(and(eq(fixturePlayers.fixtureId, fx.id), eq(fixturePlayers.teamId, SA_ID)));
  console.log("\nDone", {
    wikiHits,
    planetHits,
    misses,
    withImg: after.filter((p) => p.imageUrl).length,
    total: after.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
