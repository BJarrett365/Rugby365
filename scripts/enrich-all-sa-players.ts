/**
 * Enrich ALL South African players in the DB to the same depth as the
 * current Springboks squad pass (wiki / Ultimate Rugby / transfers /
 * value history / scout / optional rating + squad numbers + images).
 *
 * Current Springboks squad (springboks.rugby) keeps official Cortex photos.
 * Everyone else: Wikipedia image fill + Planet Rugby discovery + Alamy plan.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-all-sa-players.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-all-sa-players.ts --write --limit=30
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-all-sa-players.ts --write --skip-ratings --alamy-plan
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-all-sa-players.ts --write --player=bryan-habana
 */
import { writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import {
  fetchSpringboksSquadCards,
  type SpringboksSquadCard,
} from "../apps/web/src/lib/springboks-rugby-parse";
import { registerSpringboksOfficialImage } from "../apps/web/src/lib/player-image-service";
import { refreshPlayerPlanetRugbyImages } from "../apps/web/src/lib/player-image-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import {
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
} from "../apps/web/src/lib/ultimate-rugby-parse";
import { importUltimateRugbyPlayerProfile } from "../apps/web/src/lib/ultimate-rugby-import-service";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";
import { backfillPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";
import { calculateAndPersistPlayerRating } from "../apps/web/src/lib/player-bio-packet-service";
import { recalculatePlayerScoutProfile } from "../apps/web/src/lib/player-scout-intelligence-service";

const SA = "b0000000-0000-4000-8000-000000000001";

type SaPlayerRow = {
  id: string;
  name: string;
  slug: string;
  wikipediaUrl: string | null;
  imageUrl: string | null;
  preferredFoot: string | null;
  squadNumber: number | null;
  clubName: string | null;
  positionName: string | null;
  completeness: number;
};

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

function defaultPreferredFoot(position: string | null): string | null {
  if (!position) return null;
  const p = position.toLowerCase();
  if (/fly|centre|center|full.?back|wing|scrum.?half|out.?half|stand.?off/.test(p)) return "Right";
  return null;
}

async function loadSaPlayers(limit: number | undefined, playerFilter: string | null) {
  const db = getDb();
  if (playerFilter) {
    const q = `%${playerFilter.replace(/-/g, " ")}%`;
    const r = await db.execute(sql`
      select id, name, slug, wikipedia_url as "wikipediaUrl", image_url as "imageUrl",
             preferred_foot as "preferredFoot", squad_number as "squadNumber",
             club_name as "clubName", position_name as "positionName",
             0 as completeness
      from players
      where (international_team_id = ${SA}
             or lower(coalesce(country_name,'')) in ('south africa','sa'))
        and (slug ilike ${`%${playerFilter}%`} or name ilike ${q})
        and coalesce(name,'') <> ''
        and name !~* '(rugby union|stadium|captain \\(sports\\)|news24|test match)'
      order by name asc
      limit ${limit ?? 20}
    `);
    return (Array.isArray(r) ? r : ((r as { rows?: SaPlayerRow[] }).rows ?? [])) as SaPlayerRow[];
  }

  const r = await db.execute(sql`
    select p.id, p.name, p.slug, p.wikipedia_url as "wikipediaUrl", p.image_url as "imageUrl",
           p.preferred_foot as "preferredFoot", p.squad_number as "squadNumber",
           p.club_name as "clubName", p.position_name as "positionName",
           (case when p.height_cm is null then 0 else 1 end
            + case when p.birth_date is null then 0 else 1 end
            + case when p.wikipedia_url is null then 0 else 1 end
            + case when p.image_url is null or p.image_url = '' then 0 else 1 end
            + case when exists (select 1 from player_career_stints s where s.player_id=p.id) then 1 else 0 end
            + case when exists (select 1 from player_value_history v where v.player_id=p.id) then 1 else 0 end
           ) as completeness
    from players p
    where (p.international_team_id = ${SA}
           or lower(coalesce(p.country_name,'')) in ('south africa','sa'))
      and coalesce(p.name,'') <> ''
      and p.name !~* '(rugby union|stadium|captain \\(sports\\)|news24|test match)'
    order by completeness asc, p.name asc
    ${limit != null ? sql`limit ${limit}` : sql``}
  `);
  return (Array.isArray(r) ? r : ((r as { rows?: SaPlayerRow[] }).rows ?? [])) as SaPlayerRow[];
}

async function backfillSquadNumber(playerId: string): Promise<number | null> {
  const db = getDb();
  const j = await db.execute(sql`
    select jersey_number as n, count(*)::int as c
    from fixture_players
    where player_id = ${playerId} and jersey_number is not null and jersey_number > 0
    group by jersey_number
    order by c desc, jersey_number asc
    limit 1
  `);
  const rows = Array.isArray(j) ? j : ((j as { rows?: { n: number }[] }).rows ?? []);
  const n = rows[0]?.n;
  return n != null && Number.isFinite(n) ? Number(n) : null;
}

async function main() {
  const dryRun = !process.argv.includes("--write");
  const skipRatings = process.argv.includes("--skip-ratings");
  const skipScout = process.argv.includes("--skip-scout");
  const skipValue = process.argv.includes("--skip-value");
  const skipPlanetImages = process.argv.includes("--skip-planet-images");
  const writeAlamyPlan = process.argv.includes("--alamy-plan");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const playerFilter = argValue("--player");
  const delayMs = Number(argValue("--delay") ?? "350");

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Enrich ALL South African players` +
      (limit ? ` limit=${limit}` : "") +
      (playerFilter ? ` player=${playerFilter}` : "") +
      (skipRatings ? " [skip-ratings]" : "") +
      (skipScout ? " [skip-scout]" : ""),
  );

  // Official Springboks roster map (slug → card) for Cortex headshots
  let squadBySlug = new Map<string, SpringboksSquadCard>();
  try {
    const cards = await fetchSpringboksSquadCards();
    squadBySlug = new Map(cards.map((c) => [c.slug, c]));
    console.log(`Springboks.rugby squad cards: ${cards.length}`);
  } catch (e) {
    console.log(`Could not load springboks.rugby squad: ${e instanceof Error ? e.message : e}`);
  }

  const list = await loadSaPlayers(
    Number.isFinite(limit) ? limit : undefined,
    playerFilter,
  );
  console.log(`SA players to process: ${list.length}`);

  const db = getDb();
  const alamyTargets: Array<{ playerId: string; playerName: string; searchUrl: string }> = [];
  let wikiOk = 0;
  let urOk = 0;
  let valueOk = 0;
  let scoutOk = 0;
  let ratingOk = 0;
  let imagesForced = 0;
  let squadSet = 0;

  for (const [i, row] of list.entries()) {
    console.log(`[${i + 1}/${list.length}] ${row.name} (${row.slug}) completeness=${row.completeness}`);

    if (dryRun) {
      console.log("  dry-run");
      continue;
    }

    // Identity: pin to SA + publish
    const foot = row.preferredFoot ?? defaultPreferredFoot(row.positionName);
    let squadNumber = row.squadNumber;
    if (squadNumber == null) {
      squadNumber = await backfillSquadNumber(row.id);
      if (squadNumber != null) squadSet += 1;
    }

    // Prefer clean springboks slug when this player is on the official roster
    const squadCard =
      squadBySlug.get(row.slug) ??
      [...squadBySlug.values()].find(
        (c) => c.name.toLowerCase() === row.name.toLowerCase(),
      ) ??
      null;

    let nextSlug = row.slug;
    if (squadCard && row.slug !== squadCard.slug) {
      const [taken] = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.slug, squadCard.slug))
        .limit(1);
      if (!taken || taken.id === row.id) nextSlug = squadCard.slug;
    }

    await db
      .update(players)
      .set({
        slug: nextSlug,
        internationalTeamId: SA,
        countryName: "South Africa",
        preferredFoot: foot ?? undefined,
        squadNumber: squadNumber ?? undefined,
        isPublic: true,
        publishStatus: "published",
        updatedAt: new Date(),
      })
      .where(eq(players.id, row.id));

    // Images
    if (squadCard?.imageUrl) {
      try {
        const img = await registerSpringboksOfficialImage(row.id, squadCard.imageUrl, {
          sourcePageUrl: squadCard.profileUrl,
          playerName: row.name,
          forcePrimary: true,
        });
        console.log(`  image springboks ${img.reason}`);
        if (img.reason === "promoted" || img.reason === "inserted_primary") imagesForced += 1;
      } catch (e) {
        console.log(`  image springboks err ${e instanceof Error ? e.message : e}`);
      }
    } else if (!row.imageUrl && !skipPlanetImages) {
      try {
        const pr = await withTimeout(
          refreshPlayerPlanetRugbyImages(row.id, "sa-all-enrich"),
          45_000,
          "planet-images",
        );
        console.log(`  image planet candidates=${pr.savedCount ?? 0}`);
      } catch (e) {
        console.log(`  image planet ${e instanceof Error ? e.message.slice(0, 60) : e}`);
      }
      alamyTargets.push({
        playerId: row.id,
        playerName: row.name,
        searchUrl: alamyStockPhotoSearchUrl(`${row.name} south africa rugby`),
      });
    } else if (!row.imageUrl) {
      alamyTargets.push({
        playerId: row.id,
        playerName: row.name,
        searchUrl: alamyStockPhotoSearchUrl(`${row.name} south africa rugby`),
      });
    }

    // Wikipedia
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
      if (wiki.enriched) wikiOk += 1;
      console.log(`  ← wiki ${wiki.enriched ? `ok(${wiki.careerStints ?? 0})` : wiki.reason ?? "noop"}`);
    } catch (e) {
      console.log(`  ← wiki ${e instanceof Error ? e.message : e}`);
    }

    // Ultimate Rugby
    try {
      console.log("  → ultimate rugby…");
      const profile = await withTimeout(
        fetchUltimateRugbyPlayerByName(row.name),
        45_000,
        "ur-fetch",
      );
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
        if (!ur.skipped) urOk += 1;
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

    if (!skipValue) {
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
          /* optional */
        }
        valueOk += 1;
        console.log(`  ← value +${vh.inserted}/skip${vh.skipped}`);
      } catch (e) {
        console.log(`  ← value ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!skipRatings) {
      try {
        console.log("  → rating…");
        await withTimeout(calculateAndPersistPlayerRating(row.id), 120_000, "rating");
        ratingOk += 1;
        console.log("  ← rating ok");
      } catch (e) {
        console.log(`  ← rating ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!skipScout) {
      try {
        console.log("  → scout…");
        await withTimeout(recalculatePlayerScoutProfile(row.id), 90_000, "scout");
        scoutOk += 1;
        console.log("  ← scout ok");
      } catch (e) {
        console.log(`  ← scout ${e instanceof Error ? e.message : e}`);
      }
    }

    await sleep(delayMs);
  }

  if (writeAlamyPlan || alamyTargets.length) {
    const path = "/tmp/alamy-all-sa-search-plan.json";
    writeFileSync(path, JSON.stringify(alamyTargets, null, 2));
    console.log(`\nAlamy plan (${alamyTargets.length}) → ${path}`);
    console.log(
      `Next:\n  npx tsx scripts/scrape-alamy-player-searches.ts --batch=${path} --out=/tmp/alamy-all-sa-hits.json --limit=${alamyTargets.length}\n` +
        `  npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-alamy-player-search-hits.ts --file=/tmp/alamy-all-sa-hits.json`,
    );
  }

  console.log("\nSummary", {
    total: list.length,
    wikiOk,
    urOk,
    valueOk,
    ratingOk,
    scoutOk,
    imagesForced,
    squadSet,
    alamyQueued: alamyTargets.length,
    dryRun,
  });
  if (dryRun) console.log("Re-run with --write to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
