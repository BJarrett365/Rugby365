/**
 * Backfill missing coach/referee match ratings on finished fixtures.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-staff-match-ratings.ts
 */
import { sql } from "drizzle-orm";
import { createDb } from "@rugby365/db";
import { ensureMissingFixtureStaffMatchRatings } from "../apps/web/src/lib/staff-match-rating-service";
import { ensureFixtureMatchCoaches } from "../apps/web/src/lib/match-coach-resolve-service";

async function main() {
  const db = createDb();
  const rows = await db.execute<{ fixture_id: string; slug: string | null }>(sql`
    with finished as (
      select f.id, f.slug, f.home_coach_id, f.away_coach_id, f.referee_id
      from fixtures f
      where lower(trim(replace(f.status, ' ', '_'))) in ('full_time','completed','result','finished','ft')
    ),
    coach_gaps as (
      select distinct f.id as fixture_id, f.slug
      from finished f
      cross join lateral (
        select unnest(array_remove(array[f.home_coach_id, f.away_coach_id], null::uuid)) as coach_id
      ) coaches
      left join coach_match_ratings cmr on cmr.fixture_id = f.id and cmr.coach_id = coaches.coach_id
      where coaches.coach_id is not null and cmr.id is null
    ),
    referee_gaps as (
      select distinct f.id as fixture_id, f.slug
      from finished f
      left join referee_match_ratings rmr on rmr.fixture_id = f.id and rmr.referee_id = f.referee_id
      where f.referee_id is not null and rmr.id is null
    )
    select fixture_id, slug from (
      select fixture_id, slug from coach_gaps
      union
      select fixture_id, slug from referee_gaps
    ) g
  `);

  console.log(`Processing ${rows.length} fixtures with staff rating gaps…`);
  let coaches = 0;
  let refs = 0;
  for (const [i, row] of rows.entries()) {
    await ensureFixtureMatchCoaches(row.fixture_id);
    const result = await ensureMissingFixtureStaffMatchRatings(row.fixture_id);
    coaches += result.coachesCalculated;
    refs += result.refereeCalculated;
    if ((i + 1) % 100 === 0 || i + 1 === rows.length) {
      console.log(`[${i + 1}/${rows.length}] coaches +${coaches} refs +${refs}`);
    }
  }
  console.log(JSON.stringify({ fixtures: rows.length, coachesCalculated: coaches, refereeCalculated: refs }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
