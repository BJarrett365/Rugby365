#!/usr/bin/env node
/**
 * Idempotent repair for migrations that were recorded but not fully applied.
 * Safe to run after `npm run db:migrate`.
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const url = process.env.DATABASE_URL ?? "postgresql://rugby365:rugby365@localhost:5433/rugby365";

const REPAIR_FILES = [
  "packages/db/drizzle/0023_person_intelligence.sql",
  "packages/db/drizzle/0024_player_bio_variants.sql",
];

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    const [row] = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'referees' AND column_name = 'birth_date'
      LIMIT 1
    `;
    if (row) {
      console.log("[db] Schema repair not needed (referees.birth_date present).");
      return;
    }

    console.log("[db] Applying schema repair migrations…");
    for (const rel of REPAIR_FILES) {
      const file = path.join(ROOT, rel);
      const content = fs.readFileSync(file, "utf8");
      await sql.unsafe(content);
      console.log(`[db] Applied ${path.basename(file)}`);
    }
    console.log("[db] Schema repair complete.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(`[db] Schema repair failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
