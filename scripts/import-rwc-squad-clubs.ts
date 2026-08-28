/**
 * Import club-at-tournament from Wikipedia "{year} Rugby World Cup squads"
 * onto fixture_players.club_name for rugby-world-cup seasons 1987–2023.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-rwc-squad-clubs.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-rwc-squad-clubs.ts --years=2023 --dry-run
 */
import {
  importRwcSquadClubsForYear,
  RWC_SQUAD_CLUB_YEARS,
} from "../apps/web/src/lib/rwc-squad-club-import-service";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refresh = args.includes("--refresh");
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));

async function main() {
  const years = onlyYears?.length ? onlyYears : [...RWC_SQUAD_CLUB_YEARS];
  for (const year of years) {
    const result = await importRwcSquadClubsForYear(year, { dryRun, refresh });
    console.log(
      `${year}: parsed=${result.parsed} matched=${result.matched} updated=${result.updated} unmatched=${result.unmatched}${dryRun ? " (dry-run)" : ""}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
