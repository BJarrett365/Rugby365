/**
 * Backfill missing player/coach/referee ratings for finished fixtures.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-fixture-ratings.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-fixture-ratings.ts --limit=50
 */
import { sql } from "drizzle-orm";
import { createDb } from "@rugby365/db";
import {
  ensureMissingFixturePlayerCareerRatings,
  ensureMissingFixturePlayerMatchRatings,
} from "../apps/web/src/lib/match-rating-service";
import { ensureMissingFixtureStaffMatchRatings } from "../apps/web/src/lib/staff-match-rating-service";
import { ensureFixtureMatchCoaches } from "../apps/web/src/lib/match-coach-resolve-service";

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

async function listFixtureIdsNeedingRatings(db: ReturnType<typeof createDb>, max?: number) {
  const rows = await db.execute<{ fixture_id: string }>(sql`
    with finished as (
      select f.id
      from fixtures f
      where lower(trim(replace(f.status, ' ', '_'))) in (
        'full_time', 'completed', 'result', 'finished', 'ft'
      )
    ),
    player_match_gaps as (
      select distinct p.fixture_id
      from player_match_performance_stats p
      inner join finished f on f.id = p.fixture_id
      left join player_match_ratings pmr
        on pmr.fixture_id = p.fixture_id
       and pmr.player_id = p.player_id
       and pmr.rating is not null
      where pmr.id is null
    ),
    career_gaps as (
      select distinct fp.fixture_id
      from fixture_players fp
      inner join finished f on f.id = fp.fixture_id
      left join player_ratings pr on pr.player_id = fp.player_id
      where pr.player_id is null
         or (pr.player_rating is null and pr.manual_override_rating is null)
    ),
    coach_gaps as (
      select distinct f.id as fixture_id
      from fixtures f
      inner join finished fin on fin.id = f.id
      cross join lateral (
        select unnest(array_remove(array[f.home_coach_id, f.away_coach_id], null::uuid)) as coach_id
      ) coaches
      left join coach_match_ratings cmr
        on cmr.fixture_id = f.id and cmr.coach_id = coaches.coach_id
      where coaches.coach_id is not null and cmr.id is null
    ),
    referee_gaps as (
      select distinct f.id as fixture_id
      from fixtures f
      inner join finished fin on fin.id = f.id
      left join referee_match_ratings rmr
        on rmr.fixture_id = f.id and rmr.referee_id = f.referee_id
      where f.referee_id is not null and rmr.id is null
    )
    select fixture_id
    from (
      select fixture_id from player_match_gaps
      union
      select fixture_id from career_gaps
      union
      select fixture_id from coach_gaps
      union
      select fixture_id from referee_gaps
    ) gaps
    order by fixture_id
    ${max ? sql`limit ${max}` : sql``}
  `);
  return rows.map((row) => row.fixture_id);
}

async function main() {
  const db = createDb();
  const fixtureIds = await listFixtureIdsNeedingRatings(db, limit);
  console.log(`Processing ${fixtureIds.length} finished fixtures with rating gaps…`);

  let playerMatchCalculated = 0;
  let careerCalculated = 0;
  let coachesCalculated = 0;
  let refereeCalculated = 0;
  let processed = 0;
  let failed = 0;

  for (const fixtureId of fixtureIds) {
    processed += 1;
    try {
      await ensureFixtureMatchCoaches(fixtureId);
      const playerMatch = await ensureMissingFixturePlayerMatchRatings(fixtureId);
      const staff = await ensureMissingFixtureStaffMatchRatings(fixtureId);
      playerMatchCalculated += playerMatch.calculated;
      coachesCalculated += staff.coachesCalculated;
      refereeCalculated += staff.refereeCalculated;
      if (processed % 25 === 0 || processed === fixtureIds.length) {
        console.log(
          `[${processed}/${fixtureIds.length}] playerMatch +${playerMatchCalculated} coaches +${coachesCalculated} refs +${refereeCalculated}`,
        );
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `Fixture ${fixtureId} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\nBackfilling missing career ratings for squad players…");
  const { batchCalculateAllPlayerRatings } = await import(
    "../apps/web/src/lib/player-ratings-batch-service"
  );
  const careerSummary = await batchCalculateAllPlayerRatings({
    onlyMissing: true,
    onlyWithMatchData: true,
    onProgress: ({ index, total }) => {
      if (index % 100 === 0 || index === total) {
        console.log(`[career ${index}/${total}]`);
      }
    },
  });
  careerCalculated = careerSummary.rated;

  console.log("\n=== Backfill complete ===");
  console.log(
    JSON.stringify(
      {
        fixturesProcessed: processed,
        fixturesFailed: failed,
        playerMatchRatingsCreated: playerMatchCalculated,
        careerRatingsCreated: careerCalculated,
        careerBatchFailed: careerSummary.failed,
        careerBatchSkipped: careerSummary.skipped,
        coachMatchRatingsCreated: coachesCalculated,
        refereeMatchRatingsCreated: refereeCalculated,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
