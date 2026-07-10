/**
 * Import and reconcile Exeter Chiefs men's squad from the official club website.
 *
 * Usage:
 *   npx tsx scripts/import-exeter-chiefs-squad.ts              # dry-run preview (default)
 *   npx tsx scripts/import-exeter-chiefs-squad.ts --write     # apply changes
 */
import { fetchExeterChiefsMensSquad } from "@rugby365/import-sdk";
import {
  EXETER_CHIEFS_SOURCE_URL,
  formatClubSquadImportReport,
  reconcileClubSquad,
  resolveExeterChiefsTeam,
} from "../apps/web/src/lib/club-squad-import-service";

const SOURCE_CHECKED_DATE = "2026-07-10";
const SEASON_LABEL = "2026–27";
const dryRun = !process.argv.includes("--write");

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Fetching official Exeter Chiefs men's squad…`);
  const document = await fetchExeterChiefsMensSquad(EXETER_CHIEFS_SOURCE_URL);
  console.log(`Parsed ${document.players.length} players from ${document.sourceUrl}`);

  const exeter = await resolveExeterChiefsTeam();
  if (!exeter) {
    throw new Error("Exeter Chiefs team not found in CMS — create the Premiership team first.");
  }

  const report = await reconcileClubSquad({
    document,
    clubTeamId: exeter.id,
    clubName: exeter.name,
    seasonLabel: SEASON_LABEL,
    sourceCheckedDate: SOURCE_CHECKED_DATE,
    dryRun,
  });

  console.log("\n" + formatClubSquadImportReport(report));

  if (dryRun) {
    console.log("\nNo database writes performed. Re-run with --write to apply.");
  } else {
    console.log("\nImport applied.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
