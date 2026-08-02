/**
 * Bulk import Rugby Championship / Tri Nations seasons from Wikipedia.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rugby-championship-seasons.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rugby-championship-seasons.ts --year=2024
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rugby-championship-seasons.ts --from=2012
 */
import {
  importWikipediaSeasonPage,
  rugbyChampionshipWikipediaSeasonUrls,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1];
const fromYear = Number.parseInt(
  args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1996",
  10,
);

async function main() {
  const seasons = rugbyChampionshipWikipediaSeasonUrls()
    .filter((s) => {
      if (onlyYear) return String(s.startYear) === onlyYear;
      return s.startYear >= fromYear;
    })
    .sort((a, b) => a.startYear - b.startYear);

  if (!seasons.length) {
    console.error("No seasons matched.");
    process.exit(1);
  }

  console.log(`Importing ${seasons.length} Rugby Championship season(s) from Wikipedia…\n`);

  for (const [index, season] of seasons.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, 2500));
    console.log(`→ ${season.startYear} (${season.winner})`);
    console.log(`  ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: "rugby-championship",
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: false,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found} teams) fixtures ${report.fixtures.created}c/${report.fixtures.updated}u champion=${report.championName}`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped: ${report.unmappedTeams.join(", ")}`);
      }
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
