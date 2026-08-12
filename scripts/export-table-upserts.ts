/**
 * Export local table rows as batched UPSERT SQL for remote execution.
 * Usage:
 *   npx tsx scripts/export-table-upserts.ts coach_rating_history
 *   npx tsx scripts/export-table-upserts.ts player_rating_history --limit=500
 */
import { writeFileSync } from "node:fs";
import postgres from "postgres";

const table = process.argv[2];
if (!table) {
  console.error("Usage: export-table-upserts.ts <table> [--limit=N]");
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
  console.error("Invalid table name");
  process.exit(1);
}

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "postgresql://rugby365:rugby365@localhost:5433/rugby365";
  const sql = postgres(url, { max: 1 });
  const rows = limit
    ? await sql.unsafe(`SELECT * FROM "${table}" ORDER BY 1 LIMIT ${limit}`)
    : await sql.unsafe(`SELECT * FROM "${table}" ORDER BY 1`);

  if (!rows.length) {
    console.log(`-- ${table}: 0 rows`);
    await sql.end();
    return;
  }

  const columns = Object.keys(rows[0] as Record<string, unknown>);
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const updates = columns
    .filter((c) => c !== "id")
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");

  const chunks: string[] = [];
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch
      .map((row) => {
        const r = row as Record<string, unknown>;
        return `(${columns.map((c) => sqlLiteral(r[c])).join(", ")})`;
      })
      .join(",\n");
    chunks.push(
      `INSERT INTO "${table}" (${colList}) VALUES\n${values}\nON CONFLICT (id) DO UPDATE SET ${updates};`,
    );
  }

  const out = `-- ${table}: ${rows.length} rows\n\n${chunks.join("\n\n")}\n`;
  const path = `/tmp/rugby365-${table}-upsert.sql`;
  writeFileSync(path, out);
  console.log(`Wrote ${rows.length} rows to ${path}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
