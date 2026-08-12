/**
 * Merge competitions that share the same canonical display name
 * (e.g. duplicate "International Matches" imports).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/dedupe-competitions.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/dedupe-competitions.ts
 */
import {
  findDuplicateCompetitionGroups,
  findLegacySlugCompetitionGroups,
  mergeDuplicateCompetitions,
} from "../apps/web/src/lib/competition-dedupe-service";
import { normalizeCompetitionSeasonLabels } from "../apps/web/src/lib/competition-admin-service";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(dryRun ? "Dry run — no merges\n" : "Applying competition merge\n");

  const legacyGroups = await findLegacySlugCompetitionGroups();
  const nameGroups = await findDuplicateCompetitionGroups();
  console.log(`Legacy slug groups: ${legacyGroups.length}`);
  console.log(`Duplicate name groups: ${nameGroups.length}`);
  for (const group of [...legacyGroups, ...nameGroups]) {
    const [keeper, ...losers] = group.rows;
    if (!keeper) continue;
    console.log(`  ${group.canonicalName}`);
    console.log(
      `    keep ${keeper.slug} (${keeper.id.slice(0, 8)}…) fixtures=${keeper.fixtureCount} seasons=${keeper.seasonCount}`,
    );
    for (const loser of losers) {
      console.log(
        `    remove ${loser.slug} (${loser.id.slice(0, 8)}…) fixtures=${loser.fixtureCount} seasons=${loser.seasonCount}`,
      );
    }
  }

  const summary = await mergeDuplicateCompetitions({ dryRun });
  console.log(
    `\nGroups: ${summary.groups}, merged: ${summary.merged}, deleted: ${summary.deleted}`,
  );

  if (!dryRun && summary.details.length) {
    console.log("\nNormalising seasons on kept competitions…");
    for (const detail of summary.details) {
      await normalizeCompetitionSeasonLabels(detail.keptId);
      console.log(`  ${detail.canonicalName} (${detail.keptSlug})`);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
