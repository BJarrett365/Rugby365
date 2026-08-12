/**
 * Apply exported /tmp/rugby365-*-upsert.sql files to remote via Supabase SQL chunks.
 * Reads local integration_settings for project URL + service role, then uses PostgREST-less raw SQL over HTTPS.
 *
 * Prefer: npx tsx scripts/apply-exported-upserts-via-postgres.ts /tmp/rugby365-coach_rating_history-upsert.sql
 *
 * Requires REMOTE_DATABASE_URL (Supabase direct connection) in env — never commit.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: apply-exported-upserts-via-postgres.ts <sql-file>");
  process.exit(1);
}

const remoteUrl = process.env.REMOTE_DATABASE_URL;
if (!remoteUrl) {
  console.error("Set REMOTE_DATABASE_URL to the Supabase Postgres connection string.");
  process.exit(1);
}

async function main() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(remoteUrl, { max: 1, ssl: "require" });
  const raw = readFileSync(file, "utf8");
  const statements = raw
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const statement of statements) {
    await sql.unsafe(statement.endsWith(";") ? statement : `${statement};`);
    console.log("OK chunk", statement.slice(0, 60).replace(/\s+/g, " "));
  }
  await sql.end();
  console.log("Applied", file);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
