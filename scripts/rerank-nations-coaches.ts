/**
 * Re-persist rating snapshots for all 12 Nations coaches so World Rank
 * reflects the full peer set (not sequential mid-batch ranks).
 */
import { persistCoachRatingSnapshot, listCoachWorldRankings } from "../apps/web/src/lib/coach-rating-service";

const COACH_IDS = [
  "dbe4562a-7255-42c4-bb70-653153c4da3c", // Rassie
  "ef35ca00-1a29-42c7-aa06-5dc9e0a0bfb3", // Borthwick
  "04901619-de61-46d8-b6bc-1123c0461b1d", // Galthié
  "1beeacf9-0b1e-4ae7-80b6-00c4b298f050", // Farrell
  "40eb9a73-cdb2-47ff-bb2e-1d2208d5f93e", // Townsend
  // created ids looked up below if needed
];

import { eq, inArray, or, ilike } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const rows = await db
    .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
    .from(coaches)
    .where(
      or(
        inArray(coaches.slug, [
          "rassie-erasmus",
          "steve-borthwick-coach519",
          "fabien-galthie-coach162",
          "andy-farrell-coach160",
          "gregor-townsend-coach161",
          "steve-tandy",
          "gonzalo-quesada",
          "dave-rennie",
          "les-kiss",
          "felipe-contepomi",
          "eddie-jones",
          "senirusi-seruvakula",
        ]),
      ),
    );

  console.log(`Re-ranking ${rows.length} coaches…`);
  const bundles = [];
  for (const c of rows) {
    const b = await persistCoachRatingSnapshot(c.id);
    bundles.push({
      name: c.name,
      slug: c.slug,
      overall: b.overallRating,
      powerIndex: b.powerIndex,
      worldRank: b.worldRank,
      rankedOutOf: b.rankedOutOf,
      matches: b.matchCount,
      provisional: b.provisional,
      eligible: b.coachRatingDetail?.eligibleForWorldRank,
    });
    console.log(
      `${c.name.padEnd(22)} rating=${String(b.overallRating).padStart(5)} PI=${String(b.powerIndex).padStart(5)} rank=#${b.worldRank ?? "—"}/${b.rankedOutOf ?? "—"} matches=${b.matchCount} eligible=${b.coachRatingDetail?.eligibleForWorldRank}`,
    );
  }

  console.log("\n=== WORLD RANKINGS (Coach Rating) ===");
  const board = await listCoachWorldRankings(20);
  for (const r of board) {
    console.log(`#${r.rank} ${r.name} ${r.rating}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
