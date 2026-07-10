/**
 * Fill missing player clubs, nationalities, positions and ratings.
 *
 * Usage:
 *   npx tsx scripts/fill-player-profile-gaps.ts
 *   npx tsx scripts/fill-player-profile-gaps.ts --map
 *   npx tsx scripts/fill-player-profile-gaps.ts --no-wiki
 *   npx tsx scripts/fill-player-profile-gaps.ts --wiki-limit=200
 *   npx tsx scripts/fill-player-profile-gaps.ts --wiki-only --wiki-limit=500
 */
import {
  fillPlayerProfileGaps,
  getPlayerProfileGapStats,
  listPlayersStillMissingProfiles,
} from "../apps/web/src/lib/fill-player-profile-gaps-service";

const args = process.argv.slice(2);
const noWiki = args.includes("--no-wiki");
const wikiOnly = args.includes("--wiki-only");
const noRatings = args.includes("--no-ratings");
const withMap = args.includes("--map");
const noMap = args.includes("--no-map") || !withMap;
const wikiLimitArg = args.find((arg) => arg.startsWith("--wiki-limit="));
const wikiLimit = wikiLimitArg ? Number(wikiLimitArg.split("=")[1]) : undefined;

function printStats(label: string, stats: Awaited<ReturnType<typeof getPlayerProfileGapStats>>) {
  console.log(
    `${label}: ${stats.total} players — club ${stats.withClub} (${stats.missingClub} missing), nation ${stats.withNation} (${stats.missingNation} missing), position ${stats.withPosition} (${stats.missingPosition} missing), rating ${stats.withRating} (${stats.missingRating} missing)`,
  );
}

async function main() {
  const before = await getPlayerProfileGapStats();
  printStats("Before", before);
  console.log();

  const result = await fillPlayerProfileGaps({
    mapFromMatches: !noMap && !wikiOnly,
    repairFromSquads: !wikiOnly,
    fillPositionsFromSquads: !wikiOnly,
    fillNationalityFromBirthPlace: !wikiOnly,
    wikipedia: !noWiki
      ? {
          onlyIncomplete: true,
          limit: wikiLimit,
          delayMs: 400,
        }
      : false,
    calculateRatings: !noRatings && !wikiOnly ? { onlyMissing: true } : false,
    onProgress: (message) => console.log(message),
  });

  console.log();
  printStats("After", result.after);

  const remaining = await listPlayersStillMissingProfiles(10);
  if (remaining.length > 0) {
    console.log("\nSample players still incomplete:");
    for (const player of remaining) {
      const gaps = [
        !player.clubName ? "club" : null,
        !player.countryName ? "nation" : null,
        !player.positionName ? "position" : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`  · ${player.name} — missing: ${gaps}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
