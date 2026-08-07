/**
 * Merge SA franchise alias teams and other obvious cite/alias duplicates.
 *
 * Preferred display names (franchise branding):
 *   Bulls, Lions, Sharks, Cheetahs, Stormers
 * Western Province is kept separate from Stormers.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/merge-sa-franchise-teams.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/merge-sa-franchise-teams.ts
 */
import { eq } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { findDuplicateTeams, mergeTeamRecords } from "../apps/web/src/lib/entity-dedup-service";
import { teamDedupBaseName } from "../apps/web/src/lib/entity-normalize";

const dryRun = process.argv.includes("--dry-run");

/** Canonical display names for franchise keys. */
const PREFERRED_DISPLAY: Record<string, { name: string; shortName: string }> = {
  bulls: { name: "Bulls", shortName: "Bulls" },
  lions: { name: "Lions", shortName: "Lions" },
  sharks: { name: "Sharks", shortName: "Sharks" },
  cheetahs: { name: "Cheetahs", shortName: "Cheetahs" },
  stormers: { name: "Stormers", shortName: "Stormers" },
  clermont: { name: "Clermont", shortName: "Clermont" },
};

const SA_BASES = new Set(["bulls", "lions", "sharks", "cheetahs", "stormers"]);

async function main() {
  const groups = await findDuplicateTeams();
  const saGroups = groups.filter((g) => {
    const base = teamDedupBaseName(g.normalizedName);
    return SA_BASES.has(base) || base === "clermont" || /\[[\d]+\]/.test(g.rows.map((r) => r.name).join(" "));
  });

  // Also include any group where any row maps to an SA franchise base.
  const scoped = groups.filter((g) => {
    const bases = g.rows.map((r) => teamDedupBaseName(r.name));
    return bases.some((b) => SA_BASES.has(b) || b === "clermont") || g.rows.some((r) => /\[[\d]+\]/.test(r.name));
  });

  const target = scoped.length ? scoped : saGroups;

  console.log(dryRun ? "=== Dry run ===" : "=== Applying SA / cite merges ===");
  console.log(`Duplicate groups in scope: ${target.length} (of ${groups.length} total)\n`);

  let merged = 0;
  let deleted = 0;

  for (const group of target) {
    const base = teamDedupBaseName(group.rows[0]!.name);
    const preferred = PREFERRED_DISPLAY[base];
    const memberSummary = group.rows.map((r) => r.name).join(" | ");
    console.log(`KEY ${group.key}`);
    console.log(`  keep: ${group.rows.find((r) => r.id === group.canonicalId)?.name ?? group.canonicalId}`);
    console.log(`  drop: ${group.duplicateIds.length} → ${memberSummary}`);
    if (preferred) console.log(`  rename → ${preferred.name}`);

    if (!dryRun) {
      await mergeTeamRecords(group.canonicalId, group.duplicateIds, {
        displayName: preferred?.name,
        shortName: preferred?.shortName,
      });
      // Ensure preferred name sticks even if merge defaulted differently.
      if (preferred) {
        const db = getDb();
        await db
          .update(teams)
          .set({ name: preferred.name, shortName: preferred.shortName })
          .where(eq(teams.id, group.canonicalId));
      }
    }
    merged += 1;
    deleted += group.duplicateIds.length;
  }

  // Edinburgh leftover from wiki junk
  const db = getDb();
  const [edinburghJunk] = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, "edinburgh-short-term-loan"))
    .limit(1);
  if (edinburghJunk) {
    const [edinburgh] = await db.select().from(teams).where(eq(teams.slug, "edinburgh")).limit(1);
    console.log(`\nEdinburgh "short-term loan" → ${edinburgh ? "Edinburgh" : "DELETE"}`);
    if (!dryRun) {
      if (edinburgh) await mergeTeamRecords(edinburgh.id, [edinburghJunk.id], { displayName: "Edinburgh", shortName: "Edinburgh" });
      else {
        await db.update(teams).set({ name: "Edinburgh", shortName: "Edinburgh" }).where(eq(teams.id, edinburghJunk.id));
      }
    }
  }

  console.log(`\nDone. groups=${merged} deleted=${deleted}${dryRun ? " (dry-run)" : ""}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
