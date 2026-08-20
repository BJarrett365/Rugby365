import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL ?? "postgresql://rugby365:rugby365@localhost:5433/rugby365";
const sql = postgres(url, { max: 1 });

const raw = readFileSync(join(__dirname, "../drizzle/0068_coach_platform.sql"), "utf8");
const statements = raw
  .split(/-->\s*statement-breakpoint/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await sql.unsafe(statement);
    console.log("OK:", statement.slice(0, 70).replace(/\s+/g, " "));
  } catch (e) {
    console.error("FAIL:", statement.slice(0, 90).replace(/\s+/g, " "));
    console.error(String(e));
  }
}

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'coaches' AND column_name IN ('known_as','publish_status','is_public')
  ORDER BY 1`;
console.log("columns", cols);

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND (
    table_name LIKE 'coach_%' OR table_name = 'coaches'
  )
  ORDER BY 1`;
console.log("tables", tables.map((t) => t.table_name));

await sql.end();
