/**
 * Seed SA legends from catalog, refresh Wikipedia enrichment/honours, score legends.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/seed-sa-legends-and-scores.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/seed-sa-legends-and-scores.ts --write --limit=20 --skip-wiki
 */
import { seedPlanetRugbyLegends } from "../apps/web/src/lib/legends-seed-service";
import {
  recalculateAllLegendScores,
  refreshLegendScoreRanks,
} from "../apps/web/src/lib/legend-score-service";

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const write = hasFlag("--write");
  const skipWiki = hasFlag("--skip-wiki");
  const limit = Number(argValue("--limit") ?? "0") || undefined;

  console.log(`Seeding South Africa legends (write=${write}, skipWiki=${skipWiki})…`);
  const seed = await seedPlanetRugbyLegends({
    dryRun: !write,
    countryName: "South Africa",
    enrichWikipedia: write && !skipWiki,
    delayMs: 700,
    limit,
  });
  console.log(
    JSON.stringify(
      {
        total: seed.total,
        processed: seed.processed,
        linked: seed.linked,
        created: seed.created,
        membershipAdded: seed.membershipAdded,
        skipped: seed.skipped,
        failed: seed.failed,
        sample: seed.items.slice(0, 15).map((i) => `${i.action}: ${i.name}`),
      },
      null,
      2,
    ),
  );

  if (!write) {
    console.log("Dry run — skip legend score recalculation.");
    return;
  }

  console.log("Recalculating legend scores…");
  const scores = await recalculateAllLegendScores(limit ? { limit } : undefined);
  console.log(JSON.stringify(scores, null, 2));

  const ranks = await refreshLegendScoreRanks();
  console.log(JSON.stringify({ ranks }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
