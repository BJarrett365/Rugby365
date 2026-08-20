import { getDb } from "../apps/web/src/lib/db";
import { sql } from "drizzle-orm";

const PLAYER_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

async function main() {
  const db = getDb();

  const perfRows = await db.execute(sql`
    SELECT
      COUNT(*)::int AS matches,
      SUM(COALESCE((extras->>'passes')::int, 0)) AS total_passes,
      SUM(COALESCE((extras->>'kicksFromHand')::int, (extras->>'kicks_from_hand')::int, 0)) AS kicks_from_hand,
      SUM(COALESCE((extras->>'kicks')::int, 0)) AS total_kicks
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
  `);
  console.log("=== PERF STATS AGGREGATES ===");
  console.log(JSON.stringify(perfRows.rows ?? perfRows, null, 2));

  const bySeason = await db.execute(sql`
    SELECT
      EXTRACT(YEAR FROM f.kickoff_at)::int AS kickoff_year,
      COUNT(*)::int AS matches,
      SUM(COALESCE((pmps.extras->>'passes')::int, 0)) AS passes,
      SUM(COALESCE((pmps.extras->>'kicksFromHand')::int, (pmps.extras->>'kicks_from_hand')::int, 0)) AS kicks_from_hand
    FROM player_match_performance_stats pmps
    JOIN fixtures f ON f.id = pmps.fixture_id
    WHERE pmps.player_id = ${PLAYER_ID}
    GROUP BY kickoff_year
    ORDER BY kickoff_year DESC NULLS LAST
  `);
  console.log("=== BY KICKOFF YEAR (perf) ===");
  console.log(JSON.stringify(bySeason.rows ?? bySeason, null, 2));

  const eventCount = await db.execute(sql`
    SELECT event_type, source_provider, COUNT(*)::int AS cnt
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
    GROUP BY event_type, source_provider
    ORDER BY cnt DESC
    LIMIT 30
  `);
  console.log("=== EVENT TYPES ===");
  console.log(JSON.stringify(eventCount.rows ?? eventCount, null, 2));

  const coordSample = await db.execute(sql`
    SELECT event_type, source_provider, payload
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
      AND (
        payload ? 'x' OR payload ? 'y' OR payload ? 'location_x' OR payload ? 'location_y'
        OR payload ? 'origin_x' OR payload ? 'start_x' OR payload ? 'end_x'
        OR payload ? 'pitch_x' OR payload ? 'pitchX'
      )
    LIMIT 5
  `);
  console.log("=== POLLARD EVENTS WITH COORD KEYS ===");
  console.log(JSON.stringify(coordSample.rows ?? coordSample, null, 2));

  const passKickEvents = await db.execute(sql`
    SELECT event_type, source_provider, payload
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
      AND (
        lower(event_type) LIKE '%pass%' OR lower(event_type) LIKE '%kick%'
      )
    LIMIT 10
  `);
  console.log("=== PASS/KICK EVENTS SAMPLE ===");
  console.log(JSON.stringify(passKickEvents.rows ?? passKickEvents, null, 2));

  const globalCoord = await db.execute(sql`
    SELECT event_type, source_provider, COUNT(*)::int AS cnt
    FROM match_events
    WHERE (
      payload ? 'x' OR payload ? 'y' OR payload ? 'location_x' OR payload ? 'location_y'
      OR payload ? 'origin_x' OR payload ? 'start_x' OR payload ? 'end_x'
      OR payload ? 'pitch_x' OR payload ? 'pitchX'
      OR payload ? 'x_percent' OR payload ? 'y_percent'
    )
    GROUP BY event_type, source_provider
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log("=== GLOBAL EVENTS WITH COORDS ===");
  console.log(JSON.stringify(globalCoord.rows ?? globalCoord, null, 2));

  const globalSample = await db.execute(sql`
    SELECT event_type, source_provider, payload
    FROM match_events
    WHERE (
      payload ? 'x' OR payload ? 'y' OR payload ? 'location_x'
    )
    LIMIT 3
  `);
  console.log("=== GLOBAL COORD SAMPLE ===");
  console.log(JSON.stringify(globalSample.rows ?? globalSample, null, 2));

  const extrasKeys = await db.execute(sql`
    SELECT DISTINCT jsonb_object_keys(extras) AS key
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
    ORDER BY key
  `);
  console.log("=== EXTRAS KEYS ===");
  console.log(JSON.stringify(extrasKeys.rows ?? extrasKeys, null, 2));

  const payloadKeys = await db.execute(sql`
    SELECT DISTINCT jsonb_object_keys(payload) AS key
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
    ORDER BY key
    LIMIT 50
  `);
  console.log("=== PAYLOAD KEYS (Pollard events) ===");
  console.log(JSON.stringify(payloadKeys.rows ?? payloadKeys, null, 2));

  const totalEvents = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM match_events WHERE player_id = ${PLAYER_ID}
  `);
  console.log("=== TOTAL EVENTS FOR POLLARD ===");
  console.log(JSON.stringify(totalEvents.rows ?? totalEvents, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
