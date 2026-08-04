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

const REPAIRS = [
  {
    label: "referees.birth_date",
    checkSql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'referees' AND column_name = 'birth_date'
      LIMIT 1
    `,
    files: [
      "packages/db/drizzle/0023_person_intelligence.sql",
      "packages/db/drizzle/0024_player_bio_variants.sql",
    ],
  },
  {
    label: "fixtures.home_try_bonus_points",
    checkSql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'fixtures' AND column_name = 'home_try_bonus_points'
      LIMIT 1
    `,
    files: ["packages/db/drizzle/0047_fixture_bonus_points.sql"],
  },
];

/** Newer migrations that are safe to re-apply via IF NOT EXISTS / catch duplicates. */
const REPLAY_FILES = [
  "packages/db/drizzle/0057_player_university.sql",
  "packages/db/drizzle/0063_audio_commentary.sql",
  "packages/db/drizzle/0064_audio_voice_settings.sql",
];

async function columnPresent(sql, checkSql) {
  const [row] = await sql.unsafe(checkSql);
  return Boolean(row);
}

async function applyFile(sql, rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log(`[db] Skip missing ${path.basename(file)}`);
    return;
  }
  const content = fs.readFileSync(file, "utf8");
  try {
    await sql.unsafe(content);
    console.log(`[db] Applied ${path.basename(file)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|duplicate/i.test(message)) {
      console.log(`[db] OK (already present) ${path.basename(file)}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    let applied = 0;
    for (const repair of REPAIRS) {
      if (await columnPresent(sql, repair.checkSql)) {
        console.log(`[db] Schema repair not needed (${repair.label} present).`);
        continue;
      }

      console.log(`[db] Applying schema repair for ${repair.label}…`);
      for (const rel of repair.files) {
        await applyFile(sql, rel);
      }
      applied++;
    }

    console.log("[db] Replaying newer schema repair migrations (IF NOT EXISTS)…");
    for (const rel of REPLAY_FILES) {
      await applyFile(sql, rel);
    }

    if (applied === 0) {
      console.log("[db] Schema repair complete — check-based groups nothing to apply.");
    } else {
      console.log(`[db] Schema repair complete (${applied} check-based repair group(s) applied).`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(`[db] Schema repair failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
