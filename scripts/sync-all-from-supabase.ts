/**
 * Pull all mapped tables from Supabase into local Postgres.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-all-from-supabase.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-all-from-supabase.ts --tables=teams,players,fixtures
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnv();
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const { syncAllDataFromSupabase } = await import(
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
      ? `Pulling selected tables from Supabase: ${tables.join(", ")}`
      : "Pulling all mapped tables from Supabase → local Postgres…",
  );

  const result = await syncAllDataFromSupabase({
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
          remoteCount: t.localCount,
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
