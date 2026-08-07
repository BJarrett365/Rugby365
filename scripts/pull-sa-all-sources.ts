/**
 * Pull South Africa fixture depth from every wired source.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-sa-all-sources.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/pull-sa-all-sources.ts --skip-wiki --skip-planet
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { fetchRugbyDataTeamMatches } from "../apps/web/src/lib/rugby-data-api-client";
import { importRugbyDataDateRange } from "../apps/web/src/lib/rugby-data-import-service";
import { enrichRugbyDataMatch } from "../apps/web/src/lib/rugby-data-match-import-service";
import { syncFixtureFromSport365, importFixtureFromSport365 } from "../apps/web/src/lib/sport365-import-service";
import { importFromLiveSportTournamentUrl } from "../apps/web/src/lib/livesport-import-service";
import { updateFixtureSources } from "../apps/web/src/lib/fixture-admin-service";
import { fetchSdmsMatchStats, parseSdmsMatchTeamStats } from "@rugby365/import-sdk";
import { upsertTeamMatchStat } from "../apps/web/src/lib/team-match-stats-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const SA_RUGBY_DATA_TEAM_ID = 257;
const ENG_FX = "abcb9be4-f0ec-42d5-9dc7-32adb096eb23";

const args = new Set(process.argv.slice(2));
const skipWiki = args.has("--skip-wiki");
const skipPlanet = args.has("--skip-planet");
const skipRdb = args.has("--skip-rdb");
const skipSport365 = args.has("--skip-sport365");
const skipLiveSport = args.has("--skip-livesport");
const skipRugbyData = args.has("--skip-rugby-data");
const skipSdms = args.has("--skip-sdms");

const SPORT365_SA_URLS = [
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586",
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-england/1-4084153",
];

const LIVESPORT_URLS = [
  "https://www.livesport.com/uk/rugby-union/world/world-cup/2023/",
  "https://www.livesport.com/uk/rugby-union/world/world-cup/2019/",
  "https://www.livesport.com/uk/rugby-union/world/rugby-championship/2025/",
  "https://www.livesport.com/uk/rugby-union/world/rugby-championship/2024/",
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pullRugbyData() {
  console.log("\n=== Rugby Data / Sport CC (team 257) ===");
  const { linkRugbyDataMatchMapping } = await import("../apps/web/src/lib/rugby-data-mapping-service");
  const finished = await fetchRugbyDataTeamMatches(SA_RUGBY_DATA_TEAM_ID, "finished");
  const upcoming = await fetchRugbyDataTeamMatches(SA_RUGBY_DATA_TEAM_ID, "fixtures");

  type Listed = { id: number; dt: string };
  const listed: Listed[] = [];
  for (const payload of [
    (finished as { data?: unknown })?.data ?? finished,
    (upcoming as { data?: unknown })?.data ?? upcoming,
  ]) {
    if (!Array.isArray(payload)) continue;
    for (const lg of payload as Array<{ matches?: Array<{ id?: number; dt?: string }> }>) {
      for (const m of lg.matches ?? []) {
        if (!Number.isFinite(m.id) || typeof m.dt !== "string") continue;
        listed.push({ id: Number(m.id), dt: m.dt.slice(0, 10) });
      }
    }
  }
  const unique = [...new Map(listed.map((m) => [m.id, m])).values()];
  console.log(`  listed ${unique.length} rugby_data match ids`);

  const db = getDb();
  let linked = 0;
  let dayImported = 0;
  let enriched = 0;
  let failed = 0;

  for (const [i, match] of unique.entries()) {
    process.stdout.write(`  [${i + 1}/${unique.length}] rd:${match.id} ${match.dt}… `);
    try {
      // Prefer an existing Springboks CMS fixture on the same day (keeps Planet SDMS ids).
      const existing = await db.execute(sql`
        select id, external_match_id from fixtures
        where (home_team_id=${SA_ID}::uuid or away_team_id=${SA_ID}::uuid)
          and kickoff_at::date = ${match.dt}::date
        order by
          case when external_match_id ~ '^[a-z0-9]{6,12}$' then 0 else 1 end,
          kickoff_at desc nulls last
        limit 1
      `);
      let fixtureId = (existing as Array<{ id: string }>)[0]?.id ?? null;

      if (!fixtureId) {
        const range = await importRugbyDataDateRange(match.dt, match.dt);
        dayImported += 1;
        if (range.fixturesCreated + range.fixturesUpdated === 0) {
          failed += 1;
          console.log("no fixture");
          continue;
        }
        const again = await db.execute(sql`
          select id from fixtures
          where external_match_id = ${String(match.id)}
             or (
               (home_team_id=${SA_ID}::uuid or away_team_id=${SA_ID}::uuid)
               and kickoff_at::date = ${match.dt}::date
             )
          order by case when external_match_id = ${String(match.id)} then 0 else 1 end
          limit 1
        `);
        fixtureId = (again as Array<{ id: string }>)[0]?.id ?? null;
      }

      if (!fixtureId) {
        failed += 1;
        console.log("unlinked");
        continue;
      }

      await linkRugbyDataMatchMapping({
        externalMatchId: String(match.id),
        fixtureId,
        fixtureName: `SA rugby_data ${match.id}`,
      });
      linked += 1;

      const result = await enrichRugbyDataMatch(String(match.id), { fixtureId });
      if (result.errors?.length && !result.eventsImported && !result.lineupPlayers && !result.teamStats) {
        failed += 1;
        console.log("warn", result.errors[0]?.slice(0, 100));
      } else {
        enriched += 1;
        console.log(
          `ok events=${result.eventsImported} lineup=${result.lineupPlayers} tms=${result.teamStats} pms=${result.playerStats}`,
        );
      }
    } catch (e) {
      failed += 1;
      console.log("fail", e instanceof Error ? e.message.slice(0, 120) : e);
    }
    await sleep(250);
  }

  return { matchIds: unique.length, linked, dayImported, enriched, failed };
}

async function pullSport365() {
  console.log("\n=== Sport365 ===");
  let imported = 0;
  let synced = 0;
  let failed = 0;

  for (const url of SPORT365_SA_URLS) {
    process.stdout.write(`  ${url.split("/").slice(-2).join("/")}… `);
    try {
      const created = await importFixtureFromSport365({ sport365Url: url, importEvents: true });
      imported += 1;
      console.log("imported", created.fixture?.slug ?? created.preview.suggestedSlug, `events=${created.eventsImported}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already|exists|duplicate/i.test(msg)) {
        console.log("exists — trying sync by URL attach");
      } else {
        failed += 1;
        console.log("fail", msg.slice(0, 140));
        continue;
      }
    }
    await sleep(400);
  }

  // Attach + sync England 2026 if we can resolve a Sport365 page later; also sync any SA row that already has a URL.
  const db = getDb();
  const withUrl = await db.execute(sql`
    select id, slug, sport365_url
    from fixtures
    where (home_team_id=${SA_ID}::uuid or away_team_id=${SA_ID}::uuid)
      and sport365_url is not null and sport365_url <> ''
    order by kickoff_at desc nulls last
    limit 40
  `);

  for (const row of withUrl as Array<{ id: string; slug: string; sport365_url: string }>) {
    process.stdout.write(`  sync ${row.slug}… `);
    try {
      await syncFixtureFromSport365(row.id, { importEvents: true });
      synced += 1;
      console.log("ok");
    } catch (e) {
      failed += 1;
      console.log("fail", e instanceof Error ? e.message.slice(0, 120) : e);
    }
    await sleep(350);
  }

  // Mark Wikipedia secondary on England fixture without overriding Planet SDMS id.
  try {
    await updateFixtureSources(ENG_FX, {
      primarySource: "planet_rugby",
      planetRugbyUrl:
        "https://www.planetrugby.com/matches/46vodwkj/nations-championship/qo6gdo63/south-africa-v-england/2026-07-04",
    });
  } catch {
    /* optional */
  }

  return { imported, synced, failed, withUrl: (withUrl as unknown[]).length };
}

async function pullLiveSport() {
  console.log("\n=== LiveSport ===");
  const results: Array<{ url: string; ok: boolean; detail: string }> = [];
  for (const url of LIVESPORT_URLS) {
    process.stdout.write(`  ${url}… `);
    try {
      const result = await importFromLiveSportTournamentUrl(url, {
        importFixtures: true,
        importResults: true,
        syncStandings: true,
      });
      const detail = JSON.stringify({
        created: (result as { fixturesCreated?: number }).fixturesCreated,
        updated: (result as { fixturesUpdated?: number }).fixturesUpdated,
        standings: (result as { standingsUpserted?: number }).standingsUpserted,
      });
      console.log("ok", detail);
      results.push({ url, ok: true, detail });
    } catch (e) {
      const detail = e instanceof Error ? e.message.slice(0, 160) : String(e);
      console.log("fail", detail);
      results.push({ url, ok: false, detail });
    }
    await sleep(500);
  }
  return results;
}

async function pullRemainingSdmsTeamStats() {
  console.log("\n=== Planet / SDMS leftover team stats ===");
  const db = getDb();
  const rows = await db.execute(sql`
    select f.id, f.slug, f.external_match_id, f.home_team_id, f.away_team_id, f.season_id, f.competition_id
    from fixtures f
    where (f.home_team_id=${SA_ID}::uuid or f.away_team_id=${SA_ID}::uuid)
      and f.status='full_time'
      and f.external_match_id ~ '^[a-z0-9]{6,12}$'
      and not exists (
        select 1 from team_match_stats tms
        where tms.fixture_id=f.id and tms.team_id=${SA_ID}::uuid and coalesce(tms.carries,0)>0
      )
    order by f.kickoff_at desc nulls last
    limit 40
  `);

  let ok = 0;
  let fail = 0;
  for (const row of rows as Array<{
    id: string;
    slug: string;
    external_match_id: string;
    home_team_id: string;
    away_team_id: string;
    season_id: string | null;
    competition_id: string | null;
  }>) {
    process.stdout.write(`  ${row.slug}… `);
    try {
      const bundle = await fetchSdmsMatchStats(row.external_match_id);
      if (bundle) {
        for (const parsed of parseSdmsMatchTeamStats(bundle)) {
          const teamId = parsed.side === "home" ? row.home_team_id : row.away_team_id;
          if (!teamId || !row.competition_id) continue;
          if (parsed.tries + parsed.carries + parsed.metres + parsed.tackles === 0) continue;
          await upsertTeamMatchStat({
            fixtureId: row.id,
            teamId,
            side: parsed.side,
            seasonId: row.season_id,
            competitionId: row.competition_id,
            externalMatchId: row.external_match_id,
            stats: parsed,
          });
        }
      }
      ok += 1;
      console.log("ok");
    } catch (e) {
      fail += 1;
      console.log("fail", e instanceof Error ? e.message.slice(0, 100) : e);
    }
    await sleep(250);
  }
  return { targets: (rows as unknown[]).length, ok, fail };
}

async function coverageSnapshot() {
  const db = getDb();
  const [row] = (await db.execute(sql`
    select
      count(*) filter (where status='full_time')::int as ft,
      count(*) filter (where status='full_time' and external_match_id ~ '^[a-z0-9]{6,12}$')::int as sdms_id,
      count(*) filter (where status='full_time' and external_match_id like 'wikipedia:%')::int as wiki_id,
      count(*) filter (where status='full_time' and external_match_id like 'livesport:%')::int as livesport_id,
      count(*) filter (where status='full_time' and external_match_id like 'rdb:%')::int as rdb_id,
      count(*) filter (where status='full_time' and sport365_url is not null and sport365_url<>'')::int as s365_url,
      count(*) filter (where status='full_time' and planet_rugby_url is not null and planet_rugby_url<>'')::int as planet_url,
      (select count(distinct fixture_id)::int from team_match_stats t where t.team_id=${SA_ID}::uuid and coalesce(t.carries,0)>0) as with_carries,
      (select count(distinct me.fixture_id)::int from match_events me
        join fixtures f on f.id=me.fixture_id
        where f.home_team_id=${SA_ID}::uuid or f.away_team_id=${SA_ID}::uuid) as with_events
    from fixtures f
    where f.home_team_id=${SA_ID}::uuid or f.away_team_id=${SA_ID}::uuid
  `)) as Array<Record<string, number>>;

  const maps = await db.execute(sql`
    select pem.provider, count(*)::int as n
    from provider_entity_mappings pem
    join fixtures f on f.id = pem.rugby365_id::uuid
    where pem.entity_type='match'
      and (f.home_team_id=${SA_ID}::uuid or f.away_team_id=${SA_ID}::uuid)
    group by 1 order by n desc
  `);
  return { row, maps };
}

async function main() {
  console.log("SA multi-source pull starting…");

  const summary: Record<string, unknown> = {};

  if (!skipRugbyData) {
    summary.rugbyData = await pullRugbyData();
  }

  if (!skipSport365) {
    summary.sport365 = await pullSport365();
  }

  if (!skipLiveSport) {
    summary.liveSport = await pullLiveSport();
  }

  if (!skipSdms) {
    summary.sdms = await pullRemainingSdmsTeamStats();
  }

  if (!skipRdb) {
    console.log("\n=== Rugbydatabase RWC (spawn) ===");
    console.log("  Run separately if not already: npm run import:rwc:rdb");
    summary.rdb = "delegated — see parallel job";
  }

  if (!skipWiki) {
    console.log("\n=== Wikipedia TRC / NH / RWC (spawn) ===");
    console.log("  Run separately if not already: npm run import:wikipedia:rugby-championship && npm run import:wikipedia:nh-internationals && npm run import:wikipedia:rwc");
    summary.wiki = "delegated — see parallel job";
  }

  if (!skipPlanet) {
    console.log("\n=== Planet Rugby seasons (spawn) ===");
    console.log("  Run separately: npx tsx scripts/import-planet-rugby-all-seasons.ts --slug=rugby-championship (etc)");
    summary.planet = "delegated — see parallel job";
  }

  summary.coverage = await coverageSnapshot();
  console.log("\n=== Coverage ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
