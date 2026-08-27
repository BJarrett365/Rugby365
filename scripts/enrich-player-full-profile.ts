/**
 * Fill missing profile / match / career / value / scout data for one player.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-player-full-profile.ts --player=sacha-feinberg-mngomezulu
 */
import { eq, sql } from "drizzle-orm";
import { fixtures, playerMatchPerformanceStats, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { enrichPlayerFromRugbyPass } from "../apps/web/src/lib/rugbypass-player-import-service";
import {
  importUltimateRugbyPlayerProfile,
} from "../apps/web/src/lib/ultimate-rugby-import-service";
import {
  ULTIMATE_RUGBY_ORIGIN,
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
  parseUltimateRugbyPlayerHtml,
} from "../apps/web/src/lib/ultimate-rugby-parse";
import { ensureMissingFixturePlayerMatchRatings } from "../apps/web/src/lib/match-rating-service";
import { calculateAndPersistPlayerRating } from "../apps/web/src/lib/player-bio-packet-service";
import { backfillPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";
import { recalculatePlayerScoutProfile } from "../apps/web/src/lib/player-scout-intelligence-service";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function main() {
  const slugOrName = argValue("--player");
  if (!slugOrName) {
    throw new Error("Pass --player=sacha-feinberg-mngomezulu");
  }

  const db = getDb();
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.slug, slugOrName))
    .limit(1);
  const row =
    player ??
    (
      await db
        .select()
        .from(players)
        .where(sql`name ilike ${`%${slugOrName.replace(/-/g, " ")}%`}`)
        .limit(1)
    )[0];

  if (!row) throw new Error(`Player not found: ${slugOrName}`);
  console.log(`Enriching ${row.name} (${row.id})`);

  // 1) Wikipedia (career stints, birth place, caps, school, etc.)
  console.log("→ Wikipedia…");
  const wiki = await enrichPlayerFromWikipedia(row.id, row.name, {
    fillMissingOnly: false,
    sourceUrl: row.wikipediaUrl ?? "https://en.wikipedia.org/wiki/Sacha_Feinberg-Mngomezulu",
  });
  console.log("  ", wiki);

  // 2) RugbyPass fill-missing
  console.log("→ RugbyPass…");
  try {
    const rp = await enrichPlayerFromRugbyPass(row.id);
    console.log("  ", rp);
  } catch (e) {
    console.log("  RugbyPass error:", e instanceof Error ? e.message : e);
  }

  // 3) Ultimate Rugby bio/career/news/caps
  console.log("→ Ultimate Rugby…");
  try {
    const profile =
      (await fetchUltimateRugbyPlayerByName(row.name)) ??
      parseUltimateRugbyPlayerHtml(
        await fetchUltimateRugbyHtml(`${ULTIMATE_RUGBY_ORIGIN}/sacha-feinberg-mngomezulu`),
        "/sacha-feinberg-mngomezulu",
      );
    let newsItems = [];
    try {
      const newsHtml = await fetchUltimateRugbyHtml(`${profile.url}/news`);
      newsItems = parseUltimateRugbyNewsHtml(newsHtml, profile.path);
    } catch {
      newsItems = [];
    }
    const ur = await importUltimateRugbyPlayerProfile(profile, {
      internationalTeamId: row.internationalTeamId ?? "b0000000-0000-4000-8000-000000000001",
      countryName: "South Africa",
      dryRun: false,
      newsItems,
    });
    console.log("  ", ur);
  } catch (e) {
    console.log("  UR error:", e instanceof Error ? e.message : e);
  }

  // 4) Transfers from club career
  console.log("→ Career → transfers…");
  const transfers = await syncTransfersFromClubCareerStints(row.id);
  console.log("  ", transfers);

  // 5) Match ratings for fixtures with perf but no rating
  console.log("→ Match ratings…");
  const fixtureRows = await db.execute(sql`
    select distinct p.fixture_id as fixture_id
    from player_match_performance_stats p
    left join player_match_ratings r
      on r.fixture_id = p.fixture_id and r.player_id = p.player_id
    join fixtures f on f.id = p.fixture_id
    where p.player_id = ${row.id}
      and r.id is null
      and lower(trim(replace(coalesce(f.status,''), ' ', '_')))
          in ('full_time','completed','result','finished','ft','')
  `);
  const fixtureIds = ((fixtureRows as { rows?: { fixture_id: string }[] }).rows ??
    (fixtureRows as { fixture_id: string }[])) as { fixture_id: string }[];
  let ratingsMade = 0;
  for (const f of fixtureIds) {
    const id = f.fixture_id;
    try {
      const res = await ensureMissingFixturePlayerMatchRatings(id);
      ratingsMade += res.calculated;
      if (res.calculated) console.log(`  fixture ${id}: +${res.calculated}`);
    } catch (e) {
      console.log(`  fixture ${id} error:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`  match ratings calculated across fixtures: ${ratingsMade}`);

  // 6) Persist overall player rating packet
  console.log("→ Player rating packet…");
  try {
    const rating = await calculateAndPersistPlayerRating(row.id);
    console.log("  ", rating);
  } catch (e) {
    console.log("  rating error:", e instanceof Error ? e.message : e);
  }

  // 7) Value history
  console.log("→ Value history (career)…");
  try {
    const value = await backfillPlayerValueHistory(row.id, { range: "career" });
    console.log("  ", value);
  } catch (e) {
    console.log("  value error:", e instanceof Error ? e.message : e);
  }

  // 8) Scout / RRI
  console.log("→ Scout intelligence…");
  try {
    const scout = await recalculatePlayerScoutProfile(row.id);
    console.log("  ", {
      rri: (scout as { rriScore?: number })?.rriScore ?? scout,
    });
  } catch (e) {
    console.log("  scout error:", e instanceof Error ? e.message : e);
  }

  // Final snapshot
  const [final] = await db.select().from(players).where(eq(players.id, row.id)).limit(1);
  const counts = await db.execute(sql`
    select
      (select count(*) from fixture_players where player_id=${row.id}) fixtures,
      (select count(*) from player_match_performance_stats where player_id=${row.id}) perf,
      (select count(*) from player_match_ratings where player_id=${row.id}) match_ratings,
      (select count(*) from player_career_stints where player_id=${row.id}) stints,
      (select count(*) from player_transfers where player_id=${row.id}) transfers,
      (select count(*) from player_rating_history where player_id=${row.id}) rating_hist,
      (select count(*) from player_value_history where player_id=${row.id}) value_hist,
      (select count(*) from player_source_news where player_id=${row.id}) news,
      (select count(*) from player_titles where player_id=${row.id}) titles
  `);
  console.log("\nDONE");
  console.log({
    birthPlace: final?.birthPlace,
    preferredFoot: final?.preferredFoot,
    squadNumber: final?.squadNumber,
    caps: final?.verifiedInternationalCaps,
    points: final?.verifiedInternationalPoints,
    wiki: final?.wikipediaUrl,
    rugbypass: final?.rugbypassSlug,
    school: final?.school,
    contract: [final?.contractStartOn, final?.contractExpiresOn],
  });
  console.log(counts.rows?.[0] ?? counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
