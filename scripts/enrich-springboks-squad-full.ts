/**
 * Enrich every current Springbok on https://springboks.rugby/sa-teams-players/springboks
 * to the same profile depth as Sacha (images + Overview/Stats/Career/Performance/
 * Intelligence/Rating/Comparison/News foundations).
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-springboks-squad-full.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-springboks-squad-full.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-springboks-squad-full.ts --write --limit=5
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-springboks-squad-full.ts --write --player=siya-kolisi
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-springboks-squad-full.ts --write --alamy
 */
import { writeFileSync } from "node:fs";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import { enrichSpringboksSquadFromOfficialSite } from "../apps/web/src/lib/springboks-squad-enrich-service";
import { fetchSpringboksSquadCards } from "../apps/web/src/lib/springboks-rugby-parse";
import { getDb } from "../apps/web/src/lib/db";
import { players } from "@rugby365/db";
import { eq, sql } from "drizzle-orm";

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function writeAlamyPlan(playerIds: Array<{ id: string; name: string }>) {
  const plan = playerIds.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    searchUrl: alamyStockPhotoSearchUrl(`${p.name} springboks rugby`),
  }));
  const path = "/tmp/alamy-springboks-search-plan.json";
  writeFileSync(path, JSON.stringify(plan, null, 2));
  console.log(`Wrote Alamy search plan (${plan.length}) → ${path}`);
  return path;
}

async function main() {
  const dryRun = !process.argv.includes("--write");
  const withAlamy = process.argv.includes("--alamy");
  const skipRatings = process.argv.includes("--skip-ratings");
  const skipScout = process.argv.includes("--skip-scout");
  const skipRugbyPass = process.argv.includes("--skip-rugbypass");
  const skipUltimateRugby = process.argv.includes("--skip-ur");
  const skipWikipedia = process.argv.includes("--skip-wiki");
  const skipValue = process.argv.includes("--skip-value");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const playerSlug = argValue("--player");
  const delayMs = Number(argValue("--delay") ?? "700");

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Enrich Springboks squad from springboks.rugby` +
      (limit ? ` limit=${limit}` : "") +
      (playerSlug ? ` player=${playerSlug}` : ""),
  );

  // Quick roster dump first
  const cards = await fetchSpringboksSquadCards();
  console.log(`Roster: ${cards.length} players`);
  writeFileSync(
    "/tmp/springboks-squad-cards.json",
    JSON.stringify(cards, null, 2),
  );
  console.log("Wrote /tmp/springboks-squad-cards.json");

  const { results } = await enrichSpringboksSquadFromOfficialSite({
    dryRun,
    limit: Number.isFinite(limit) ? limit : undefined,
    playerSlug,
    delayMs,
    skipRatings,
    skipScout,
    skipRugbyPass,
    skipUltimateRugby,
    skipWikipedia,
    skipValue,
    onProgress: (m) => console.log(m),
  });

  const summary = {
    total: results.length,
    errors: results.filter((r) => r.error).length,
    imagesSaved: results.filter((r) => r.image === "inserted").length,
    wikiOk: results.filter((r) => r.wiki.startsWith("ok")).length,
    urOk: results.filter((r) => r.ultimateRugby.startsWith("ok")).length,
    valueOk: results.filter((r) => r.value === "ok").length,
    scoutOk: results.filter((r) => r.scout === "ok").length,
  };
  console.log("\nSummary:", summary);
  writeFileSync("/tmp/springboks-enrich-results.json", JSON.stringify(results, null, 2));
  console.log("Wrote /tmp/springboks-enrich-results.json");

  if (withAlamy && !dryRun) {
    const ids = results
      .filter((r) => r.playerId)
      .map((r) => ({ id: r.playerId!, name: r.name }));
    const planPath = await writeAlamyPlan(ids);
    console.log(
      `\nNext: scrape Alamy galleries with:\n` +
        `  npx tsx scripts/scrape-alamy-player-searches.ts --batch=${planPath} --out=/tmp/alamy-springboks-hits.json --limit=${ids.length}\n` +
        `  npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-alamy-player-search-hits.ts --file=/tmp/alamy-springboks-hits.json`,
    );
  }

  if (!dryRun) {
    const db = getDb();
    const SA = "b0000000-0000-4000-8000-000000000001";
    const sampleSlugs = results.slice(0, 5).map((r) => r.slug);
    for (const slug of sampleSlugs) {
      const [p] = await db.select().from(players).where(eq(players.slug, slug)).limit(1);
      if (!p) continue;
      const counts = await db.execute(sql`
        select
          (select count(*) from player_images where player_id=${p.id}) images,
          (select count(*) from player_career_stints where player_id=${p.id}) stints,
          (select count(*) from player_transfers where player_id=${p.id}) transfers,
          (select count(*) from player_match_performance_stats where player_id=${p.id}) perf,
          (select count(*) from player_value_history where player_id=${p.id}) value_hist,
          (select count(*) from player_source_news where player_id=${p.id}) news
      `);
      console.log(slug, {
        imageUrl: Boolean(p.imageUrl),
        caps: p.verifiedInternationalCaps,
        wiki: Boolean(p.wikipediaUrl),
        ...(counts as { rows?: Record<string, unknown>[] }).rows?.[0],
      });
    }
    void SA;
  } else {
    console.log("\nNo database writes. Re-run with --write to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
