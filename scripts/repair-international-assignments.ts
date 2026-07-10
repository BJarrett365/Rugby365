/**
 * Audit and repair players with club teams stored as international nation/team.
 *
 * Usage:
 *   npx tsx scripts/repair-international-assignments.ts
 *   npx tsx scripts/repair-international-assignments.ts --audit
 *   npx tsx scripts/repair-international-assignments.ts --limit=50
 */
import {
  listInvalidInternationalAssignments,
  repairInvalidInternationalAssignments,
} from "../apps/web/src/lib/repair-international-assignments-service";

const auditOnly = process.argv.includes("--audit");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

async function main() {
  const invalid = await listInvalidInternationalAssignments({ limit: limit ?? 200 });
  console.log(`\nInvalid international assignments: ${invalid.length}`);
  for (const row of invalid.slice(0, 40)) {
    console.log(`- ${row.playerName}: ${row.reasons.join("; ")}`);
  }
  if (invalid.length > 40) console.log(`  … and ${invalid.length - 40} more`);

  if (auditOnly) return;

  const result = await repairInvalidInternationalAssignments({
    limit,
    onProgress: (message) => console.log(message),
  });
  console.log("\nRepair summary:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
