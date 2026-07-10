/**
 * Create/update coaches and assign them to their current teams.
 *
 * Usage:
 *   npx tsx scripts/assign-current-coaches.ts
 */
import {
  assignCurrentCoaches,
  CURRENT_COACH_ASSIGNMENTS,
} from "../apps/web/src/lib/assign-current-coaches-service";

async function main() {
  console.log(`Assigning ${CURRENT_COACH_ASSIGNMENTS.length} current coach roles…\n`);

  const result = await assignCurrentCoaches();

  if (result.teamsCreated.length) {
    console.log(`Teams created (${result.teamsCreated.length}):`);
    for (const team of result.teamsCreated) console.log(`  · ${team}`);
    console.log();
  }

  if (result.coachesCreated.length) {
    console.log(`Coaches created (${result.coachesCreated.length}):`);
    for (const coach of result.coachesCreated) console.log(`  · ${coach}`);
    console.log();
  }

  console.log(
    `Assignments: ${result.assignmentsCreated} created, ${result.assignmentsUpdated} updated`,
  );
  console.log(`Prior leadership demoted: ${result.demotedPriorCurrent}`);

  if (result.failures.length) {
    console.log(`\nFailures (${result.failures.length}):`);
    for (const failure of result.failures) {
      console.log(`  · ${failure.coachName} @ ${failure.teamSlug}: ${failure.error}`);
    }
    process.exit(1);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
