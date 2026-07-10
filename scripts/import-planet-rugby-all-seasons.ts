/**
 * Bulk import all SDMS seasons for Planet Rugby league presets.
 *
 * Usage:
 *   npx tsx scripts/import-planet-rugby-all-seasons.ts
 *   npx tsx scripts/import-planet-rugby-all-seasons.ts --slug=six-nations
 *   npx tsx scripts/import-planet-rugby-all-seasons.ts --no-match-details
 */
import { importFromPlanetRugbyTournamentUrl } from "../apps/web/src/lib/planet-rugby-import-service";
import { PLANET_RUGBY_LEAGUE_PRESETS } from "../apps/web/src/lib/planet-rugby-import-presets";

const args = process.argv.slice(2);
const slugFilter = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
const skipMatchDetails = args.includes("--no-match-details");

const presets = slugFilter
  ? PLANET_RUGBY_LEAGUE_PRESETS.filter((p) => p.slug === slugFilter)
  : PLANET_RUGBY_LEAGUE_PRESETS;

if (presets.length === 0) {
  console.error(`No preset found for slug: ${slugFilter}`);
  process.exit(1);
}

async function main() {
  console.log(
    `Importing all seasons for ${presets.length} competition(s)` +
      (skipMatchDetails ? " (fixtures/results only, no match details)" : " (full + match details)") +
      "…\n",
  );

  for (const preset of presets) {
    const started = Date.now();
    console.log(`→ ${preset.name} (${preset.slug})`);
    try {
      const result = await importFromPlanetRugbyTournamentUrl(preset.url, {
        importAllSeasons: true,
        importFixtures: true,
        importResults: true,
        syncStandings: true,
        importMatchDetails: !skipMatchDetails,
      });

      if ("seasonsImported" in result) {
        const { seasonsImported, totals, seasons } = result;
        console.log(
          `  ✓ ${seasonsImported} seasons in ${Math.round((Date.now() - started) / 1000)}s`,
        );
        for (const s of seasons) {
          console.log(
            `    ${s.seasonLabel}: +${s.created} created, ${s.updated} updated` +
              (s.matchDetailsEnriched != null ? `, ${s.matchDetailsEnriched} enriched` : ""),
          );
        }
        console.log(
          `  totals: ${totals.created} created, ${totals.updated} updated` +
            (totals.matchDetailsEnriched ? `, ${totals.matchDetailsEnriched} match details` : ""),
        );
      } else {
        console.log(`  ✓ ${result.seasonLabel}: +${result.created} created, ${result.updated} updated`);
      }
    } catch (e) {
      console.error(`  ✗ failed:`, e instanceof Error ? e.message : e);
    }
    console.log("");
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
