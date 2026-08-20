/**
 * Apply pending Drizzle SQL migrations to a remote Postgres database.
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/apply-remote-drizzle-migrations.ts
 *   DATABASE_URL=... npx tsx scripts/apply-remote-drizzle-migrations.ts --from=0068
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import postgres from "postgres";

const ROOT = resolve(import.meta.dirname, "..");
const DRIZZLE_DIR = join(ROOT, "packages/db/drizzle");

function splitStatements(raw: string): string[] {
  return raw
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureMigrationTable(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);
}

async function appliedTags(sql: ReturnType<typeof postgres>): Promise<Set<string>> {
  const rows = await sql<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at
  `;
  return new Set(rows.map((r) => r.hash));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const fromArg = process.argv.find((a) => a.startsWith("--from="))?.slice("--from=".length);
  const sql = postgres(url, { max: 1 });

  try {
    await ensureMigrationTable(sql);
    const done = await appliedTags(sql);

    const files = readdirSync(DRIZZLE_DIR)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();

    for (const file of files) {
      const tag = file.replace(/\.sql$/, "");
      const seq = Number(tag.slice(0, 4));
      if (fromArg && seq < Number(fromArg)) continue;
      if (done.has(tag)) {
        console.log(`skip ${tag} (already applied)`);
        continue;
      }

      console.log(`\n==> applying ${file}`);
      const raw = readFileSync(join(DRIZZLE_DIR, file), "utf8");
      const statements = splitStatements(raw);
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${tag}, ${Date.now()})
      `;
      console.log(`applied ${tag}`);
    }

    console.log("\nRemote Drizzle migrations complete.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
