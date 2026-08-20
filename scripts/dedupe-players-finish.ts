/**
 * Finish remaining player dedupe by temporarily dropping the slow match_events FK.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/dedupe-players-finish.ts
 */
import { createDb } from "../packages/db/src/client";
import { sql } from "drizzle-orm";

const db = createDb(process.env.DATABASE_URL);

async function exec(query: string) {
  return db.execute(sql.raw(query));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  retry ${i}/${attempts} for ${label}: ${msg.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw last;
}

async function main() {
  await exec(`SET statement_timeout = '0'`);

  console.log("Building duplicate mapping…");
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

  const countResult = (await exec(`SELECT count(*)::int as cnt FROM _player_dedup_map`)) as unknown as Array<{
    cnt: number;
  }>;
  const total = countResult[0]?.cnt ?? 0;
  console.log(`Found ${total} duplicate player records\n`);
  if (total === 0) {
    await exec(`DROP TABLE IF EXISTS _player_dedup_map`);
    console.log("Nothing to do.");
    process.exit(0);
  }

  async function rewire(table: string, fkCol: string, uniqueCols?: string[]) {
    if (uniqueCols?.length) {
      const joinCond = uniqueCols.map((c) => `existing.${c} = t.${c}`).join(" AND ");
      await exec(`
        DELETE FROM ${table} t
        USING _player_dedup_map m
        WHERE t.${fkCol} = m.dupe_id
          AND EXISTS (
            SELECT 1 FROM ${table} existing
            WHERE existing.${fkCol} = m.canonical_id AND ${joinCond}
          )
      `);
      await exec(`
        DELETE FROM ${table}
        WHERE id IN (
          SELECT id FROM (
            SELECT t.id,
              ROW_NUMBER() OVER (
                PARTITION BY m.canonical_id, ${uniqueCols.map((c) => "t." + c).join(", ")}
                ORDER BY t.id
              ) as rn
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

  async function rewireSingletonPK(table: string) {
    await exec(`
      DELETE FROM ${table} t USING _player_dedup_map m
      WHERE t.player_id = m.dupe_id
        AND EXISTS (SELECT 1 FROM ${table} r2 WHERE r2.player_id = m.canonical_id)
    `);
    await exec(`
      DELETE FROM ${table} WHERE player_id IN (SELECT dupe_id FROM _player_dedup_map)
        AND player_id NOT IN (
          SELECT DISTINCT ON (m.canonical_id) m.dupe_id
          FROM _player_dedup_map m
          JOIN ${table} t ON t.player_id = m.dupe_id
          ORDER BY m.canonical_id, m.dupe_id
        )
    `);
    await exec(`
      UPDATE ${table} t SET player_id = m.canonical_id
      FROM _player_dedup_map m WHERE t.player_id = m.dupe_id
    `);
  }

  console.log("Dropping slow match_events FK temporarily…");
  await withRetry("drop FK", () =>
    exec(`ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_player_id_players_id_fk`),
  );

  console.log("Rewiring FK references…");
  await rewire("fixture_players", "player_id", ["fixture_id"]);
  await withRetry("rewire match_events", () =>
    exec(
      `UPDATE match_events t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`,
    ),
  );
  await exec(
    `UPDATE player_transfers t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`,
  );
  await rewire("player_career_stints", "player_id", ["career_type", "years_label", "team_name"]);
  await rewire("player_team_memberships", "player_id", ["team_id", "season_id"]);
  await rewire("player_match_performance_stats", "player_id", ["fixture_id"]);
  await rewire("player_season_stats", "player_id", ["season_id", "team_id"]);
  await rewire("player_match_ratings", "player_id", ["fixture_id"]);
  await rewire("player_selection_trends", "player_id", ["fixture_id"]);
  await rewireSingletonPK("player_ratings");
  await rewireSingletonPK("player_bio_profiles");
  for (const table of [
    "player_bio_suggestions",
    "player_bio_history",
    "player_profile_verification_reports",
    "player_injuries",
    "player_suspensions",
    "player_external_matches",
    "player_legends",
    "player_image_learning_rules",
  ]) {
    await exec(
      `UPDATE ${table} t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`,
    );
  }
  await rewire("player_images", "player_id", ["image_url"]);
  await exec(`DELETE FROM player_radar_caches t USING _player_dedup_map m WHERE t.player_id = m.dupe_id`);
  await exec(
    `UPDATE provider_entity_mappings t SET rugby365_id = m.canonical_id FROM _player_dedup_map m WHERE t.entity_type = 'player' AND t.rugby365_id = m.dupe_id`,
  );
  await exec(
    `UPDATE fixtures t SET rugby365_potm_player_id = m.canonical_id FROM _player_dedup_map m WHERE t.rugby365_potm_player_id = m.dupe_id`,
  );
  await exec(
    `UPDATE fixtures t SET official_potm_player_id = m.canonical_id FROM _player_dedup_map m WHERE t.official_potm_player_id = m.dupe_id`,
  );
  await exec(
    `UPDATE team_of_week_awards t SET player_id = m.canonical_id FROM _player_dedup_map m WHERE t.player_id = m.dupe_id`,
  );
  await rewire("legend_collection_members", "player_id", ["collection_id"]);
  await exec(
    `UPDATE players SET external_provider_id = NULL, rugbypass_player_id = NULL, rugbypass_slug = NULL WHERE id IN (SELECT dupe_id FROM _player_dedup_map)`,
  );

  console.log("Deleting duplicate players…");
  let deleted = 0;
  while (true) {
    const batch = (await exec(
      `SELECT dupe_id FROM _player_dedup_map WHERE dupe_id IN (SELECT id FROM players) LIMIT 50`,
    )) as unknown as Array<{ dupe_id: string }>;
    if (!batch?.length) break;
    const ids = batch.map((r) => `'${r.dupe_id}'`).join(",");
    await withRetry(`delete batch ${deleted}`, () => exec(`DELETE FROM players WHERE id IN (${ids})`));
    deleted += batch.length;
    console.log(`  Deleted ${deleted}/${total}`);
  }

  console.log("Creating index + restoring match_events FK…");
  await withRetry("create index", () =>
    exec(`CREATE INDEX IF NOT EXISTS match_events_player_id_idx ON match_events (player_id)`),
  );
  await withRetry("restore FK", () =>
    exec(`
      ALTER TABLE match_events
      ADD CONSTRAINT match_events_player_id_players_id_fk
      FOREIGN KEY (player_id) REFERENCES players(id)
    `),
  );

  await exec(`DROP TABLE IF EXISTS _player_dedup_map`);

  const remaining = (await exec(`
    SELECT count(*)::int as groups FROM (
      SELECT 1 FROM players GROUP BY lower(trim(name)) HAVING count(*) > 1
    ) s
  `)) as unknown as Array<{ groups: number }>;

  console.log(`\n✓ Done. Removed ${deleted} duplicates. Remaining name-dupe groups: ${remaining[0]?.groups ?? "?"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
