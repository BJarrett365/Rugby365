import { getDb } from "../apps/web/src/lib/db";
import { sql } from "drizzle-orm";
import { getPlayerSpatialStats } from "../apps/web/src/lib/public-player-spatial-stats-service";

const PLAYER_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

async function main() {
  const db = getDb();

  const nested = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM match_events
    WHERE payload::text ~* '(location|coord|pitch|start_x|end_x|"x"|"y")'
  `);
  console.log("=== PAYLOAD TEXT MATCH (any events) ===", JSON.stringify(nested.rows ?? nested));

  const sample = await db.execute(sql`
    SELECT event_type, payload FROM match_events WHERE player_id = ${PLAYER_ID} LIMIT 2
  `);
  console.log("=== SAMPLE PAYLOAD ===", JSON.stringify(sample.rows ?? sample, null, 2));

  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        table_name ILIKE '%event%'
        OR table_name ILIKE '%spatial%'
        OR table_name ILIKE '%pitch%'
        OR table_name ILIKE '%heat%'
        OR table_name ILIKE '%zone%'
        OR table_name ILIKE '%tracking%'
      )
    ORDER BY table_name
  `);
  console.log("=== RELATED TABLES ===", JSON.stringify(tables.rows ?? tables, null, 2));

  const passKick = await db.execute(sql`
    SELECT event_type, source_provider, COUNT(*)::int AS cnt
    FROM match_events
    WHERE lower(event_type) LIKE '%pass%' OR lower(event_type) LIKE '%kick%'
    GROUP BY 1,2 ORDER BY cnt DESC LIMIT 30
  `);
  console.log("=== GLOBAL PASS/KICK EVENTS ===", JSON.stringify(passKick.rows ?? passKick, null, 2));

  const cols = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'match_events' ORDER BY ordinal_position
  `);
  console.log("=== MATCH_EVENTS COLS ===", JSON.stringify(cols.rows ?? cols, null, 2));

  const total = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM match_events`);
  console.log("=== TOTAL MATCH EVENTS ===", JSON.stringify(total.rows ?? total));

  const seasonSpatial = await getPlayerSpatialStats(PLAYER_ID, { seasonSlug: "2025-26" });
  const careerSpatial = await getPlayerSpatialStats(PLAYER_ID, {});
  console.log("=== SERVICE SEASON 2025-26 ===", JSON.stringify(seasonSpatial, null, 2));
  console.log("=== SERVICE CAREER ===", JSON.stringify(careerSpatial, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
