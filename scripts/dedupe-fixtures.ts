#!/usr/bin/env npx tsx
/**
 * Merge duplicate fixtures (same teams + kickoff date) and delete redundant rows.
 *
 *   npx tsx scripts/dedupe-fixtures.ts           # dry-run (default)
 *   npx tsx scripts/dedupe-fixtures.ts --write   # apply merges + deletes
 */
import { dedupeFixtureGroups, findDuplicateFixtureGroups } from "../apps/web/src/lib/fixture-dedupe-service";

const write = process.argv.includes("--write");

async function main() {
  const groups = await findDuplicateFixtureGroups();
  console.log(`Found ${groups.length} duplicate fixture groups.`);

  const report = await dedupeFixtureGroups({ dryRun: !write });
  for (const action of report.actions) {
    console.log(
      `- keep ${action.keeperSlug} (${action.keeperId}) · remove ${action.removedIds.length} · merged: ${action.mergedFields.join(", ") || "none"}`,
    );
  }

  console.log(
    `\n${write ? "Applied" : "Dry-run"}: ${report.groupsFound} groups · ${write ? report.fixturesRemoved : report.actions.reduce((n, a) => n + a.removedIds.length, 0)} fixtures ${write ? "removed" : "would be removed"}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
