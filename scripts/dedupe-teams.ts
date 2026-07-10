/**
 * Merge duplicate CMS teams (tier-aware: Women/U18/U20 stay separate from senior sides).
 *
 * Usage:
 *   npx tsx scripts/dedupe-teams.ts
 *   npx tsx scripts/dedupe-teams.ts --dry-run
 */
import { findDuplicateTeams, dedupeTeams } from "../apps/web/src/lib/entity-dedup-service";

const dryRun = process.argv.includes("--dry-run");
const quiet = process.argv.includes("--quiet");

async function main() {
  const groups = await findDuplicateTeams();
  const duplicateRows = groups.reduce((sum, group) => sum + group.duplicateIds.length, 0);

  console.log(`Found ${groups.length} duplicate group(s) covering ${duplicateRows} extra team record(s).\n`);

  if (!quiet) {
    for (const group of groups) {
      const kept = group.rows[0]!;
      console.log(`• ${group.normalizedName}`);
      console.log(`  keep: ${kept.name} (${kept.slug})`);
      for (const dup of group.rows.slice(1)) {
        console.log(`  merge: ${dup.name} (${dup.slug.slice(0, 72)}${dup.slug.length > 72 ? "…" : ""})`);
      }
      console.log();
    }
  }

  if (dryRun) {
    console.log("Dry run only — no merges performed.");
    return;
  }

  if (groups.length === 0) {
    console.log("Nothing to merge.");
    return;
  }

  const result = await dedupeTeams();
  console.log(`Merged ${result.deleted} duplicate team record(s) across ${result.groups} group(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
