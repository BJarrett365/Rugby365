/**
 * Re-attach Rugby World Cup history that landed on `__legacy__` clones
 * after the stable-ID / Supabase sync, then write overall standings so
 * /tables and /competitions/rugby-world-cup can see it.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/restore-rwc-canonical.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/restore-rwc-canonical.ts
 */
import { eq } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { mergeLegacyClonesForBaseSlug } from "../apps/web/src/lib/competition-dedupe-service";
import { calculateRugbyTable } from "../apps/web/src/lib/table-lab/table-calculation-service";

const dryRun = process.argv.includes("--dry-run");

async function rebuildOverallStandings(seasonId: string, label: string) {
  const db = getDb();
  const existing = await db
    .select({ id: standingRows.id })
    .from(standingRows)
    .where(eq(standingRows.seasonId, seasonId));
  const overallCount = (
    await db
      .select({ view: standingRows.view })
      .from(standingRows)
      .where(eq(standingRows.seasonId, seasonId))
  ).filter((r) => r.view === "overall").length;

  if (overallCount > 0) {
    console.log(`  ${label}: overall standings already present (${overallCount} rows)`);
    return;
  }

  const result = await calculateRugbyTable("live_table", {
    seasonId,
    tableView: "all",
    includeLiveMatches: false,
    includeScheduledMatches: false,
    showMovement: false,
  });

  let upserted = 0;
  for (const row of result.rows) {
    if (!row.teamId || row.played <= 0) continue;
    await db.insert(standingRows).values({
      seasonId,
      teamId: row.teamId,
      view: "overall",
      rank: row.rank,
      played: row.played,
      won: row.won,
      draw: row.drawn,
      lost: row.lost,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointsDiff: row.pointsDiff,
      bonusPoints: row.bonusPoints,
      points: row.leaguePoints,
      form: null,
      syncedAt: new Date(),
    });
    upserted += 1;
  }
  console.log(
    `  ${label}: wrote ${upserted} overall rows from fixtures (had ${existing.length} other-view rows)`,
  );
}

async function main() {
  console.log(dryRun ? "Dry run — merge only preview\n" : "Restoring Rugby World Cup onto rugby-world-cup\n");

  const merge = await mergeLegacyClonesForBaseSlug("rugby-world-cup", { dryRun });
  console.log(
    `Merge: groups=${merge.groups} merged=${merge.merged} deleted=${merge.deleted}`,
  );
  for (const detail of merge.details) {
    console.log(`  keep ${detail.keptSlug} (${detail.keptId})`);
    console.log(`  remove ${detail.removedIds.length} legacy clone(s)`);
  }

  if (dryRun) {
    console.log("\nDry run done.");
    return;
  }

  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup competition not found after merge");

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id));
  console.log(`\nRebuilding overall standings for ${seasons.length} season(s)…`);
  for (const season of seasons.sort((a, b) => (a.year ?? 0) - (b.year ?? 0))) {
    await rebuildOverallStandings(season.id, `${season.year} ${season.label}`);
  }

  console.log("\nDone. Public /tables and /competitions/rugby-world-cup should now see the archive.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
