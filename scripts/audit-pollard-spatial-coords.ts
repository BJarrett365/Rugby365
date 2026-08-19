/**
 * Deep spatial-coord audit for Handre Pollard (and global coverage).
 * Looks at nested JSON, extras, match_events columns, and related tables.
 */
import { getDb } from "../apps/web/src/lib/db";
import { sql } from "drizzle-orm";

const PLAYER_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";

const COORD_KEY_RE =
  /^(x|y|end_x|end_y|start_x|start_y|origin_x|origin_y|dest_x|dest_y|location_x|location_y|pitch_x|pitch_y|pitchx|pitchy|x_percent|y_percent|xpercent|ypercent|coord_x|coord_y|longitude|latitude|lng|lat)$/i;

function collectKeys(value: unknown, path: string, into: Map<string, number>, depth = 0) {
  if (depth > 6 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) collectKeys(item, `${path}[]`, into, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${k}` : k;
    into.set(next, (into.get(next) ?? 0) + 1);
    if (v && typeof v === "object") collectKeys(v, next, into, depth + 1);
  }
}

function findCoordHits(value: unknown, path: string, hits: string[], depth = 0) {
  if (depth > 6 || value == null || hits.length > 40) return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 30)) findCoordHits(item, `${path}[]`, hits, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    const next = path ? `${path}.${k}` : k;
    if (COORD_KEY_RE.test(k) && typeof v === "number") {
      hits.push(`${next}=${v}`);
    }
    if (v && typeof v === "object") findCoordHits(v, next, hits, depth + 1);
  }
}

async function main() {
  const db = getDb();

  const player = await db.execute(sql`
    SELECT id, slug, name, full_name FROM players WHERE id = ${PLAYER_ID} OR slug ILIKE '%pollard%' LIMIT 5
  `);
  console.log("=== PLAYER ===", JSON.stringify(player.rows ?? player, null, 2));

  const eventCols = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_events'
    ORDER BY ordinal_position
  `);
  console.log("=== MATCH_EVENTS COLS ===", JSON.stringify(eventCols.rows ?? eventCols, null, 2));

  const related = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        table_name ILIKE '%event%'
        OR table_name ILIKE '%spatial%'
        OR table_name ILIKE '%pitch%'
        OR table_name ILIKE '%heat%'
        OR table_name ILIKE '%zone%'
        OR table_name ILIKE '%tracking%'
        OR table_name ILIKE '%opt%'
      )
    ORDER BY table_name
  `);
  console.log("=== RELATED TABLES ===", JSON.stringify(related.rows ?? related, null, 2));

  const pollardEvents = await db.execute(sql`
    SELECT event_type, source_provider, COUNT(*)::int AS cnt
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
    GROUP BY 1, 2
    ORDER BY cnt DESC
  `);
  console.log("=== POLLARD EVENT TYPES ===", JSON.stringify(pollardEvents.rows ?? pollardEvents, null, 2));

  const payloadRows = await db.execute(sql`
    SELECT event_type, source_provider, payload
    FROM match_events
    WHERE player_id = ${PLAYER_ID}
  `);
  const rows = (payloadRows.rows ?? payloadRows) as Array<{
    event_type: string;
    source_provider: string | null;
    payload: unknown;
  }>;
  const keyCounts = new Map<string, number>();
  const coordHits: string[] = [];
  for (const row of rows) {
    collectKeys(row.payload, "", keyCounts);
    findCoordHits(row.payload, `${row.event_type}`, coordHits);
  }
  console.log(
    "=== POLLARD PAYLOAD KEY PATHS ===",
    JSON.stringify([...keyCounts.entries()].sort((a, b) => b[1] - a[1]), null, 2),
  );
  console.log("=== POLLARD COORD HITS IN PAYLOAD ===", coordHits.slice(0, 50), "count=", coordHits.length);

  const extrasRows = await db.execute(sql`
    SELECT source_provider, extras
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
  `);
  const extrasList = (extrasRows.rows ?? extrasRows) as Array<{
    source_provider: string | null;
    extras: unknown;
  }>;
  const extrasKeys = new Map<string, number>();
  const extrasCoordHits: string[] = [];
  const extrasByProvider = new Map<string, number>();
  for (const row of extrasList) {
    extrasByProvider.set(row.source_provider ?? "null", (extrasByProvider.get(row.source_provider ?? "null") ?? 0) + 1);
    collectKeys(row.extras, "", extrasKeys);
    findCoordHits(row.extras, row.source_provider ?? "extras", extrasCoordHits);
  }
  console.log("=== EXTRAS BY PROVIDER ===", Object.fromEntries(extrasByProvider));
  console.log(
    "=== POLLARD EXTRAS KEY PATHS ===",
    JSON.stringify([...extrasKeys.entries()].sort((a, b) => b[1] - a[1]), null, 2),
  );
  console.log("=== POLLARD COORD HITS IN EXTRAS ===", extrasCoordHits.slice(0, 50), "count=", extrasCoordHits.length);

  const extrasSample = await db.execute(sql`
    SELECT source_provider, extras
    FROM player_match_performance_stats
    WHERE player_id = ${PLAYER_ID}
      AND extras IS NOT NULL AND extras <> '{}'::jsonb
    ORDER BY synced_at DESC NULLS LAST
    LIMIT 3
  `);
  console.log("=== EXTRAS SAMPLE ===", JSON.stringify(extrasSample.rows ?? extrasSample, null, 2));

  const globalCoordText = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM match_events
    WHERE payload::text ~* '(location_x|origin_x|start_x|pitch_x|"x"|coord)'
  `);
  console.log("=== GLOBAL PAYLOAD TEXT MATCH ===", JSON.stringify(globalCoordText.rows ?? globalCoordText));

  const globalSample = await db.execute(sql`
    SELECT event_type, source_provider, left(payload::text, 400) AS payload_preview
    FROM match_events
    WHERE payload::text ~* '(location_x|origin_x|start_x|pitch_x|"x":|"y":)'
    LIMIT 8
  `);
  console.log("=== GLOBAL COORD-LIKE SAMPLES ===", JSON.stringify(globalSample.rows ?? globalSample, null, 2));

  const passKickGlobal = await db.execute(sql`
    SELECT event_type, source_provider, COUNT(*)::int AS cnt
    FROM match_events
    WHERE lower(event_type) LIKE '%pass%' OR lower(event_type) LIKE '%kick%'
    GROUP BY 1, 2
    ORDER BY cnt DESC
    LIMIT 40
  `);
  console.log("=== GLOBAL PASS/KICK EVENTS ===", JSON.stringify(passKickGlobal.rows ?? passKickGlobal, null, 2));

  const seasonPerf = await db.execute(sql`
    SELECT extras->>'passes' AS passes, extras->>'kicksFromHand' AS kicks
    FROM player_match_performance_stats pmps
    JOIN fixtures f ON f.id = pmps.fixture_id
    WHERE pmps.player_id = ${PLAYER_ID}
      AND f.kickoff_at >= '2025-07-01' AND f.kickoff_at < '2026-07-01'
    LIMIT 1
  `);
  const seasonAgg = await db.execute(sql`
    SELECT
      COUNT(*)::int AS matches,
      SUM(COALESCE((extras->>'passes')::int, 0)) AS passes,
      SUM(COALESCE((extras->>'kicksFromHand')::int, (extras->>'kicks_from_hand')::int, 0)) AS kicks_from_hand
    FROM player_match_performance_stats pmps
    JOIN fixtures f ON f.id = pmps.fixture_id
    WHERE pmps.player_id = ${PLAYER_ID}
      AND f.kickoff_at >= '2025-07-01' AND f.kickoff_at < '2026-07-01'
  `);
  console.log("=== 2025-26 PERF AGG ===", JSON.stringify(seasonAgg.rows ?? seasonAgg, null, 2), seasonPerf.rows);

  const globalExtrasKeys = await db.execute(sql`
    SELECT key, COUNT(*)::int AS cnt
    FROM player_match_performance_stats,
      LATERAL jsonb_object_keys(extras) AS key
    WHERE key ~* '(zone|coord|location|pitch|heatmap|pass.*left|pass.*right)'
    GROUP BY key
    ORDER BY cnt DESC
    LIMIT 40
  `);
  console.log("=== GLOBAL SPATIAL-LIKE EXTRAS KEYS ===", JSON.stringify(globalExtrasKeys.rows ?? globalExtrasKeys, null, 2));

  const scoringCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_scoring_events'
    ORDER BY ordinal_position
  `);
  console.log("=== PLAYER_SCORING_EVENTS COLS ===", JSON.stringify(scoringCols.rows ?? scoringCols, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
