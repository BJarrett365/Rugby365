/**
 * Enrich + calculate match ratings for recent finished SDMS fixtures missing ratings.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-recent-match-ratings.ts
 */
import { sql } from "drizzle-orm";
import { createDb } from "@rugby365/db";
import { ensureMissingFixturePlayerMatchRatings } from "../apps/web/src/lib/match-rating-service";

async function main() {
  const db = createDb();
  const rows = await db.execute<{
    fixture_id: string;
    external_match_id: string | null;
    slug: string | null;
    squad: number;
    perf: number;
    rated: number;
  }>(sql`
    select f.id as fixture_id, f.external_match_id, f.slug,
      (select count(*)::int from fixture_players fp where fp.fixture_id=f.id) as squad,
      (select count(*)::int from player_match_performance_stats p where p.fixture_id=f.id) as perf,
      (select count(*)::int from player_match_ratings r where r.fixture_id=f.id and r.rating is not null) as rated
    from fixtures f
    where lower(trim(replace(f.status, ' ', '_'))) in ('full_time','completed','result','finished','ft')
      and f.kickoff_at > now() - interval '14 days'
      and f.external_match_id is not null
      and f.external_match_id not like 'wikipedia:%'
      and length(f.external_match_id) <= 12
      and (
        (select count(*)::int from player_match_ratings r where r.fixture_id=f.id and r.rating is not null) = 0
      )
    order by f.kickoff_at desc
  `);

  console.log(`Found ${rows.length} recent finished fixtures without ratings`);
  let calc = 0;
  let enrich = 0;
  for (const row of rows) {
    const result = await ensureMissingFixturePlayerMatchRatings(row.fixture_id, {
      matchId: row.external_match_id,
      allowSdmsEnrich: true,
    });
    calc += result.calculated;
    if (result.enriched) enrich += 1;
    console.log(
      `${row.slug ?? row.fixture_id}: squad=${row.squad} perf=${row.perf} rated=${row.rated} -> calc=${result.calculated} enriched=${result.enriched}`,
    );
  }
  console.log(`Done. calculated=${calc} enriched=${enrich}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
