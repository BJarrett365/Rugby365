/**
 * Archive RWC rankings hygiene:
 *  - persist rankingCareerStatus=retired for people with no 2016+ rated fixtures
 *  - remove current national coaches copied onto historical World Cup matches
 *  - split the merged 1987 / 2011–19 Jonathan Davies player rows
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fix-rwc-archive-careers-and-staff.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";

const MERGED_DAVIES_ID = "7605938f-0edb-4762-b80f-aee61217d150";

async function markArchiveCareersRetired() {
  const db = getDb();
  const players = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    UPDATE players p
    SET
      career_status = CASE
        WHEN lower(coalesce(p.career_status, 'active')) IN ('active', 'released') THEN 'retired'
        ELSE p.career_status
      END,
      social_accounts = jsonb_set(
        coalesce(p.social_accounts, '{}'::jsonb),
        '{rankingCareerStatus}',
        '"retired"'::jsonb,
        true
      ),
      profile_updated_at = now()
    WHERE EXISTS (
        SELECT 1 FROM player_match_ratings pmr, rwc
        WHERE pmr.player_id = p.id AND pmr.competition_id = rwc.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM player_match_ratings pmr2
        JOIN fixtures f ON f.id = pmr2.fixture_id
        WHERE pmr2.player_id = p.id
          AND f.kickoff_at >= TIMESTAMPTZ '2016-01-01 00:00:00+00'
      )
    RETURNING p.id
  `);
  console.log("players archive-retired", (players.rows ?? players).length);

  const refs = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    UPDATE referees r
    SET
      social_accounts = jsonb_set(
        coalesce(r.social_accounts, '{}'::jsonb),
        '{rankingCareerStatus}',
        '"retired"'::jsonb,
        true
      ),
      updated_at = now()
    WHERE EXISTS (
        SELECT 1 FROM referee_match_ratings rmr, rwc
        WHERE rmr.referee_id = r.id AND rmr.competition_id = rwc.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM referee_match_ratings rmr2
        JOIN fixtures f ON f.id = rmr2.fixture_id
        WHERE rmr2.referee_id = r.id
          AND f.kickoff_at >= TIMESTAMPTZ '2016-01-01 00:00:00+00'
      )
    RETURNING r.id
  `);
  console.log("referees archive-retired", (refs.rows ?? refs).length);

  const coaches = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    UPDATE coaches c
    SET
      social_accounts = jsonb_set(
        coalesce(c.social_accounts, '{}'::jsonb),
        '{rankingCareerStatus}',
        '"retired"'::jsonb,
        true
      ),
      profile_updated_at = now()
    WHERE EXISTS (
        SELECT 1 FROM coach_match_ratings cmr, rwc
        WHERE cmr.coach_id = c.id AND cmr.competition_id = rwc.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM team_coaching_staff tcs
        WHERE tcs.coach_id = c.id AND tcs.is_current = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM coach_match_ratings cmr2
        JOIN fixtures f ON f.id = cmr2.fixture_id
        WHERE cmr2.coach_id = c.id
          AND f.kickoff_at >= TIMESTAMPTZ '2022-01-01 00:00:00+00'
      )
    RETURNING c.id
  `);
  console.log("coaches archive-retired", (coaches.rows ?? coaches).length);
}

async function removeAnachronisticRwcCoaches() {
  const db = getDb();
  const asPlayers = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    DELETE FROM coach_match_ratings cmr
    USING coaches c, rwc
    WHERE cmr.coach_id = c.id
      AND cmr.competition_id = rwc.id
      AND EXISTS (
        SELECT 1
        FROM players p
        JOIN player_match_ratings pmr ON pmr.player_id = p.id
        WHERE pmr.season_id = cmr.season_id
          AND pmr.competition_id = rwc.id
          AND lower(p.name) = lower(c.name)
      )
    RETURNING cmr.id
  `);
  console.log("deleted coach ratings for same-season players", (asPlayers.rows ?? asPlayers).length);

  const tooYoung = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    DELETE FROM coach_match_ratings cmr
    USING coaches c, fixtures f, rwc
    WHERE cmr.coach_id = c.id
      AND cmr.fixture_id = f.id
      AND cmr.competition_id = rwc.id
      AND c.birth_date IS NOT NULL
      AND f.kickoff_at::date < (c.birth_date + INTERVAL '30 years')
    RETURNING cmr.id
  `);
  console.log("deleted too-young coach ratings", (tooYoung.rows ?? tooYoung).length);

  const currentStaff = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    DELETE FROM coach_match_ratings cmr
    USING coaches c, teams t, team_coaching_staff tcs, competition_seasons s, rwc
    WHERE cmr.coach_id = c.id
      AND cmr.team_id = t.id
      AND cmr.season_id = s.id
      AND cmr.competition_id = rwc.id
      AND tcs.coach_id = c.id
      AND tcs.team_id = t.id
      AND tcs.is_current = true
      AND s.year < 2023
      AND EXISTS (
        SELECT 1
        FROM coach_match_ratings other
        WHERE other.season_id = cmr.season_id
          AND other.competition_id = rwc.id
          AND other.coach_id <> cmr.coach_id
          AND other.team_id = cmr.team_id
      )
    RETURNING cmr.id
  `);
  console.log("deleted current-staff archive coach ratings", (currentStaff.rows ?? currentStaff).length);

  const namedExtras = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    DELETE FROM coach_match_ratings cmr
    USING coaches c, competition_seasons s, rwc, teams t
    WHERE cmr.coach_id = c.id
      AND cmr.season_id = s.id
      AND cmr.competition_id = rwc.id
      AND t.id = cmr.team_id
      AND (
        (s.year = 2019 AND c.name IN ('Scott Robertson', 'Fabien Galthie', 'Steve Borthwick', 'Gonzalo Quesada', 'Andy Farrell'))
        OR (s.year = 2015 AND c.name = 'Felipe Contepomi')
        OR (s.year = 2023 AND c.name = 'Eddie Jones' AND t.name ILIKE '%japan%')
      )
    RETURNING cmr.id
  `);
  console.log("deleted named anachronistic coach ratings", (namedExtras.rows ?? namedExtras).length);

  const startYear = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    DELETE FROM coach_match_ratings cmr
    USING coaches c, fixtures f, rwc
    WHERE cmr.coach_id = c.id
      AND cmr.fixture_id = f.id
      AND cmr.competition_id = rwc.id
      AND c.coaching_career_start_year IS NOT NULL
      AND EXTRACT(YEAR FROM f.kickoff_at) < c.coaching_career_start_year
    RETURNING cmr.id
  `);
  console.log("deleted pre-career-start coach ratings", (startYear.rows ?? startYear).length);

  const unlinked = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    UPDATE fixtures f
    SET home_coach_id = CASE
          WHEN f.home_coach_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM coach_match_ratings cmr
            WHERE cmr.fixture_id = f.id AND cmr.coach_id = f.home_coach_id
          ) THEN NULL
          ELSE f.home_coach_id
        END,
        away_coach_id = CASE
          WHEN f.away_coach_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM coach_match_ratings cmr
            WHERE cmr.fixture_id = f.id AND cmr.coach_id = f.away_coach_id
          ) THEN NULL
          ELSE f.away_coach_id
        END
    FROM rwc
    WHERE f.competition_id = rwc.id
      AND (
        (f.home_coach_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM coach_match_ratings cmr
          WHERE cmr.fixture_id = f.id AND cmr.coach_id = f.home_coach_id
        ))
        OR
        (f.away_coach_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM coach_match_ratings cmr
          WHERE cmr.fixture_id = f.id AND cmr.coach_id = f.away_coach_id
        ))
      )
    RETURNING f.id
  `);
  console.log("unlinked archive fixture coach fks", (unlinked.rows ?? unlinked).length);
}

async function splitJonathanDavies() {
  const db = getDb();
  const [existing] = await db.execute<{ id: string }>(sql`
    SELECT id FROM players WHERE slug = 'jonathan-davies-rwc-1987' LIMIT 1
  `);
  if (existing?.id) {
    console.log("jonathan davies 1987 already split", existing.id);
    return;
  }
  const inserted = await db.execute<{ id: string }>(sql`
    INSERT INTO players (
      slug, name, source_provider, position_name, club_name, country_name, nation_code,
      club_team_id, international_team_id, career_status, social_accounts, is_public, publish_status
    )
    SELECT
      'jonathan-davies-rwc-1987',
      p.name,
      'manual',
      'Fly-half',
      p.club_name,
      'Wales',
      'WAL',
      p.club_team_id,
      p.international_team_id,
      'retired',
      jsonb_set(coalesce(p.social_accounts, '{}'::jsonb), '{rankingCareerStatus}', '"retired"'::jsonb, true),
      true,
      'published'
    FROM players p
    WHERE p.id = ${MERGED_DAVIES_ID}::uuid
    RETURNING id
  `);
  const row = (inserted.rows ?? inserted)[0] as { id: string } | undefined;
  if (!row?.id) {
    console.log("jonathan davies split skipped — source player missing");
    return;
  }
  const moved = await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    UPDATE player_match_ratings pmr
    SET player_id = ${row.id}::uuid
    FROM competition_seasons s, rwc
    WHERE pmr.player_id = ${MERGED_DAVIES_ID}::uuid
      AND pmr.season_id = s.id
      AND s.competition_id = rwc.id
      AND s.year = 1987
    RETURNING pmr.id
  `);
  await db.execute(sql`
    WITH rwc AS (SELECT id FROM competitions WHERE slug = 'rugby-world-cup')
    UPDATE fixture_players fp
    SET player_id = ${row.id}::uuid
    FROM fixtures f, competition_seasons s, rwc
    WHERE fp.player_id = ${MERGED_DAVIES_ID}::uuid
      AND fp.fixture_id = f.id
      AND f.season_id = s.id
      AND s.competition_id = rwc.id
      AND s.year = 1987
  `);
  console.log("split jonathan davies 1987", row.id, "ratings", (moved.rows ?? moved).length);
}

async function main() {
  await removeAnachronisticRwcCoaches();
  await splitJonathanDavies();
  await markArchiveCareersRetired();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
