/**
 * Import Planet Rugby / SDMS player performance stats for Rugby Championship seasons.
 * Matches existing CMS fixtures by date + teams (LiveSport/Wikipedia ids).
 *
 * SDMS only lists this competition from 2021 onward — 2012–2020 have scoring
 * from Wikipedia match sheets, not Opta tackle/metre/carry feeds.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-championship-sdms-player-stats.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-championship-sdms-player-stats.ts --from=2021 --to=2022
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
  const toArg = process.argv.find((arg) => arg.startsWith("--to="));
  const fromYear = fromArg ? Number.parseInt(fromArg.split("=")[1]!, 10) : 2021;
  const toYear = toArg ? Number.parseInt(toArg.split("=")[1]!, 10) : 2022;

  const { importRugbyChampionshipSdmsPlayerStatsRange } = await import(
    "../apps/web/src/lib/rugby-championship-sdms-player-stats-import-service"
  );
  const results = await importRugbyChampionshipSdmsPlayerStatsRange(fromYear, toYear);
  for (const row of results) {
    console.log(
      `${row.year}: sdms=${row.sdmsMatches} matched=${row.fixturesMatched} players=${row.playersImported} unmatched=${row.unmatched.length} errors=${row.errors.length}`,
    );
    for (const warning of row.unmatched.slice(0, 8)) console.log("  unmatched:", warning);
    for (const error of row.errors.slice(0, 8)) console.log("  error:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
