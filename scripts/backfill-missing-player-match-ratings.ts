/**
 * Backfill only fixtures with performance stats but missing match ratings.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-missing-player-match-ratings.ts
 */
import { sql } from "drizzle-orm";
import { createDb } from "@rugby365/db";
import { ensureMissingFixturePlayerMatchRatings } from "../apps/web/src/lib/match-rating-service";

async function main() {
  const db = createDb();
  const rows = await db.execute<{ fixture_id: string; slug: string | null; missing: number }>(sql`
    select f.id as fixture_id, f.slug, count(*)::int as missing
    from player_match_performance_stats p
    inner join fixtures f on f.id = p.fixture_id
    left join player_match_ratings pmr
      on pmr.fixture_id = p.fixture_id
     and pmr.player_id = p.player_id
     and pmr.rating is not null
    where lower(trim(replace(f.status, ' ', '_'))) in ('full_time','completed','result','finished','ft')
      and pmr.id is null
    group by f.id, f.slug
    order by missing desc
  `);

  console.log(`Found ${rows.length} fixtures with missing player match ratings`);
  let total = 0;
  for (const row of rows) {
    const result = await ensureMissingFixturePlayerMatchRatings(row.fixture_id);
    total += result.calculated;
    console.log(`${row.slug ?? row.fixture_id}: missing=${row.missing} calculated=${result.calculated} enriched=${result.enriched}`);
  }
  console.log(`Total player match ratings created: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
