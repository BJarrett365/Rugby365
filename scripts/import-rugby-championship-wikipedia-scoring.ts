/**
 * Import Wikipedia Rugby Championship scoring (try/points tables + rugbybox events).
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-championship-wikipedia-scoring.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-championship-wikipedia-scoring.ts --from=2012 --to=2022
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
  const toArg = process.argv.find((arg) => arg.startsWith("--to="));
  const fromYear = fromArg ? Number.parseInt(fromArg.split("=")[1]!, 10) : 2012;
  const toYear = toArg ? Number.parseInt(toArg.split("=")[1]!, 10) : 2022;

  const { importRugbyChampionshipWikipediaScoringRange } = await import(
    "../apps/web/src/lib/rugby-championship-wikipedia-scoring-import-service"
  );
  const results = await importRugbyChampionshipWikipediaScoringRange(fromYear, toYear);
  for (const row of results) {
    console.log(
      `${row.year} ${row.pageTitle}: fixtures=${row.fixturesMatched} events=${row.eventsInserted} stats=${row.seasonStatsUpserted} unmatched=${row.unmatchedBoxes}`,
    );
    if (row.warnings.length) {
      for (const warning of row.warnings.slice(0, 8)) console.log("  warn:", warning);
      if (row.warnings.length > 8) console.log(`  … ${row.warnings.length - 8} more warnings`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
