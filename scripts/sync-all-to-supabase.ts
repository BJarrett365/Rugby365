/**
 * Upsert data from local/primary Postgres into the configured Supabase project.
 *
 * Source DB (read):
 *   LOCAL_DATABASE_URL  (preferred — local Docker)
 *   else DATABASE_URL
 *
 * Destination (write):
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (Supabase JS upsert)
 *
 * Usage:
 *   set -a && source .env && set +a && npm run sync:to-supabase
 *   npm run sync:to-supabase -- --tables=teams,players,fixtures
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

const sourceUrl =
  process.env.LOCAL_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://rugby365:rugby365@localhost:5433/rugby365";

// getDb() / drizzle reads DATABASE_URL — point it at the source for this run.
process.env.DATABASE_URL = sourceUrl;

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error(
      "Supabase destination missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env",
    );
  }

  const sourceHost = (() => {
    try {
      return new URL(sourceUrl.replace(/^postgresql:/, "http:")).host;
    } catch {
      return "(source)";
    }
  })();
  const destHost = (() => {
    try {
      return new URL(process.env.SUPABASE_URL!).host;
    } catch {
      return "supabase";
    }
  })();

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

  console.log(`Sync source (Postgres): ${sourceHost}`);
  console.log(`Sync destination (Supabase API): ${destHost}`);
  console.log(
    tables?.length
      ? `Syncing selected tables: ${tables.join(", ")}`
      : "Syncing all mapped tables…",
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
