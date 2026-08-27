/**
 * Force official springboks.rugby headshots as primary + deep-enrich every
 * current Springbok (wiki / UR / transfers / value / rating / scout) so tabs
 * match the Sacha profile depth.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/promote-springboks-images-and-enrich.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/promote-springboks-images-and-enrich.ts --write --player=wilco-louw
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/promote-springboks-images-and-enrich.ts --write --images-only
 */
import { eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { registerSpringboksOfficialImage } from "../apps/web/src/lib/player-image-service";
import {
  fetchSpringboksSquadCards,
  type SpringboksSquadCard,
} from "../apps/web/src/lib/springboks-rugby-parse";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import {
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
} from "../apps/web/src/lib/ultimate-rugby-parse";
import { importUltimateRugbyPlayerProfile } from "../apps/web/src/lib/ultimate-rugby-import-service";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";
import { backfillPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";
import { calculateAndPersistPlayerRating } from "../apps/web/src/lib/player-bio-packet-service";
import { recalculatePlayerScoutProfile } from "../apps/web/src/lib/player-scout-intelligence-service";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";

const SA = "b0000000-0000-4000-8000-000000000001";

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveCardPlayer(card: SpringboksSquadCard) {
  const db = getDb();
  const like = `${card.slug}-%`;
  const r = await db.execute(sql`
    select id, slug, name, wikipedia_url as "wikipediaUrl", preferred_foot as "preferredFoot",
           squad_number as "squadNumber", club_name as "clubName"
    from players
    where slug = ${card.slug}
       or slug like ${like}
       or lower(name) = lower(${card.name})
    order by case when slug = ${card.slug} then 0 when slug like ${like} then 1 else 2 end
    limit 1
  `);
  const rows = Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? []);
  return (rows[0] ?? null) as {
    id: string;
    slug: string;
    name: string;
    wikipediaUrl: string | null;
    preferredFoot: string | null;
    squadNumber: number | null;
    clubName: string | null;
  } | null;
}

/** Infer preferred foot defaults by position family when unknown (props/locks often N/A → "—"). */
function defaultPreferredFoot(position: string | null): string | null {
  if (!position) return null;
  const p = position.toLowerCase();
  if (/fly|centre|center|full.?back|wing|scrum.?half|out.?half|stand.?off/.test(p)) return "Right";
  return null;
}

async function main() {
  const dryRun = !process.argv.includes("--write");
  const imagesOnly = process.argv.includes("--images-only");
  const playerFilter = argValue("--player");
  const delayMs = Number(argValue("--delay") ?? "400");
  const limit = argValue("--limit") ? Number(argValue("--limit")) : undefined;

  let cards = await fetchSpringboksSquadCards();
  if (playerFilter) {
    const n = playerFilter.toLowerCase();
    cards = cards.filter((c) => c.slug.includes(n) || c.name.toLowerCase().includes(n));
  }
  if (limit != null && Number.isFinite(limit)) cards = cards.slice(0, limit);

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Promote springboks images + enrich ${cards.length} players` +
      (imagesOnly ? " [images-only]" : ""),
  );

  const db = getDb();
  let promoted = 0;
  let enriched = 0;

  for (const [i, card] of cards.entries()) {
    console.log(`[${i + 1}/${cards.length}] ${card.name}`);
    const row = await resolveCardPlayer(card);
    if (!row) {
      console.log("  MISSING in DB");
      continue;
    }

    // Clean slug + SA link
    if (!dryRun) {
      const [taken] = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.slug, card.slug))
        .limit(1);
      const nextSlug = !taken || taken.id === row.id ? card.slug : row.slug;
      const foot =
        row.preferredFoot ?? defaultPreferredFoot(card.position);
      await db
        .update(players)
        .set({
          slug: nextSlug,
          internationalTeamId: SA,
          countryName: "South Africa",
          positionName: card.position ?? undefined,
          preferredFoot: foot ?? undefined,
          isPublic: true,
          publishStatus: "published",
          updatedAt: new Date(),
        })
        .where(eq(players.id, row.id));
    }

    if (card.imageUrl) {
      if (dryRun) {
        console.log(`  image would force-primary ${card.imageUrl.slice(-40)}`);
      } else {
        const img = await registerSpringboksOfficialImage(row.id, card.imageUrl, {
          sourcePageUrl: card.profileUrl,
          playerName: card.name,
          forcePrimary: true,
        });
        console.log(`  image ${img.reason}`);
        if (img.reason === "promoted" || img.reason === "inserted_primary") promoted += 1;
      }
    }

    if (imagesOnly) {
      await sleep(delayMs);
      continue;
    }

    if (dryRun) {
      console.log("  enrich dry-run");
      continue;
    }

    try {
      console.log("  → wikipedia…");
      const wiki = await withTimeout(
        enrichPlayerFromWikipedia(row.id, row.name, {
          fillMissingOnly: false,
          sourceUrl: row.wikipediaUrl ?? undefined,
        }),
        90_000,
        "wikipedia",
      );
      console.log(`  ← wiki ${wiki.enriched ? `ok(${wiki.careerStints ?? 0})` : wiki.reason ?? "noop"}`);
    } catch (e) {
      console.log(`  ← wiki ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → ultimate rugby…");
      const profile = await withTimeout(fetchUltimateRugbyPlayerByName(row.name), 45_000, "ur-fetch");
      if (!profile) {
        console.log("  ← ur not_found");
      } else {
        let newsItems: Awaited<ReturnType<typeof parseUltimateRugbyNewsHtml>> = [];
        try {
          const newsHtml = await withTimeout(
            fetchUltimateRugbyHtml(`${profile.url}/news`),
            30_000,
            "ur-news",
          );
          newsItems = parseUltimateRugbyNewsHtml(newsHtml, profile.path);
        } catch {
          newsItems = [];
        }
        const ur = await importUltimateRugbyPlayerProfile(profile, {
          internationalTeamId: SA,
          countryName: "South Africa",
          dryRun: false,
          newsItems,
        });
        console.log(
          `  ← ur ${ur.skipped ?? `ok(bio=${ur.bioChars},stints=${ur.careerStints},news=${ur.newsItems})`}`,
        );
      }
    } catch (e) {
      console.log(`  ← ur ${e instanceof Error ? e.message : e}`);
    }

    try {
      const xfer = await syncTransfersFromClubCareerStints(row.id);
      console.log(`  ← transfers +${xfer.created}/~${xfer.updated}`);
    } catch (e) {
      console.log(`  ← transfers ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → value…");
      const vh = await withTimeout(
        backfillPlayerValueHistory(row.id, { range: "career" }),
        120_000,
        "value-history",
      );
      try {
        await withTimeout(calculateAndPersistPlayerValue(row.id), 60_000, "value-live");
      } catch {
        /* optional live value */
      }
      console.log(`  ← value +${vh.inserted}/skip${vh.skipped}`);
    } catch (e) {
      console.log(`  ← value ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → rating…");
      await withTimeout(calculateAndPersistPlayerRating(row.id), 180_000, "rating");
      console.log("  ← rating ok");
    } catch (e) {
      console.log(`  ← rating ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → scout…");
      await withTimeout(recalculatePlayerScoutProfile(row.id), 90_000, "scout");
      console.log("  ← scout ok");
    } catch (e) {
      console.log(`  ← scout ${e instanceof Error ? e.message : e}`);
    }

    enriched += 1;
    await sleep(delayMs);
  }

  console.log("\nDone", { promoted, enriched, total: cards.length, dryRun });
  if (dryRun) console.log("Re-run with --write to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
