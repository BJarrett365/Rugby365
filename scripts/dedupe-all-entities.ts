/**
 * Deduplicate all entity types: players, referees, coaches, and teams.
 *
 * Usage:
 *   npx tsx scripts/dedupe-all-entities.ts
 *   npx tsx scripts/dedupe-all-entities.ts --dry-run
 */

import fs from "fs";
import path from "path";

const serverOnlyPath = path.resolve(__dirname, "../node_modules/server-only/index.js");
const serverOnlyOriginal = fs.readFileSync(serverOnlyPath, "utf8");
fs.writeFileSync(serverOnlyPath, "// stubbed for scripts");

process.on("exit", () => fs.writeFileSync(serverOnlyPath, serverOnlyOriginal));
process.on("SIGINT", () => { fs.writeFileSync(serverOnlyPath, serverOnlyOriginal); process.exit(1); });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const {
    dedupePlayers,
    dedupeReferees,
    dedupeCoaches,
    dedupeTeams,
    findDuplicatePlayers,
    findDuplicateReferees,
    findDuplicateCoaches,
    findDuplicateTeams,
  } = await import("../apps/web/src/lib/entity-dedup-service");

  console.log(dryRun ? "=== DRY RUN ===\n" : "=== APPLYING DEDUP ===\n");

  const [playerGroups, refereeGroups, coachGroups, teamGroups] = await Promise.all([
    findDuplicatePlayers(),
    findDuplicateReferees(),
    findDuplicateCoaches(),
    findDuplicateTeams(),
  ]);

  console.log(`Player duplicate groups:  ${playerGroups.length} (${playerGroups.reduce((s, g) => s + g.duplicateIds.length, 0)} dupes to remove)`);
  console.log(`Referee duplicate groups: ${refereeGroups.length} (${refereeGroups.reduce((s, g) => s + g.duplicateIds.length, 0)} dupes to remove)`);
  console.log(`Coach duplicate groups:   ${coachGroups.length} (${coachGroups.reduce((s, g) => s + g.duplicateIds.length, 0)} dupes to remove)`);
  console.log(`Team duplicate groups:    ${teamGroups.length} (${teamGroups.reduce((s, g) => s + g.duplicateIds.length, 0)} dupes to remove)`);
  console.log();

  if (dryRun) {
    for (const [label, groups] of [["Referees", refereeGroups], ["Coaches", coachGroups], ["Players", playerGroups]] as const) {
      console.log(`--- ${label} ---`);
      for (const g of (groups as typeof refereeGroups).slice(0, 30)) {
        console.log(`  ${g.normalizedName}: keep ${g.canonicalId.slice(0, 8)}… remove ${g.duplicateIds.length}`);
      }
      if ((groups as typeof refereeGroups).length > 30) console.log(`  …and ${(groups as typeof refereeGroups).length - 30} more`);
      console.log();
    }
    console.log("Run without --dry-run to apply.");
    process.exit(0);
  }

  console.log("Deduping referees…");
  const refResult = await dedupeReferees();
  console.log(`  ✓ ${refResult.merged} groups merged, ${refResult.deleted} duplicates removed\n`);

  console.log("Deduping coaches…");
  const coachResult = await dedupeCoaches();
  console.log(`  ✓ ${coachResult.merged} groups merged, ${coachResult.deleted} duplicates removed\n`);

  console.log("Deduping players…");
  const playerResult = await dedupePlayers();
  console.log(`  ✓ ${playerResult.merged} groups merged, ${playerResult.deleted} duplicates removed\n`);

  console.log("Deduping teams…");
  const teamResult = await dedupeTeams();
  console.log(`  ✓ ${teamResult.merged} groups merged, ${teamResult.deleted} duplicates removed\n`);

  console.log("=== DONE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
