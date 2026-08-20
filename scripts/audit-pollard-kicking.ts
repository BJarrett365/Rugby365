import { getDb } from "../apps/web/src/lib/db";
import { sql } from "drizzle-orm";
import { getPlayerStats } from "../apps/web/src/lib/public-player-stats-v2-service";

const PLAYER_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

async function main() {
  const db = getDb();

  const made = await db.execute(sql`
    SELECT
      COUNT(*)::int AS matches,
      COALESCE(SUM(fp.conversions),0)::int AS conv_made,
      COALESCE(SUM(fp.penalties),0)::int AS pen_made,
      COALESCE(SUM(fp.drop_goals),0)::int AS dg_made,
      COALESCE(SUM(fp.points),0)::int AS points,
      COUNT(*) FILTER (WHERE fp.conversions > 0 OR fp.penalties > 0 OR fp.drop_goals > 0)::int AS matches_with_made
    FROM fixture_players fp
    WHERE fp.player_id = ${PLAYER_ID}
  `);
  console.log("=== CAREER MADE (fixture_players) ===");
  console.log(JSON.stringify(made.rows ?? made, null, 2));

  const bySeason = await db.execute(sql`
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM f.kickoff_at) >= 8 THEN EXTRACT(YEAR FROM f.kickoff_at)::int
        ELSE EXTRACT(YEAR FROM f.kickoff_at)::int - 1
      END AS season_start,
      COUNT(*)::int AS matches,
      COALESCE(SUM(fp.conversions),0)::int AS conv_made,
      COALESCE(SUM(fp.penalties),0)::int AS pen_made,
      COALESCE(SUM(fp.drop_goals),0)::int AS dg_made,
      COALESCE(SUM(fp.points),0)::int AS points
    FROM fixture_players fp
    JOIN fixtures f ON f.id = fp.fixture_id
    WHERE fp.player_id = ${PLAYER_ID}
      AND f.kickoff_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
  `);
  console.log("=== BY SEASON START (fixture_players) ===");
  console.log(JSON.stringify(bySeason.rows ?? bySeason, null, 2));

  const extrasKeys = await db.execute(sql`
    SELECT DISTINCT jsonb_object_keys(extras) AS key
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
    ORDER BY 1
  `);
  console.log("=== EXTRAS KEYS ===");
  console.log(JSON.stringify(extrasKeys.rows ?? extrasKeys, null, 2));

  const attemptSample = await db.execute(sql`
    SELECT
      f.kickoff_at::date AS d,
      fp.conversions, fp.penalties, fp.drop_goals, fp.points,
      pmps.extras
    FROM fixture_players fp
    JOIN fixtures f ON f.id = fp.fixture_id
    LEFT JOIN player_match_performance_stats pmps
      ON pmps.fixture_id = fp.fixture_id AND pmps.player_id = fp.player_id
    WHERE fp.player_id = ${PLAYER_ID}
      AND (fp.conversions > 0 OR fp.penalties > 0 OR fp.drop_goals > 0)
    ORDER BY f.kickoff_at DESC NULLS LAST
    LIMIT 8
  `);
  console.log("=== SAMPLE MATCHES WITH MADE KICKS + EXTRAS ===");
  console.log(JSON.stringify(attemptSample.rows ?? attemptSample, null, 2));

  const attemptAgg = await db.execute(sql`
    SELECT
      COUNT(*)::int AS perf_matches,
      COUNT(*) FILTER (
        WHERE extras ?| ARRAY[
          'conversionAttempts','conversion_attempts','conversionsAttempted',
          'penaltyAttempts','penalty_attempts','penaltiesAttempted',
          'dropGoalAttempts','drop_goal_attempts','dropGoalsAttempted',
          'goalKickAttempts','goal_kick_attempts','shotsAtGoal','shots_at_goal',
          'missedConversions','missed_conversions','missedPenalties','missed_penalties',
          'missedDropGoals','missed_drop_goals'
        ]
      )::int AS with_attempt_like_keys,
      SUM(COALESCE((extras->>'conversionAttempts')::int,(extras->>'conversion_attempts')::int,(extras->>'conversionsAttempted')::int)) AS conv_att,
      SUM(COALESCE((extras->>'penaltyAttempts')::int,(extras->>'penalty_attempts')::int,(extras->>'penaltiesAttempted')::int)) AS pen_att,
      SUM(COALESCE((extras->>'dropGoalAttempts')::int,(extras->>'drop_goal_attempts')::int,(extras->>'dropGoalsAttempted')::int)) AS dg_att,
      SUM(COALESCE((extras->>'goalKickAttempts')::int,(extras->>'goal_kick_attempts')::int,(extras->>'shotsAtGoal')::int,(extras->>'shots_at_goal')::int)) AS goal_kick_att
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
  `);
  console.log("=== ATTEMPT AGG FROM EXTRAS ===");
  console.log(JSON.stringify(attemptAgg.rows ?? attemptAgg, null, 2));

  const events = await db.execute(sql`
    SELECT event_type, COUNT(*)::int AS n
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
      AND (
        lower(event_type) LIKE '%conv%'
        OR lower(event_type) LIKE '%penalt%'
        OR lower(event_type) LIKE '%drop%'
        OR lower(event_type) LIKE '%goal%'
        OR lower(event_type) LIKE '%kick%'
        OR lower(event_type) LIKE '%miss%'
      )
    GROUP BY event_type
    ORDER BY n DESC
  `);
  console.log("=== MATCH EVENTS (kick-like) ===");
  console.log(JSON.stringify(events.rows ?? events, null, 2));

  const eventCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'match_events'
    ORDER BY ordinal_position
  `);
  console.log("=== MATCH_EVENTS COLUMNS ===");
  console.log(JSON.stringify(eventCols.rows ?? eventCols, null, 2));

  // Global: do ANY players have attempt keys in extras?
  const globalAttempts = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE extras ?| ARRAY[
        'conversionAttempts','conversion_attempts','conversionsAttempted',
        'penaltyAttempts','penalty_attempts','penaltiesAttempted',
        'dropGoalAttempts','drop_goal_attempts','dropGoalsAttempted',
        'goalKickAttempts','goal_kick_attempts','shotsAtGoal','shots_at_goal'
      ])::int AS rows_with_attempts,
      COUNT(*)::int AS total_rows
    FROM player_match_performance_stats
  `);
  console.log("=== GLOBAL EXTRAS ATTEMPT COVERAGE ===");
  console.log(JSON.stringify(globalAttempts.rows ?? globalAttempts, null, 2));

  // Sample keys that look attempt-related across all players
  const globalKeys = await db.execute(sql`
    SELECT key, COUNT(*)::int AS n
    FROM (
      SELECT jsonb_object_keys(extras) AS key
      FROM player_match_performance_stats
      WHERE extras <> '{}'::jsonb
      LIMIT 50000
    ) s
    WHERE key ILIKE '%attempt%'
       OR key ILIKE '%miss%'
       OR key ILIKE '%goal%'
       OR key ILIKE '%conv%'
       OR key ILIKE '%penalt%'
       OR key ILIKE '%drop%'
       OR key ILIKE '%kick%'
       OR key ILIKE '%shot%'
    GROUP BY key
    ORDER BY n DESC
    LIMIT 80
  `);
  console.log("=== GLOBAL EXTRAS KEYS (kick-related sample) ===");
  console.log(JSON.stringify(globalKeys.rows ?? globalKeys, null, 2));

  const stats = await getPlayerStats(PLAYER_ID, { season: "2025-26" });
  console.log("=== getPlayerStats kickingAccuracy season 2025-26 ===");
  console.log(JSON.stringify({
    selectedSeasonLabel: stats?.selectedSeasonLabel,
    selectedSeasonSlug: stats?.selectedSeasonSlug,
    availableSeasons: stats?.availableSeasons,
    coverage: stats?.coverage,
    seasonKick: stats?.season.kickingAccuracy,
    careerKick: stats?.career.kickingAccuracy,
    seasonMade: {
      matches: stats?.season.matches,
      conv: stats?.season.gameLog.reduce((a, r) => a + (r.conversions ?? 0), 0),
      pen: stats?.season.gameLog.reduce((a, r) => a + (r.penalties ?? 0), 0),
      dg: stats?.season.gameLog.reduce((a, r) => a + (r.dropGoals ?? 0), 0),
      convAttKnown: stats?.season.gameLog.filter(r => r.conversionAttempts != null).length,
      penAttKnown: stats?.season.gameLog.filter(r => r.penaltyAttempts != null).length,
    }
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
