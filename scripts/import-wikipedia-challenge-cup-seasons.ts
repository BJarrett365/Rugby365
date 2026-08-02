/**
 * Bulk import Challenge Cup seasons from Wikipedia.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-challenge-cup-seasons.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-challenge-cup-seasons.ts --year=1996
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-challenge-cup-seasons.ts --from=2014
 */
import {
  challengeCupWikipediaSeasonUrls,
  importWikipediaSeasonPage,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1];
const fromYear = Number.parseInt(
  args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1996",
  10,
);

async function main() {
  const seasons = challengeCupWikipediaSeasonUrls()
    .filter((s) => {
      if (onlyYear) return String(s.startYear) === onlyYear;
      return s.startYear >= fromYear;
    })
    .sort((a, b) => a.startYear - b.startYear);

  if (!seasons.length) {
    console.error("No seasons matched.");
    process.exit(1);
  }

  console.log(`Importing ${seasons.length} Challenge Cup season(s) from Wikipedia…\n`);

  const summary: Array<{
    year: number;
    winner: string;
    table: string;
    fixtures: string;
    playoffs: string;
    warnings: number;
    unmapped: number;
  }> = [];

  for (const [index, season] of seasons.entries()) {
    if (index > 0) {
      await new Promise((r) => setTimeout(r, 3000));
    }
    const started = Date.now();
    console.log(`→ ${season.startYear} (${season.winner})`);
    console.log(`  ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: "challenge-cup",
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: false,
        importPlayoffs: false,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found} teams) champion=${report.championName} (${Math.round((Date.now() - started) / 1000)}s)`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped teams: ${report.unmappedTeams.join(", ")}`);
      }
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 5)) console.log(`  ! ${w}`);
        if (report.warnings.length > 5) console.log(`  ! …${report.warnings.length - 5} more warnings`);
      }
      summary.push({
        year: season.startYear,
        winner: report.championName ?? season.winner,
        table: `${report.table.created}/${report.table.updated}/${report.table.skipped}`,
        fixtures: `${report.fixtures.created}/${report.fixtures.updated}/${report.fixtures.errors}`,
        playoffs: `${report.playoffs.created}/${report.playoffs.updated}/${report.playoffs.errors}`,
        warnings: report.warnings.length,
        unmapped: report.unmappedTeams.length,
      });
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
      summary.push({
        year: season.startYear,
        winner: season.winner,
        table: "ERR",
        fixtures: "ERR",
        playoffs: "ERR",
        warnings: 1,
        unmapped: 0,
      });
    }
    console.log("");
  }

  console.log("## Summary (created/updated/skipped-or-errors)");
  console.log("| Year | Winner | Table | Fixtures | Playoffs | Warn | Unmapped |");
  console.log("| ---- | ------ | ----- | -------- | -------- | ---- | -------- |");
  for (const row of summary) {
    console.log(
      `| ${row.year} | ${row.winner} | ${row.table} | ${row.fixtures} | ${row.playoffs} | ${row.warnings} | ${row.unmapped} |`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
