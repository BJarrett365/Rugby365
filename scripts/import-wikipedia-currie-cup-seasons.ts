/**
 * Bulk import Currie Cup seasons from Wikipedia (1968–2025).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-currie-cup-seasons.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-currie-cup-seasons.ts --year=2024
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-currie-cup-seasons.ts --from=1990
 */
import {
  currieCupWikipediaSeasonUrls,
  importWikipediaSeasonPage,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1];
const fromYear = Number.parseInt(
  args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1968",
  10,
);

async function main() {
  const seasons = currieCupWikipediaSeasonUrls()
    .filter((s) => {
      if (onlyYear) return String(s.startYear) === onlyYear;
      return s.startYear >= fromYear;
    })
    .sort((a, b) => a.startYear - b.startYear);

  if (!seasons.length) {
    console.error("No seasons matched.");
    process.exit(1);
  }

  console.log(`Importing ${seasons.length} Currie Cup season(s) from Wikipedia…\n`);

  let ok = 0;
  let fail = 0;

  for (const [index, season] of seasons.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, 2500));
    console.log(`→ ${season.startYear}`);
    console.log(`  ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: "currie-cup",
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found} teams) fixtures ${report.fixtures.created}c/${report.fixtures.updated}u champion=${report.championName}`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped: ${report.unmappedTeams.join(", ")}`);
      }
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("");
  }

  console.log(`Done: ${ok} imported, ${fail} failed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
