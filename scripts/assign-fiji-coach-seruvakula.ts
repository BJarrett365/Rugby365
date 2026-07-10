/**
 * Import Senirusi Seruvakula, assign as Fiji head coach from 2026, backfill fixtures.
 *
 * Usage:
 *   npx tsx scripts/assign-fiji-coach-seruvakula.ts
 *   npx tsx scripts/assign-fiji-coach-seruvakula.ts --dry-run
 */
import { eq } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { assignCoachToTeamFixtures } from "../apps/web/src/lib/assign-coaches-to-fixtures-service";
import { upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { importCoachFromWikipedia } from "../apps/web/src/lib/coach-wikipedia-import-service";
import { getDb } from "../apps/web/src/lib/db";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/Senirusi_Seruvakula";
const COACH_FROM_DATE = "2026-01-01";
const dryRun = process.argv.includes("--dry-run");

async function resolveFijiTeam() {
  const db = getDb();
  const rows = await db.select().from(teams);
  return (
    rows.find((team) => team.slug === "fiji") ??
    rows.find((team) => team.name.toLowerCase() === "fiji") ??
    null
  );
}

async function main() {
  const fiji = await resolveFijiTeam();
  if (!fiji) {
    throw new Error("Fiji team not found in CMS — create the national team first.");
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Importing coach from Wikipedia…`);
  const imported = await importCoachFromWikipedia({
    articleTitleOrUrl: WIKIPEDIA_URL,
    linkTeamId: fiji.id,
    linkTeamName: fiji.name,
    countryName: "Fiji",
  });
  console.log(
    `Coach: ${imported.slug} (${imported.coachId}) — ${imported.created ? "created" : "updated"}`,
  );

  if (!dryRun) {
    const assignment = await upsertCoachingStaffAssignment({
      coachId: imported.coachId,
      teamId: fiji.id,
      role: "head_coach",
      startDate: COACH_FROM_DATE,
      endDate: null,
      isCurrent: true,
      sourceUrl: WIKIPEDIA_URL,
      importKey: `current-coach:fiji:head_coach:${imported.slug}`,
      notes: "Fiji head coach from 2026",
    });
    console.log(
      `Team assignment: ${assignment.created ? "created" : "updated"} (${COACH_FROM_DATE} → current)`,
    );
  }

  console.log(`\nAssigning to Fiji fixtures from ${COACH_FROM_DATE}…`);
  const fixtures = await assignCoachToTeamFixtures({
    teamId: fiji.id,
    coachId: imported.coachId,
    fromDate: COACH_FROM_DATE,
    dryRun,
    overwrite: true,
  });

  console.log(
    `Fixtures processed: ${fixtures.fixturesProcessed} · home: ${fixtures.homeUpdated} · away: ${fixtures.awayUpdated} · skipped: ${fixtures.skipped}`,
  );
  if (fixtures.failures.length) {
    console.log("Failures:");
    for (const failure of fixtures.failures) {
      console.log(`  · ${failure.fixtureId}: ${failure.error}`);
    }
    process.exit(1);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
