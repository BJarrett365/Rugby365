/**
 * Batch-enrich all players from Wikipedia.
 *
 * Usage:
 *   npx tsx scripts/enrich-all-players-wikipedia.ts
 *   npx tsx scripts/enrich-all-players-wikipedia.ts --all
 *   npx tsx scripts/enrich-all-players-wikipedia.ts --limit 50
 */
import { enrichAllPlayersFromWikipedia } from "../apps/web/src/lib/player-wikipedia-enrich";

const onlyMissing = !process.argv.includes("--all");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

async function main() {
  console.log(
    onlyMissing
      ? "Enriching players missing Wikipedia archive data…"
      : "Refreshing Wikipedia archive for all players…",
  );

  let lastLog = 0;
  const summary = await enrichAllPlayersFromWikipedia({
    onlyMissing,
    limit,
    delayMs: 400,
    onProgress: ({ index, total, playerName, result }) => {
      if (index - lastLog >= 25 || index === total) {
        lastLog = index;
        const status = result.enriched ? "ok" : (result.reason ?? "skip");
        console.log(`[${index}/${total}] ${playerName} — ${status}`);
      }
    },
  });

  console.log(
    `\nDone. Processed ${summary.processed}/${summary.total}: ${summary.enriched} enriched, ${summary.skipped} skipped, ${summary.failed} failed.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
