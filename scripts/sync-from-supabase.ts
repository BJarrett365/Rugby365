/**
 * Pull all rows from Supabase (SOURCE) into local Postgres (TARGET).
 * Inserts by primary key; skips rows that violate unique slug/email constraints.
 *
 * Usage:
 *   npm run sync:supabase
 *   npm run sync:supabase -- --dry-run
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

/** FK-safe load order. */
const TABLES = [
  "sports",
  "competitions",
  "teams",
  "venues",
  "referees",
  "coaches",
  "competition_seasons",
  "standing_rows",
  "fixtures",
  "players",
  "player_career_stints",
  "player_transfers",
  "player_team_memberships",
  "team_coaching_staff",
  "fixture_players",
  "match_events",
  "player_season_stats",
  "player_match_performance_stats",
  "team_match_stats",
  "world_ranking_snapshots",
  "world_ranking_rows",
  "provider_raw_responses",
  "provider_entity_mappings",
  "integration_settings",
];

const sourceUrl =
  process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const targetUrl =
  process.env.TARGET_DATABASE_URL ??
  "postgresql://rugby365:rugby365@localhost:5433/rugby365";

if (!sourceUrl) {
  console.error("Set SOURCE_DATABASE_URL or DATABASE_URL.");
  process.exit(1);
}

const sourceSsl = sourceUrl.includes("supabase") ? "require" : false;

async function tableExists(sql: postgres.Sql, table: string): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ${table}
    ) as exists
  `;
  return Boolean(row?.exists);
}

async function columnNames(sql: postgres.Sql, table: string): Promise<string[]> {
  const rows = await sql<{ column_name: string }[]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position
  `;
  return rows.map((r) => r.column_name);
}

async function syncTable(
  source: postgres.Sql,
  target: postgres.Sql,
  table: string,
): Promise<{ inserted: number; skipped: number; total: number }> {
  if (!(await tableExists(source, table))) {
    console.log(`  skip ${table} (not on source)`);
    return { inserted: 0, skipped: 0, total: 0 };
  }
  if (!(await tableExists(target, table))) {
    console.log(`  skip ${table} (not on target)`);
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const sourceCols = await columnNames(source, table);
  const targetCols = new Set(await columnNames(target, table));
  const cols = sourceCols.filter((c) => targetCols.has(c));
  const omitted = sourceCols.filter((c) => !targetCols.has(c));
  if (omitted.length) {
    console.log(`  ${table}: omitting ${omitted.length} column(s) missing on target`);
  }
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const rows = await source.unsafe(`select ${colList} from "${table}"`);
  const total = rows.length;

  if (!total) {
    console.log(`  ${table}: 0 rows on source`);
    return { inserted: 0, skipped: 0, total: 0 };
  }

  if (dryRun) {
    const [targetCount] = await target.unsafe(`select count(*)::int as n from "${table}"`);
    console.log(`  ${table}: would sync ${total} rows (target has ${targetCount.n})`);
    return { inserted: total, skipped: 0, total };
  }

  const updateSet = cols
    .filter((c) => c !== "id")
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");

  let inserted = 0;
  let skipped = 0;
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    for (const row of batch) {
      const values = cols.map((c) => row[c]);
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
      try {
        await target.unsafe(
          `insert into "${table}" (${colList}) values (${placeholders})
           on conflict (id) do update set ${updateSet}`,
          values,
        );
        inserted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("unique constraint") ||
          message.includes("duplicate key") ||
          message.includes("foreign key")
        ) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }
    if ((i + batchSize) % 5000 === 0 || i + batchSize >= rows.length) {
      process.stdout.write(`\r  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }
  }
  if (total > 500) process.stdout.write("\n");
  console.log(`  ${table}: synced ${inserted}/${total} (${skipped} skipped)`);
  return { inserted, skipped, total };
}

async function main() {
  console.log("Source:", sourceUrl.replace(/:[^:@]+@/, ":***@"));
  console.log("Target:", targetUrl.replace(/:[^:@]+@/, ":***@"));
  if (dryRun) console.log("(dry run)\n");

  const source = postgres(sourceUrl, { max: 1, ssl: sourceSsl });
  const target = postgres(targetUrl, { max: 1 });

  try {
    if (!dryRun) {
      await target.unsafe("SET session_replication_role = replica");
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const table of TABLES) {
      const result = await syncTable(source, target, table);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
    }

    if (!dryRun) {
      await target.unsafe("SET session_replication_role = DEFAULT");
    }

    console.log(`\nSync complete: ${totalInserted} rows applied, ${totalSkipped} skipped.`);
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
