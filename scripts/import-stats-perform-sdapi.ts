/**
 * Import Stats Perform Rugby Union SDAPI squads + sample match stats into local Postgres.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-stats-perform-sdapi.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-stats-perform-sdapi.ts --no-images
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-stats-perform-sdapi.ts --no-create-players
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

const localUrl = process.env.LOCAL_DATABASE_URL?.trim();
if (localUrl) process.env.DATABASE_URL = localUrl;

const args = new Set(process.argv.slice(2));

async function main() {
  const { importStatsPerformSdapi } = await import(
    "../apps/web/src/lib/stats-perform-ingest-service"
  );

  const report = await importStatsPerformSdapi({
    fillImages: !args.has("--no-images"),
    createMissingPlayers: !args.has("--no-create-players"),
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
