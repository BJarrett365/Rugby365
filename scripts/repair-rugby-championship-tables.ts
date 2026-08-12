/**
 * Repair Rugby Championship tables across all seasons.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-rugby-championship-tables.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-rugby-championship-tables.ts --dry-run
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { repairRugbyChampionshipTables } = await import(
    "../apps/web/src/lib/repair-rugby-championship-tables-service"
  );

  const result = await repairRugbyChampionshipTables({ dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
