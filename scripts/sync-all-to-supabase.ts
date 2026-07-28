/**
 * Map all primary Postgres data into the configured Supabase project.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-all-to-supabase.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-all-to-supabase.ts --tables=teams,players,fixtures
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const { syncAllDataToSupabase } = await import(
    "../apps/web/src/lib/supabase-full-sync-service"
  );

  const tablesArg = process.argv.find((a) => a.startsWith("--tables="))?.slice("--tables=".length);
  const tables = tablesArg
    ? tablesArg
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  console.log(
    tables?.length
      ? `Syncing selected tables to Supabase: ${tables.join(", ")}`
      : "Syncing all mapped tables to Supabase…",
  );

  const result = await syncAllDataToSupabase({
    tables,
    onProgress: (row, index, total) => {
      const label = row.skipped
        ? "skip"
        : row.error
          ? `ERROR ${row.error}`
          : `${row.upserted}/${row.localCount}`;
      console.log(`[${index + 1}/${total}] ${row.table}: ${label}`);
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        totalUpserted: result.totalUpserted,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        errors: result.errors,
        tables: result.tables.map((t) => ({
          table: t.table,
          localCount: t.localCount,
          upserted: t.upserted,
          skipped: t.skipped,
          error: t.error,
        })),
      },
      null,
      2,
    ),
  );

  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
