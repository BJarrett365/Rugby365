/**
 * Deduplicate players using a bulk mapping table and bulk SQL.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/dedupe-players-sql.ts
 *   npx tsx --env-file=.env scripts/dedupe-players-sql.ts --dry-run
 */

import { createDb } from "../packages/db/src/client";
import { sql } from "drizzle-orm";

const dryRun = process.argv.includes("--dry-run");
const deleteOnly = process.argv.includes("--delete-only");
const db = createDb(process.env.DATABASE_URL);

async function exec(query: string) {
  return db.execute(sql.raw(query));
}

async function main() {
  console.log("Building duplicate mapping…");

  // Create mapping table with dupe→canonical mapping
  await exec(`DROP TABLE IF EXISTS _player_dedup_map`);
  await exec(`
    CREATE TABLE _player_dedup_map AS
    WITH ranked AS (
      SELECT id, lower(trim(name)) as norm_name,
        ROW_NUMBER() OVER (
          PARTITION BY lower(trim(name))
          ORDER BY
            (CASE WHEN external_provider_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
            (CASE WHEN source_provider IN ('sdms','sport365') THEN 2 WHEN source_provider = 'rugby_data' THEN 1 ELSE 0 END) DESC,
            (CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) DESC,
            (CASE WHEN birth_date IS NOT NULL THEN 1 ELSE 0 END) DESC,
            id ASC
        ) as rn
      FROM players
    )
    SELECT d.id as dupe_id, c.id as canonical_id
    FROM ranked d
    JOIN ranked c ON c.norm_name = d.norm_name AND c.rn = 1
    WHERE d.rn > 1
  `);

  const countResult = await exec(`SELECT count(*)::int as cnt FROM _player_dedup_map`) as unknown as Array<{cnt: number}>;
  const total = countResult[0]?.cnt ?? 0;
  console.log(`Found ${total} duplicate player records to merge\n`);

  if (dryRun) {
    const sample = await exec(`
      SELECT p.name, m.dupe_id, m.canonical_id
      FROM _player_dedup_map m JOIN players p ON p.id = m.dupe_id
      LIMIT 20
    `) as unknown as Array<{name: string; dupe_id: string; canonical_id: string}>;
    sample.forEach(r => console.log(`  ${r.name}: ${r.dupe_id.slice(0,8)}… → ${r.canonical_id.slice(0,8)}…`));
    console.log("\nRun without --dry-run to apply.");
    await exec(`DROP TABLE IF EXISTS _player_dedup_map`);
    process.exit(0);
  }

  // Supabase enforces a fairly aggressive statement timeout. Dedupe can legitimately
  // take longer because Postgres must validate FK relationships (not all FKs are
  // ON DELETE CASCADE) and match_events is large.
  await exec(`SET statement_timeout = '900000'`);

  if (deleteOnly) {
    console.log("Delete-only mode: nulling match_events refs, then deleting dupes…");

    // Null match_events refs in small batches to avoid statement timeouts.
    // (No index exists on match_events.player_id, so this must be careful.)
    const ids: string[] = (await exec(
      `SELECT dupe_id FROM _player_dedup_map ORDER BY dupe_id LIMIT 5000`,
    )) as unknown as Array<{ dupe_id: string }>;

    const batchSize = 1;
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize).map((r) => `'${r.dupe_id}'`).join(",");
      await exec(`UPDATE match_events SET player_id = NULL WHERE player_id IN (${slice})`);
      console.log(`  Null match_events for ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    }

    // Delete players one-by-one to keep FK checks under the statement timeout.
    while (true) {
      const batch = await exec(
        `SELECT dupe_id FROM _player_dedup_map WHERE dupe_id IN (SELECT id FROM players) LIMIT 1`,
      ) as unknown as Array<{ dupe_id: string }>;
      if (!batch || batch.length === 0) break;
      const id = batch[0]!.dupe_id;
      await exec(`DELETE FROM players WHERE id = '${id}'`);
      console.log(`  Deleted one…`);
    }

    await exec(`DROP TABLE IF EXISTS _player_dedup_map`);
    console.log(`\n✓ Done (delete-only).`);
    process.exit(0);
  }

  // Helper: rewire FK, keeping only one row per unique-key group
  async function rewire(table: string, fkCol: string, uniqueCols?: string[]) {
    if (uniqueCols && uniqueCols.length > 0) {
      const uCols = uniqueCols.join(", ");
      // For dupe rows: keep one per (canonical_id, ...uniqueCols) and delete the rest.
      // First delete those that conflict with an existing canonical row:
      const joinCond = uniqueCols.map(c => `existing.${c} = t.${c}`).join(" AND ");
      await exec(`
        DELETE FROM ${table} t
        USING _player_dedup_map m
        WHERE t.${fkCol} = m.dupe_id
          AND EXISTS (
            SELECT 1 FROM ${table} existing
            WHERE existing.${fkCol} = m.canonical_id AND ${joinCond}
          )
      `);
      // Then deduplicate among the remaining dupe rows themselves
      // (multiple dupes of the same canonical might point to the same fixture)
      await exec(`
        DELETE FROM ${table}
        WHERE id IN (
          SELECT id FROM (
            SELECT t.id, ROW_NUMBER() OVER (PARTITION BY m.canonical_id, ${uniqueCols.map(c => "t." + c).join(", ")} ORDER BY t.id) as rn
            FROM ${table} t
            JOIN _player_dedup_map m ON t.${fkCol} = m.dupe_id
          ) sub WHERE sub.rn > 1
        )
      `);
    }
    await exec(`
      UPDATE ${table} t SET ${fkCol} = m.canonical_id
      FROM _player_dedup_map m
      WHERE t.${fkCol} = m.dupe_id
    `);
  }

  console.log("Rewiring fixture_players…");
  await rewire("fixture_players", "player_id", ["fixture_id"]);

  console.log("Rewiring match_events…");
  await exec(`UPDATE match_events t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`);

  console.log("Rewiring player_transfers…");
  await exec(`UPDATE player_transfers t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`);

  console.log("Rewiring player_career_stints…");
  await rewire("player_career_stints", "player_id", ["career_type", "years_label", "team_name"]);

  console.log("Rewiring player_team_memberships…");
  await rewire("player_team_memberships", "player_id", ["team_id", "season_id"]);

  console.log("Rewiring player_match_performance_stats…");
  await rewire("player_match_performance_stats", "player_id", ["fixture_id"]);

  console.log("Rewiring player_season_stats…");
  await rewire("player_season_stats", "player_id", ["season_id", "team_id"]);

  console.log("Rewiring player_match_ratings…");
  await rewire("player_match_ratings", "player_id", ["fixture_id"]);

  console.log("Rewiring player_selection_trends…");
  await rewire("player_selection_trends", "player_id", ["fixture_id"]);

  async function rewireSingletonPK(table: string) {
    // Delete dupe rows where canonical already has an entry
    await exec(`DELETE FROM ${table} t USING _player_dedup_map m WHERE t.player_id = m.dupe_id AND EXISTS (SELECT 1 FROM ${table} r2 WHERE r2.player_id = m.canonical_id)`);
    // Among remaining dupe rows for same canonical, keep only one (using DISTINCT ON)
    await exec(`
      DELETE FROM ${table} WHERE player_id IN (SELECT dupe_id FROM _player_dedup_map)
        AND player_id NOT IN (
          SELECT DISTINCT ON (m.canonical_id) m.dupe_id
          FROM _player_dedup_map m
          JOIN ${table} t ON t.player_id = m.dupe_id
          ORDER BY m.canonical_id, m.dupe_id
        )
    `);
    await exec(`UPDATE ${table} t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`);
  }

  console.log("Rewiring player_ratings…");
  await rewireSingletonPK("player_ratings");

  console.log("Rewiring player_bio_profiles…");
  await rewireSingletonPK("player_bio_profiles");

  console.log("Rewiring remaining FK tables…");
  for (const table of [
    "player_bio_suggestions", "player_bio_history", "player_profile_verification_reports",
    "player_injuries", "player_suspensions", "player_external_matches", "player_legends",
    "player_image_learning_rules",
  ]) {
    await exec(`UPDATE ${table} t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`);
  }

  console.log("Rewiring player_images…");
  await rewire("player_images", "player_id", ["image_url"]);

  console.log("Deleting player_radar_caches for dupes…");
  await exec(`DELETE FROM player_radar_caches t USING _player_dedup_map m WHERE t.player_id = m.dupe_id`);

  console.log("Rewiring provider_entity_mappings…");
  await exec(`UPDATE provider_entity_mappings t SET rugby365_id = m.canonical_id FROM _player_dedup_map m WHERE t.entity_type = 'player' AND t.rugby365_id = m.dupe_id`);

  console.log("Rewiring fixtures POTM references…");
  await exec(`UPDATE fixtures t SET rugby365_potm_player_id = m.canonical_id FROM _player_dedup_map m WHERE t.rugby365_potm_player_id = m.dupe_id`);
  await exec(`UPDATE fixtures t SET official_potm_player_id = m.canonical_id FROM _player_dedup_map m WHERE t.official_potm_player_id = m.dupe_id`);

  console.log("Rewiring team_of_week_awards…");
  await exec(`UPDATE team_of_week_awards t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`);

  console.log("Rewiring legend_collection_members…");
  await rewire("legend_collection_members", "player_id", ["collection_id"]);

  console.log("Clearing unique constraints on dupes…");
  await exec(`UPDATE players SET external_provider_id = NULL, rugbypass_player_id = NULL, rugbypass_slug = NULL WHERE id IN (SELECT dupe_id FROM _player_dedup_map)`);

  // The FK check from match_events is the main bottleneck. We need an index or to null out refs.
  console.log("Ensuring no match_events reference dupe players…");
  await exec(`UPDATE match_events SET player_id = NULL WHERE player_id IN (SELECT dupe_id FROM _player_dedup_map)`);

  // Also ensure no other table still references these players
  console.log("Ensuring no fixture_players reference dupe players…");
  await exec(`DELETE FROM fixture_players WHERE player_id IN (SELECT dupe_id FROM _player_dedup_map)`);

  console.log("Deleting duplicate players (in batches of 25)…");
  let deletedSoFar = 0;
  while (true) {
    // Get a small batch of IDs explicitly to avoid complex subqueries
    const batch = await exec(`SELECT dupe_id FROM _player_dedup_map WHERE dupe_id IN (SELECT id FROM players) LIMIT 1`) as unknown as Array<{dupe_id: string}>;
    if (!batch || batch.length === 0) break;
    const ids = batch.map(r => `'${r.dupe_id}'`).join(",");
    await exec(`DELETE FROM players WHERE id IN (${ids})`);
    deletedSoFar += batch.length;
    console.log(`  Deleted ${deletedSoFar}/${total}`);
  }

  await exec(`DROP TABLE IF EXISTS _player_dedup_map`);

  console.log(`\n✓ Done. Removed ${total} duplicate player records.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
