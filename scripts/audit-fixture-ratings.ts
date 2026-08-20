/**
 * Audit finished fixtures for missing player/coach/referee ratings.
 *
 * Usage: npx tsx scripts/audit-fixture-ratings.ts
 */
import { sql } from "drizzle-orm";
import { createDb } from "@rugby365/db";

async function main() {
  const db = createDb();

  const [summary] = await db.execute<{
    finished_fixtures: number;
    fixtures_with_squad: number;
    fixtures_with_perf: number;
    fixtures_missing_player_match_ratings: number;
    missing_player_match_rating_rows: number;
    players_in_finished_missing_career: number;
    fixtures_missing_coach_ratings: number;
    missing_coach_rating_rows: number;
    fixtures_missing_referee_ratings: number;
    missing_referee_rating_rows: number;
  }>(sql`
    with finished as (
      select f.id, f.status, f.home_coach_id, f.away_coach_id, f.referee_id
      from fixtures f
      where lower(trim(replace(f.status, ' ', '_'))) in (
        'full_time', 'completed', 'result', 'finished', 'ft'
      )
    ),
    squad as (
      select fp.fixture_id, fp.player_id
      from fixture_players fp
      inner join finished f on f.id = fp.fixture_id
    ),
    perf as (
      select pms.fixture_id, pms.player_id
      from player_match_performance_stats pms
      inner join finished f on f.id = pms.fixture_id
    ),
  player_match_gaps as (
      select
        p.fixture_id,
        p.player_id
      from perf p
      left join player_match_ratings pmr
        on pmr.fixture_id = p.fixture_id
       and pmr.player_id = p.player_id
       and pmr.rating is not null
      where pmr.id is null
    ),
    career_gaps as (
      select distinct s.player_id
      from squad s
      left join player_ratings pr on pr.player_id = s.player_id
      where pr.player_id is null
         or (pr.player_rating is null and pr.manual_override_rating is null)
    ),
    coach_gaps as (
      select
        f.id as fixture_id,
        coaches.coach_id
      from finished f
      cross join lateral (
        select unnest(array_remove(array[f.home_coach_id, f.away_coach_id], null::uuid)) as coach_id
      ) coaches
      left join coach_match_ratings cmr
        on cmr.fixture_id = f.id and cmr.coach_id = coaches.coach_id
      where coaches.coach_id is not null and cmr.id is null
    ),
    referee_gaps as (
      select f.id as fixture_id, f.referee_id
      from finished f
      left join referee_match_ratings rmr
        on rmr.fixture_id = f.id and rmr.referee_id = f.referee_id
      where f.referee_id is not null and rmr.id is null
    )
    select
      (select count(*)::int from finished) as finished_fixtures,
      (select count(distinct fixture_id)::int from squad) as fixtures_with_squad,
      (select count(distinct fixture_id)::int from perf) as fixtures_with_perf,
      (select count(distinct fixture_id)::int from player_match_gaps) as fixtures_missing_player_match_ratings,
      (select count(*)::int from player_match_gaps) as missing_player_match_rating_rows,
      (select count(*)::int from career_gaps) as players_in_finished_missing_career,
      (select count(distinct fixture_id)::int from coach_gaps) as fixtures_missing_coach_ratings,
      (select count(*)::int from coach_gaps) as missing_coach_rating_rows,
      (select count(distinct fixture_id)::int from referee_gaps) as fixtures_missing_referee_ratings,
      (select count(*)::int from referee_gaps) as missing_referee_rating_rows
  `);

  console.log("=== Fixture ratings audit ===");
  console.log(JSON.stringify(summary, null, 2));

  const sample = await db.execute<{
    kind: string;
    fixture_id: string;
    entity_id: string;
    slug: string | null;
  }>(sql`
    with finished as (
      select f.id, f.slug, f.status, f.home_coach_id, f.away_coach_id, f.referee_id
      from fixtures f
      where lower(trim(replace(f.status, ' ', '_'))) in (
        'full_time', 'completed', 'result', 'finished', 'ft'
      )
    ),
    player_match_gaps as (
      select p.fixture_id, p.player_id as entity_id, 'player_match' as kind
      from player_match_performance_stats p
      inner join finished f on f.id = p.fixture_id
      left join player_match_ratings pmr
        on pmr.fixture_id = p.fixture_id
       and pmr.player_id = p.player_id
       and pmr.rating is not null
      where pmr.id is null
      limit 5
    ),
    coach_gaps as (
      select f.id as fixture_id, coaches.coach_id as entity_id, 'coach' as kind
      from finished f
      cross join lateral (
        select unnest(array_remove(array[f.home_coach_id, f.away_coach_id], null::uuid)) as coach_id
      ) coaches
      left join coach_match_ratings cmr
        on cmr.fixture_id = f.id and cmr.coach_id = coaches.coach_id
      where coaches.coach_id is not null and cmr.id is null
      limit 5
    ),
    referee_gaps as (
      select f.id as fixture_id, f.referee_id as entity_id, 'referee' as kind
      from finished f
      left join referee_match_ratings rmr
        on rmr.fixture_id = f.id and rmr.referee_id = f.referee_id
      where f.referee_id is not null and rmr.id is null
      limit 5
    )
    select g.kind, g.fixture_id, g.entity_id, f.slug
    from (
      select * from player_match_gaps
      union all select * from coach_gaps
      union all select * from referee_gaps
    ) g
    inner join finished f on f.id = g.fixture_id
    limit 15
  `);

  console.log("\n=== Sample gaps ===");
  for (const row of sample) {
    console.log(`${row.kind}: fixture=${row.slug ?? row.fixture_id} entity=${row.entity_id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
