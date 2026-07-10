/**
 * Bulk import Gallagher Premiership seasons from LiveSport (Flashscore feed).
 *
 * Usage:
 *   npx tsx scripts/import-premiership-seasons.ts
 *   npx tsx scripts/import-premiership-seasons.ts --from=2020
 *   npx tsx scripts/import-premiership-seasons.ts --year=2024
 */
import { buildLiveSportSeasonPathSlug } from "@rugby365/import-sdk";
import { importFromLiveSportTournamentUrl } from "../apps/web/src/lib/livesport-import-service";
import { PREMIERSHIP_CHAMPIONS } from "../apps/web/src/lib/competition-champions-catalog";

const LIVESPORT_BASE = "https://www.livesport.com/uk/rugby-union/england";
const COMPETITION_SLUG = "premiership-rugby";

const args = process.argv.slice(2);
const fromYear = Number.parseInt(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "2008", 10);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1];

const seasons = PREMIERSHIP_CHAMPIONS.filter((entry) => {
  if (onlyYear) return String(entry.startYear) === onlyYear;
  return entry.startYear >= fromYear;
}).sort((a, b) => a.startYear - b.startYear);

function seasonUrl(startYear: number): string {
  const pathSlug = buildLiveSportSeasonPathSlug(COMPETITION_SLUG, String(startYear));
  return `${LIVESPORT_BASE}/${pathSlug}/`;
}

async function main() {
  if (!seasons.length) {
    console.error("No Premiership seasons matched the filter.");
    process.exit(1);
  }

  console.log(`Importing ${seasons.length} Premiership season(s) from LiveSport…\n`);

  for (const season of seasons) {
    const url = seasonUrl(season.startYear);
    const started = Date.now();
    console.log(`→ ${season.label} (${season.winner})`);
    console.log(`  ${url}`);
    try {
      const result = await importFromLiveSportTournamentUrl(url, {
        seasonLabel: String(season.startYear),
        importFixtures: true,
        importResults: true,
        syncStandings: true,
        onProgress: (event) => {
          if (event.phase === "matches" && event.matchesProcessed && event.matchesTotal) {
            if (event.matchesProcessed % 25 === 0 || event.matchesProcessed === event.matchesTotal) {
              process.stdout.write(`  … ${event.matchesProcessed}/${event.matchesTotal} matches\r`);
            }
          }
        },
      });
      console.log(
        `  ✓ ${result.created} created, ${result.updated} updated, ${result.standingsRows} table rows (${Math.round((Date.now() - started) / 1000)}s)`,
      );
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
