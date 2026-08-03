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
  "packages/db/drizzle/0057_player_university.sql",
  "packages/db/drizzle/0063_audio_commentary.sql",
  "packages/db/drizzle/0064_audio_voice_settings.sql",
];

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    // Idempotent replay for migrations that were recorded but not fully applied.
    console.log("[db] Applying schema repair migrations (IF NOT EXISTS)…");
    for (const rel of REPAIR_FILES) {
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) {
        console.log(`[db] Skip missing ${path.basename(file)}`);
        continue;
      }
      const content = fs.readFileSync(file, "utf8");
      try {
        await sql.unsafe(content);
        console.log(`[db] Applied ${path.basename(file)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already exists|duplicate/i.test(message)) {
          console.log(`[db] OK (already present) ${path.basename(file)}`);
          continue;
        }
        throw error;
      }
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
