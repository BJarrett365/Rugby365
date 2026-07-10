/**
 * Batch-calculate Rugby365 player ratings from squad, match and season data.
 *
 * Usage:
 *   npx tsx scripts/batch-calculate-player-ratings.ts
 *   npx tsx scripts/batch-calculate-player-ratings.ts --all
 *   npx tsx scripts/batch-calculate-player-ratings.ts --limit=100
 */
import { batchCalculateAllPlayerRatings } from "../apps/web/src/lib/player-ratings-batch-service";

const onlyMissing = !process.argv.includes("--all");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

async function main() {
  console.log(
    onlyMissing
      ? "Calculating ratings for players missing a stored Rugby365 rating…"
      : "Recalculating Rugby365 ratings for all squad players…",
  );

  let lastLog = 0;
  const summary = await batchCalculateAllPlayerRatings({
    onlyMissing,
    onlyWithSquads: true,
    limit,
    onProgress: ({ index, total, playerName, displayRating, error }) => {
      if (index - lastLog >= 50 || index === total) {
        lastLog = index;
        const status = error ? `error: ${error}` : `rating ${displayRating ?? "—"}`;
        console.log(`[${index}/${total}] ${playerName} — ${status}`);
      }
    },
  });

  console.log(
    `\nDone. Processed ${summary.processed}/${summary.total}: ${summary.rated} rated, ${summary.skipped} without score, ${summary.failed} failed.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
