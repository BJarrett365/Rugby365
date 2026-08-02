/**
 * Bulk import Investec / Heineken Champions Cup seasons from Wikipedia.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-champions-cup-seasons.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-champions-cup-seasons.ts --year=2014
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-champions-cup-seasons.ts --from=1995
 */
import {
  championsCupWikipediaSeasonUrls,
  importWikipediaSeasonPage,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1];
const fromYear = Number.parseInt(
  args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1995",
  10,
);

async function main() {
  const seasons = championsCupWikipediaSeasonUrls()
    .filter((s) => {
      if (onlyYear) return String(s.startYear) === onlyYear;
      return s.startYear >= fromYear;
    })
    .sort((a, b) => a.startYear - b.startYear);

  if (!seasons.length) {
    console.error("No seasons matched.");
    process.exit(1);
  }

  console.log(`Importing ${seasons.length} Champions Cup season(s) from Wikipedia…\n`);

  let ok = 0;
  let fail = 0;

  for (const [index, season] of seasons.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, 8000));
    const started = Date.now();
    console.log(`→ ${season.startYear} (${season.winner})`);
    console.log(`  ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: "rugby-champions-cup",
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found} teams) fixtures ${report.fixtures.created}c/${report.fixtures.updated}u playoffs ${report.playoffs.created}c/${report.playoffs.updated}u champion=${report.championName} (${Math.round((Date.now() - started) / 1000)}s)`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped: ${report.unmappedTeams.slice(0, 12).join(", ")}`);
      }
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 4)) console.log(`  ! ${w}`);
      }
      ok += 1;
    } catch (error) {
      fail += 1;
      console.warn(`  ✗ ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\nDone. ${ok} ok · ${fail} failed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
