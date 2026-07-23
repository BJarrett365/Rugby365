/**
 * Deduplicate player entities and transfer rows.
 *
 * Usage:
 *   npx tsx scripts/dedupe-transfers-and-players.ts
 *   npx tsx scripts/dedupe-transfers-and-players.ts --dry-run
 *   npx tsx scripts/dedupe-transfers-and-players.ts --transfers-only
 *   npx tsx scripts/dedupe-transfers-and-players.ts --players-only
 */
import { dedupePlayers, findDuplicatePlayers } from "../apps/web/src/lib/entity-dedup-service";
import { dedupeAllPlayerTransfers } from "../apps/web/src/lib/transfer-dedupe";

const dryRun = process.argv.includes("--dry-run");
const transfersOnly = process.argv.includes("--transfers-only");
const playersOnly = process.argv.includes("--players-only");

async function main() {
  console.log(dryRun ? "Dry run — no deletes\n" : "Applying dedupe\n");

  if (!transfersOnly) {
    const playerGroups = await findDuplicatePlayers();
    console.log(`Duplicate player groups: ${playerGroups.length}`);
    for (const group of playerGroups.slice(0, 20)) {
      console.log(
        `  ${group.normalizedName}: keep ${group.canonicalId.slice(0, 8)}… remove ${group.duplicateIds.length}`,
      );
    }
    if (playerGroups.length > 20) console.log(`  …and ${playerGroups.length - 20} more`);

    if (!dryRun && playerGroups.length) {
      const playerSummary = await dedupePlayers();
      console.log(
        `\nPlayers merged: ${playerSummary.merged}, deleted: ${playerSummary.deleted}, groups: ${playerSummary.groups}`,
      );
    } else if (dryRun) {
      const deleted = playerGroups.reduce((n, g) => n + g.duplicateIds.length, 0);
      console.log(`\nWould merge/delete ~${deleted} duplicate player rows`);
    }
  }

  if (!playersOnly) {
    const transferSummary = await dedupeAllPlayerTransfers({ dryRun });
    console.log(
      `\nTransfer duplicate groups: ${transferSummary.groups}, deleted: ${transferSummary.deleted}, kept: ${transferSummary.kept}`,
    );
    for (const detail of transferSummary.details.slice(0, 15)) {
      console.log(`  ${detail.key.slice(0, 80)}… −${detail.deletedIds.length}`);
    }
    if (transferSummary.details.length > 15) {
      console.log(`  …and ${transferSummary.details.length - 15} more`);
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
