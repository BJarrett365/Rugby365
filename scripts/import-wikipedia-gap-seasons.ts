/**
 * Re-import specific Wikipedia season gaps (Currie Cup + Challenge Cup years
 * that have URLs but missing standings tables).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-gap-seasons.ts
 */
import {
  challengeCupWikipediaSeasonUrls,
  currieCupWikipediaSeasonUrls,
  importWikipediaSeasonPage,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const CURRIE_GAP_YEARS = [1982, 1983, 1984, 1985, 2000, 2001, 2006, 2007];
const CHALLENGE_GAP_YEARS = [2003, 2004];

async function importYears(
  label: string,
  competitionSlug: string,
  years: number[],
  catalog: Array<{ startYear: number; url: string; winner?: string }>,
) {
  const byYear = new Map(catalog.map((row) => [row.startYear, row]));
  console.log(`\n=== ${label}: ${years.length} season(s) ===\n`);
  let ok = 0;
  let fail = 0;

  for (const [index, year] of years.entries()) {
    const entry = byYear.get(year);
    if (!entry) {
      console.log(`→ ${year} — no catalog URL`);
      fail += 1;
      continue;
    }
    if (index > 0) await new Promise((r) => setTimeout(r, 2500));
    console.log(`→ ${year} ${entry.winner ? `(${entry.winner})` : ""}`);
    console.log(`  ${entry.url}`);
    try {
      const report = await importWikipediaSeasonPage(entry.url, {
        competitionSlug,
        seasonStartYear: year,
        mode: "update_existing",
        createMissingTeams: true,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u  fixtures ${report.fixtures.created}c/${report.fixtures.updated}u  warnings=${report.warnings.length}`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped: ${report.unmappedTeams.slice(0, 8).join(", ")}`);
      }
      ok += 1;
    } catch (error) {
      fail += 1;
      console.warn(`  ✗ ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`${label}: ${ok} ok · ${fail} failed`);
}

async function main() {
  await importYears(
    "Currie Cup gaps",
    "currie-cup",
    CURRIE_GAP_YEARS,
    currieCupWikipediaSeasonUrls(),
  );
  await importYears(
    "Challenge Cup gaps",
    "challenge-cup",
    CHALLENGE_GAP_YEARS,
    challengeCupWikipediaSeasonUrls(),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
