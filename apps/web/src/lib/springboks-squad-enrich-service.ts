/**
 * Import current Springboks squad from springboks.rugby into players,
 * attach official headshots, then run the same full-profile enrichment
 * used for Sacha (Wikipedia, RugbyPass, Ultimate Rugby, transfers,
 * ratings, value history, scout intelligence).
 */
import { eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "./db";
import { resolvePlayer } from "./entity-resolve-service";
import { registerSpringboksOfficialImage } from "./player-image-service";
import { enrichPlayerFromWikipedia } from "./wikipedia-import-service";
import { enrichPlayerFromRugbyPass } from "./rugbypass-player-import-service";
import { importUltimateRugbyPlayerProfile } from "./ultimate-rugby-import-service";
import {
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
} from "./ultimate-rugby-parse";
import { syncTransfersFromClubCareerStints } from "./career-transfer-sync-service";
import { calculateAndPersistPlayerRating } from "./player-bio-packet-service";
import { backfillPlayerValueHistory } from "./player-value-history-service";
import { recalculatePlayerScoutProfile } from "./player-scout-intelligence-service";
import {
  SPRINGBOKS_PROVIDER,
  fetchSpringboksSquadCards,
  type SpringboksSquadCard,
} from "./springboks-rugby-parse";

export const SOUTH_AFRICA_TEAM_ID = "b0000000-0000-4000-8000-000000000001";

export type SpringboksSquadEnrichOptions = {
  dryRun?: boolean;
  limit?: number;
  delayMs?: number;
  skipImages?: boolean;
  skipWikipedia?: boolean;
  skipRugbyPass?: boolean;
  skipUltimateRugby?: boolean;
  skipRatings?: boolean;
  skipValue?: boolean;
  skipScout?: boolean;
  playerSlug?: string | null;
  onProgress?: (message: string) => void;
};

export type SpringboksPlayerEnrichResult = {
  slug: string;
  name: string;
  playerId: string | null;
  created: boolean;
  image: string;
  wiki: string;
  rugbypass: string;
  ultimateRugby: string;
  transfers: string;
  ratings: string;
  value: string;
  scout: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertSquadIdentity(card: SpringboksSquadCard, dryRun: boolean) {
  const db = getDb();

  // Prefer exact slug, then springboks slug prefix (cms often appends -hash).
  const [byExact] = await db
    .select()
    .from(players)
    .where(eq(players.slug, card.slug))
    .limit(1);
  const [byPrefix] = byExact
    ? [null]
    : await db
        .select()
        .from(players)
        .where(sql`${players.slug} like ${`${card.slug}-%`}`)
        .orderBy(sql`length(${players.slug}) asc`)
        .limit(1);

  let player = byExact ?? byPrefix ?? null;

  if (!player) {
    player = await resolvePlayer({
      name: card.name,
      positionName: card.position ?? undefined,
      countryName: "South Africa",
      internationalTeamId: SOUTH_AFRICA_TEAM_ID,
      createIfMissing: !dryRun,
      sourceProvider: SPRINGBOKS_PROVIDER,
      externalProviderId: card.externalPlayerId
        ? `springboks:${card.externalPlayerId}`
        : `springboks-slug:${card.slug}`,
    });
  }

  if (!player) {
    return { player: null, created: false };
  }

  if (dryRun) return { player, created: false };

  // Adopt the official springboks.rugby slug when free (or already ours).
  let nextSlug = player.slug;
  if (player.slug !== card.slug) {
    const [taken] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.slug, card.slug))
      .limit(1);
    if (!taken || taken.id === player.id) {
      nextSlug = card.slug;
    }
  }

  await db
    .update(players)
    .set({
      slug: nextSlug,
      internationalTeamId: SOUTH_AFRICA_TEAM_ID,
      countryName: "South Africa",
      positionName: card.position ?? player.positionName,
      isPublic: true,
      publishStatus: "published",
      updatedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, player.id));

  return { player: { ...player, slug: nextSlug }, created: false };
}

async function enrichOnePlayer(
  card: SpringboksSquadCard,
  opts: SpringboksSquadEnrichOptions,
): Promise<SpringboksPlayerEnrichResult> {
  const dryRun = Boolean(opts.dryRun);
  const log = opts.onProgress ?? (() => undefined);
  const result: SpringboksPlayerEnrichResult = {
    slug: card.slug,
    name: card.name,
    playerId: null,
    created: false,
    image: "skip",
    wiki: "skip",
    rugbypass: "skip",
    ultimateRugby: "skip",
    transfers: "skip",
    ratings: "skip",
    value: "skip",
    scout: "skip",
  };

  try {
    const { player, created } = await upsertSquadIdentity(card, dryRun);
    if (!player) {
      result.error = "resolve_failed";
      return result;
    }
    result.playerId = player.id;
    result.created = created;
    log(`  id=${player.id}${created ? " (new/linked)" : ""}`);

    if (!opts.skipImages && card.imageUrl) {
      if (dryRun) {
        result.image = "dry-run";
      } else {
        log(`  → image…`);
        const img = await registerSpringboksOfficialImage(player.id, card.imageUrl, {
          sourcePageUrl: card.profileUrl,
          playerName: card.name,
          forcePrimary: true,
        });
        result.image = img.reason;
        log(`  ← image ${img.reason}`);
      }
    }

    if (!opts.skipWikipedia) {
      if (dryRun) {
        result.wiki = "dry-run";
      } else {
        log(`  → wikipedia…`);
        const wiki = await enrichPlayerFromWikipedia(player.id, player.name, {
          fillMissingOnly: false,
          sourceUrl: player.wikipediaUrl ?? undefined,
        });
        result.wiki = wiki.enriched
          ? `ok(${wiki.careerStints ?? 0})`
          : wiki.reason ?? "noop";
        log(`  ← wikipedia ${result.wiki}`);
      }
    }

    if (!opts.skipRugbyPass) {
      if (dryRun) {
        result.rugbypass = "dry-run";
      } else {
        log(`  → rugbypass…`);
        try {
          const rp = await enrichPlayerFromRugbyPass(player.id, undefined, {
            skipMatches: true,
          });
          result.rugbypass = rp.enriched ? "ok" : rp.reason ?? "noop";
        } catch (e) {
          result.rugbypass = `err:${e instanceof Error ? e.message.slice(0, 60) : "fail"}`;
        }
        log(`  ← rugbypass ${result.rugbypass}`);
      }
    }

    if (!opts.skipUltimateRugby) {
      if (dryRun) {
        result.ultimateRugby = "dry-run";
      } else {
        log(`  → ultimate rugby…`);
        try {
          const profile = await fetchUltimateRugbyPlayerByName(player.name);
          if (!profile) {
            result.ultimateRugby = "not_found";
          } else {
            let newsItems: Awaited<ReturnType<typeof parseUltimateRugbyNewsHtml>> = [];
            try {
              const newsHtml = await fetchUltimateRugbyHtml(`${profile.url}/news`);
              newsItems = parseUltimateRugbyNewsHtml(newsHtml, profile.path);
            } catch {
              newsItems = [];
            }
            const ur = await importUltimateRugbyPlayerProfile(profile, {
              internationalTeamId: SOUTH_AFRICA_TEAM_ID,
              countryName: "South Africa",
              dryRun: false,
              newsItems,
            });
            result.ultimateRugby = ur.skipped
              ? `skip:${ur.skipped}`
              : `ok(bio=${ur.bioChars},stints=${ur.careerStints},news=${ur.newsItems})`;
          }
        } catch (e) {
          result.ultimateRugby = `err:${e instanceof Error ? e.message.slice(0, 60) : "fail"}`;
        }
        log(`  ← ultimate rugby ${result.ultimateRugby}`);
      }
    }

    if (!dryRun) {
      log(`  → transfers…`);
      const transfers = await syncTransfersFromClubCareerStints(player.id);
      result.transfers = `+${transfers.created}/~${transfers.updated}`;
      log(`  ← transfers ${result.transfers}`);
    } else {
      result.transfers = "dry-run";
    }

    if (!opts.skipRatings && !dryRun) {
      log(`  → ratings…`);
      try {
        // Overall rating packet only — per-fixture backfill is too slow for squad batch.
        await calculateAndPersistPlayerRating(player.id);
        result.ratings = "ok";
      } catch (e) {
        result.ratings = `err:${e instanceof Error ? e.message.slice(0, 60) : "fail"}`;
      }
      log(`  ← ratings ${result.ratings}`);
    }

    if (!opts.skipValue && !dryRun) {
      log(`  → value history…`);
      try {
        const value = await backfillPlayerValueHistory(player.id, { range: "career" });
        result.value = `ok(+${value.inserted}/skip${value.skipped})`;
      } catch (e) {
        result.value = `err:${e instanceof Error ? e.message.slice(0, 60) : "fail"}`;
      }
      log(`  ← value ${result.value}`);
    }

    if (!opts.skipScout && !dryRun) {
      log(`  → scout…`);
      try {
        await recalculatePlayerScoutProfile(player.id);
        result.scout = "ok";
      } catch (e) {
        result.scout = `err:${e instanceof Error ? e.message.slice(0, 60) : "fail"}`;
      }
      log(`  ← scout ${result.scout}`);
    }

    return result;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}

export async function enrichSpringboksSquadFromOfficialSite(
  opts: SpringboksSquadEnrichOptions = {},
): Promise<{ cards: number; results: SpringboksPlayerEnrichResult[] }> {
  const log = opts.onProgress ?? console.log;
  let cards = await fetchSpringboksSquadCards();
  if (opts.playerSlug) {
    const needle = opts.playerSlug.replace(/^\/+/, "").toLowerCase();
    cards = cards.filter((c) => c.slug === needle || c.slug.includes(needle));
  }
  if (opts.limit != null && Number.isFinite(opts.limit)) {
    cards = cards.slice(0, Math.max(0, opts.limit));
  }

  log(`Springboks squad cards: ${cards.length}${opts.dryRun ? " [DRY RUN]" : ""}`);
  const results: SpringboksPlayerEnrichResult[] = [];
  const delayMs = opts.delayMs ?? 600;

  for (const [i, card] of cards.entries()) {
    log(`[${i + 1}/${cards.length}] ${card.name} (${card.slug})`);
    const row = await enrichOnePlayer(card, opts);
    results.push(row);
    if (row.error) log(`  ERROR ${row.error}`);
    else {
      log(
        `  img=${row.image} wiki=${row.wiki} ur=${row.ultimateRugby} xfer=${row.transfers} rating=${row.ratings} value=${row.value} scout=${row.scout}`,
      );
    }
    if (i < cards.length - 1) await sleep(delayMs);
  }

  return { cards: cards.length, results };
}
