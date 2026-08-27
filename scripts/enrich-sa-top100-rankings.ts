/**
 * Enrich SA Current Top 100 rankings players (Duane-depth profiles) + fix form/intl.
 * Fast path: legend prune + intelligence/reputation recalc for all, then source enrich.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-sa-top100-rankings.ts --write
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { getPublicPlayerRankingsBoard } from "../apps/web/src/lib/public-player-rankings-product-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { enrichPlayerFromRugbyPass } from "../apps/web/src/lib/rugbypass-player-import-service";
import { importUltimateRugbyPlayerProfile } from "../apps/web/src/lib/ultimate-rugby-import-service";
import {
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
} from "../apps/web/src/lib/ultimate-rugby-parse";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";
import { backfillPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";
import { calculateAndPersistPlayerRating } from "../apps/web/src/lib/player-bio-packet-service";
import { recalculatePlayerScoutProfile } from "../apps/web/src/lib/player-scout-intelligence-service";
import { recalculatePlayerIntelligenceProfile } from "../apps/web/src/lib/player-intelligence-recalc-service";
import { refreshPlayerPlanetRugbyImages } from "../apps/web/src/lib/player-image-service";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import { mergeLegendCatalogByName } from "../apps/web/src/lib/legends-catalog";

const SA = "b0000000-0000-4000-8000-000000000001";

const RETIRED_GREATS = [
  "Pierre Spies", "Ashwin Willemse", "Jaque Fourie", "Robbie Fleck", "Deon Kayser",
  "Andre Venter", "André Venter", "Andre Joubert", "André Joubert", "Rassie Erasmus",
  "Pieter Rossouw", "Ruben Kruger", "Japie Mulder", "Heinrich Brussow", "Heinrich Brüssow",
  "Kobus Wiese", "Bobby Skinstad", "Joel Stransky", "Hennie Le Roux", "Cobus Visagie",
  "Jannie De Beer", "Derick Hougaard", "Patrick Lambie", "Bryan Habana", "Victor Matfield",
  "Fourie Du Preez", "Bakkies Botha", "Tendai Mtawarira", "Jean de Villiers", "Jean De Villiers",
  "Schalk Burger", "Joost van der Westhuizen", "Francois Pienaar", "Naas Botha", "Frik du Preez",
  "John Smit", "Percy Montgomery", "Os du Randt", "Danie Rossouw", "Juan Smith", "Morné Steyn",
  "Morne Steyn", "JP Pietersen", "Bismarck du Plessis", "Jannie Du Plessis", "Gurthro Steenkamp",
  "Butch James", "Chester Williams", "James Small", "Mark Andrews", "Johan Roux", "Garry Pagel",
  "Louis Koen", "Werner Swanepoel", "Ollie Le Roux", "Wynand Olivier", "Rudolf Straeuli",
  "Pieter Muller", "Naka Drotske", "Gavin Johnson", "Krynauw Otto", "CJ Van der Linde",
  "Jean-Pierre Smith",
];

function hasFlag(f: string) {
  return process.argv.includes(f);
}
function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function log(msg: string) {
  console.log(msg);
  if (typeof process.stdout.write === "function") process.stdout.write("");
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

function shouldBeLegend(name: string): boolean {
  const key = name.toLowerCase();
  if (RETIRED_GREATS.some((n) => n.toLowerCase() === key)) return true;
  return mergeLegendCatalogByName()
    .filter((e) => (e.countryName ?? "").toLowerCase().includes("south africa"))
    .some((e) => e.name.toLowerCase() === key);
}

async function main() {
  const write = hasFlag("--write");
  const limit = Number(argValue("--limit") ?? "0") || 0;
  const offset = Number(argValue("--offset") ?? "0") || 0;
  const delayMs = Number(argValue("--delay") ?? "250");
  const skipSources = hasFlag("--intel-only");
  const sourcesOnly = hasFlag("--sources-only");
  const fromFile = argValue("--from-file") || (sourcesOnly || offset > 0 ? "/tmp/sa-top100-players.json" : null);
  const db = getDb();

  type PlayerRow = { id: string; name: string; slug: string };
  let list: PlayerRow[] = [];
  let legends = 0;

  if (fromFile && existsSync(fromFile)) {
    list = JSON.parse(readFileSync(fromFile, "utf8")) as PlayerRow[];
    log(`Loaded ${list.length} from ${fromFile} write=${write} sourcesOnly=${sourcesOnly}`);
  } else {
    let board = await getPublicPlayerRankingsBoard({
      mode: "current",
      nation: "South Africa",
      top: 100,
      forceRebuild: true,
    });
    list = board.rows.map((r) => ({ id: r.playerId, name: r.name, slug: r.slug }));
    log(`SA top100 rows=${list.length} write=${write}`);

    for (const row of list) {
      if (!shouldBeLegend(row.name)) continue;
      if (!write) {
        log(`legend ${row.name}`);
        continue;
      }
      await db.update(players).set({ careerStatus: "legend" }).where(eq(players.id, row.id));
      legends += 1;
      log(`career_status=legend ${row.name}`);
    }

    board = await getPublicPlayerRankingsBoard({
      mode: "current",
      nation: "South Africa",
      top: 100,
      forceRebuild: true,
    });
    list = board.rows.map((r) => ({ id: r.playerId, name: r.name, slug: r.slug }));
    writeFileSync("/tmp/sa-top100-players.json", JSON.stringify(list, null, 2));
  }

  if (offset > 0) list = list.slice(offset);
  if (limit > 0) list = list.slice(0, limit);
  log(`After legend prune: ${list.length} to process (legendsMarked=${legends} offset=${offset})`);

  // Phase 1 — intelligence / form / reputation for everyone (local DB, fast)
  if (!sourcesOnly) {
    log("\n=== Phase 1: intelligence recalc ===");
    for (let i = 0; i < list.length; i++) {
      const row = list[i]!;
      if (!write) continue;
      try {
        await db
          .update(players)
          .set({
            internationalTeamId: SA,
            countryName: "South Africa",
            isPublic: true,
            publishStatus: "published",
            updatedAt: new Date(),
          })
          .where(eq(players.id, row.id));
        const intel = await recalculatePlayerIntelligenceProfile(row.id);
        log(`[intel ${i + 1}/${list.length}] ${row.name} ovr=${intel.overall} samples=${intel.samples}`);
      } catch (e) {
        log(`[intel ${i + 1}/${list.length}] ${row.name} FAIL ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  if (skipSources) {
    const finalBoard = await getPublicPlayerRankingsBoard({
      mode: "current",
      nation: "South Africa",
      top: 100,
      forceRebuild: true,
    });
    log(
      JSON.stringify(
        {
          noForm: finalBoard.rows.filter((r) => r.formScore == null || !r.formBlocks?.length).length,
          noIntl: finalBoard.rows.filter((r) => r.internationalPerformance == null).length,
          noClub: finalBoard.rows.filter((r) => r.clubPerformance == null).length,
        },
        null,
        2,
      ),
    );
    return;
  }

  // Phase 2 — external sources (strict timeouts)
  log("\n=== Phase 2: source enrich ===");
  const alamy: Array<{ playerId: string; playerName: string; searchUrl: string }> = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i]!;
    log(`\n[src ${i + 1}/${list.length}] ${row.name}`);
    if (!write) continue;

    const [p] = await db
      .select({ wikipediaUrl: players.wikipediaUrl, imageUrl: players.imageUrl })
      .from(players)
      .where(eq(players.id, row.id))
      .limit(1);

    try {
      log("  wiki…");
      const wiki = await withTimeout(
        enrichPlayerFromWikipedia(row.id, row.name, {
          fillMissingOnly: true,
          sourceUrl: p?.wikipediaUrl ?? undefined,
        }),
        45_000,
        "wikipedia",
      );
      log(`  wiki ${wiki.enriched ? "ok" : wiki.reason ?? "noop"}`);
    } catch (e) {
      log(`  wiki ${e instanceof Error ? e.message : e}`);
    }

    try {
      log("  rugbypass…");
      await withTimeout(enrichPlayerFromRugbyPass(row.id, undefined, { skipMatches: true }), 35_000, "rp");
      log("  rugbypass ok");
    } catch (e) {
      log(`  rugbypass ${e instanceof Error ? e.message : e}`);
    }

    try {
      log("  ultimate…");
      const profile = await withTimeout(fetchUltimateRugbyPlayerByName(row.name), 25_000, "ur");
      if (profile) {
        let newsItems: Awaited<ReturnType<typeof parseUltimateRugbyNewsHtml>> = [];
        try {
          const html = await withTimeout(fetchUltimateRugbyHtml(`${profile.url}/news`), 15_000, "ur-news");
          newsItems = parseUltimateRugbyNewsHtml(html, profile.path);
        } catch {
          newsItems = [];
        }
        const ur = await importUltimateRugbyPlayerProfile(profile, {
          internationalTeamId: SA,
          countryName: "South Africa",
          dryRun: false,
          newsItems,
        });
        log(`  ur ${ur.skipped ?? `ok news=${ur.newsItems}`}`);
      } else {
        log("  ur miss");
      }
    } catch (e) {
      log(`  ur ${e instanceof Error ? e.message : e}`);
    }

    try {
      const x = await syncTransfersFromClubCareerStints(row.id);
      log(`  transfers +${x.created}`);
    } catch (e) {
      log(`  transfers ${e instanceof Error ? e.message : e}`);
    }

    try {
      await withTimeout(calculateAndPersistPlayerRating(row.id), 60_000, "bio-rating");
      log("  bio-rating ok");
    } catch (e) {
      log(`  bio-rating ${e instanceof Error ? e.message : e}`);
    }

    try {
      await recalculatePlayerIntelligenceProfile(row.id);
      log("  intel refresh ok");
    } catch (e) {
      log(`  intel ${e instanceof Error ? e.message : e}`);
    }

    try {
      await calculateAndPersistPlayerValue(row.id);
      await backfillPlayerValueHistory(row.id);
      log("  value ok");
    } catch (e) {
      log(`  value ${e instanceof Error ? e.message : e}`);
    }

    try {
      await withTimeout(recalculatePlayerScoutProfile(row.id), 45_000, "scout");
      log("  scout ok");
    } catch (e) {
      log(`  scout ${e instanceof Error ? e.message : e}`);
    }

    if (!p?.imageUrl) {
      try {
        const pr = await withTimeout(
          refreshPlayerPlanetRugbyImages(row.id, "sa-top100"),
          25_000,
          "planet",
        );
        log(`  images planet=${pr.savedCount ?? 0}`);
      } catch (e) {
        log(`  images ${e instanceof Error ? e.message : e}`);
      }
      alamy.push({
        playerId: row.id,
        playerName: row.name,
        searchUrl: alamyStockPhotoSearchUrl(`${row.name} south africa rugby`),
      });
    }

    await sleep(delayMs);
  }

  if (alamy.length) {
    writeFileSync("/tmp/alamy-sa-top100-batch.json", JSON.stringify(alamy, null, 2));
    log(`Alamy plan ${alamy.length} → /tmp/alamy-sa-top100-batch.json`);
  }

  const finalBoard = await getPublicPlayerRankingsBoard({
    mode: "current",
    nation: "South Africa",
    top: 100,
    forceRebuild: true,
  });
  const gaps = {
    n: finalBoard.rows.length,
    noForm: finalBoard.rows.filter((r) => r.formScore == null || !r.formBlocks?.length).map((r) => r.name),
    noIntl: finalBoard.rows.filter((r) => r.internationalPerformance == null).map((r) => r.name),
    noClub: finalBoard.rows.filter((r) => r.clubPerformance == null).map((r) => r.name),
    noImage: finalBoard.rows.filter((r) => !r.imageUrl).map((r) => r.name),
    sample: finalBoard.rows.slice(0, 8).map((r) => ({
      name: r.name,
      form: r.formScore,
      intl: r.internationalPerformance,
      club: r.clubPerformance,
      img: Boolean(r.imageUrl),
    })),
  };
  log("\nFINAL GAPS " + JSON.stringify(gaps, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
