/**
 * Bootstrap local Rugby365 data for development and Rugby Data improvement work.
 *
 * 1. Migrate + repair schema
 * 2. Seed demo data
 * 3. Capture Rugby Data API samples (docs + provider_raw_responses)
 * 4. Import Planet Rugby competitions + SDMS fixtures for rest of year
 * 5. Sync Rugby Data scores/events onto imported fixtures
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/bootstrap-project-data.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/bootstrap-project-data.ts --skip-imports
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { syncRugbyDataFixturesForDate } from "../apps/web/src/lib/rugby-data-day-sync-service";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipImports = args.includes("--skip-imports");

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", env: process.env });
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function printCounts() {
  const url = process.env.DATABASE_URL ?? "postgresql://rugby365:rugby365@localhost:5433/rugby365";
  const sql = postgres(url, { max: 1 });
  const tables = [
    "teams",
    "players",
    "fixtures",
    "competitions",
    "competition_seasons",
    "standing_rows",
    "match_events",
    "fixture_players",
    "provider_raw_responses",
    "provider_entity_mappings",
  ];

  console.log("\n=== Database summary ===");
  for (const table of tables) {
    try {
      const [row] = await sql.unsafe(`select count(*)::int as n from ${table}`);
      console.log(`${table.padEnd(28)} ${row.n}`);
    } catch {
      console.log(`${table.padEnd(28)} n/a`);
    }
  }
  await sql.end();
}

async function syncRecentRugbyData() {
  const today = new Date().toISOString().slice(0, 10);
  console.log("\n=== Rugby Data day sync (±14 days) ===\n");
  for (let offset = -14; offset <= 14; offset++) {
    const dateKey = addDays(today, offset);
    try {
      const result = await syncRugbyDataFixturesForDate(dateKey, { syncEvents: true });
      console.log(
        `${dateKey}: listed=${result.listed} matched=${result.matched} scores=${result.scoresUpdated} events=${result.eventsImported}`,
      );
    } catch (error) {
      console.error(
        `${dateKey}: failed`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

async function main() {
  console.log("Bootstrapping Rugby365 project data…");

  run("npm run db:migrate");
  run("node scripts/repair-db-schema.mjs");
  run("npm run db:seed");

  run(
    "npx tsx --require ./scripts/stub-server-only.cjs scripts/capture-rugby-data-to-project.ts",
  );

  if (!skipImports) {
    run(
      "npx tsx --require ./scripts/stub-server-only.cjs scripts/import-fixtures-rest-of-year.ts",
    );
    await syncRecentRugbyData();
  } else {
    console.log("\nSkipped Planet Rugby / SDMS imports (--skip-imports).");
  }

  await printCounts();
  console.log("\nBootstrap complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
