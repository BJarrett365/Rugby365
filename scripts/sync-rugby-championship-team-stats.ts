/**
 * Roll Wikipedia/match-event scoring (and any existing player Opta rows) into
 * team_match_stats for Rugby Championship seasons. Does not overwrite SDMS
 * rows — the Team Stats API merges providers per match.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-rugby-championship-team-stats.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-rugby-championship-team-stats.ts --from=2012 --to=2025
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
  const toArg = process.argv.find((arg) => arg.startsWith("--to="));
  const fromYear = fromArg ? Number.parseInt(fromArg.split("=")[1]!, 10) : 2012;
  const toYear = toArg ? Number.parseInt(toArg.split("=")[1]!, 10) : 2026;

  const { syncRugbyChampionshipTeamMatchStatsRange } = await import(
    "../apps/web/src/lib/rugby-championship-team-stats-sync-service"
  );
  const results = await syncRugbyChampionshipTeamMatchStatsRange(fromYear, toYear);
  for (const row of results) {
    console.log(
      `${row.year}: fixtures=${row.fixtures} upserted=${row.upserted} skippedIncomplete=${row.skippedIncomplete}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
