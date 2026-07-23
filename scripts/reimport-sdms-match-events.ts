/**
 * Re-import SDMS scoring events for fixtures with an external match id,
 * sync fixture_players points, then refresh season ranks + player ratings.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-sdms-match-events.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-sdms-match-events.ts --match=o6gdywy6
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-sdms-match-events.ts --limit=20
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-sdms-match-events.ts --full
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-sdms-match-events.ts --skip-ratings
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { fixtures, playerMatchPerformanceStats } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  enrichFixtureFromSdmsMatch,
  repairSdmsFixtureScoringEvents,
} from "../apps/web/src/lib/planet-rugby-match-import-service";
import {
  aggregatePlayerSeasonStats,
  recomputeSeasonPerformanceRanks,
} from "../apps/web/src/lib/player-season-stats-service";
import { batchCalculateAllPlayerRatings } from "../apps/web/src/lib/player-ratings-batch-service";

const args = process.argv.slice(2);
const matchFilter = args.find((a) => a.startsWith("--match="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : undefined;
const concurrency = Math.max(1, Number(concurrencyArg ?? 4) || 4);
const skipRatings = args.includes("--skip-ratings");
const fullEnrich = args.includes("--full");
const includeScheduled = args.includes("--include-scheduled");

async function mapPool<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
  return results;
}

async function main() {
  const db = getDb();
  const statusFilter = includeScheduled
    ? sql`true`
    : inArray(fixtures.status, ["full_time", "completed"]);

  // SDMS ids look like `o6gdywy6`. Skip Sport365-style `1-4308582` externals.
  const sdmsIdFilter = sql`${fixtures.externalMatchId} ~ '^[a-z0-9]{6,12}$'`;

  const rows = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
      slug: fixtures.slug,
      seasonId: fixtures.seasonId,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(
      and(
        isNotNull(fixtures.externalMatchId),
        sql`trim(${fixtures.externalMatchId}) <> ''`,
        matchFilter ? eq(fixtures.externalMatchId, matchFilter) : and(statusFilter, sdmsIdFilter),
      ),
    )
    .orderBy(sql`${fixtures.kickoffAt} desc nulls last`);

  const targets = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
  console.log(
    `Re-importing SDMS ${fullEnrich ? "full enrich" : "scoring events"} for ${targets.length} fixture(s) (concurrency ${concurrency})…`,
  );

  let enriched = 0;
  let failed = 0;
  const seasonIds = new Set<string>();
  const failures: Array<{ matchId: string; slug: string | null; error: string }> = [];

  await mapPool(targets, concurrency, async (row, index) => {
    const matchId = row.externalMatchId!;
    try {
      if (fullEnrich) {
        const result = await enrichFixtureFromSdmsMatch(row.id, matchId, {
          replaceEvents: true,
        });
        if ((index + 1) % 25 === 0 || index + 1 === targets.length) {
          console.log(
            `[${index + 1}/${targets.length}] ${row.slug ?? matchId} · events+${result.eventsImported}`,
          );
        }
      } else {
        const result = await repairSdmsFixtureScoringEvents(row.id, matchId);
        if ((index + 1) % 25 === 0 || index + 1 === targets.length) {
          console.log(
            `[${index + 1}/${targets.length}] ${row.slug ?? matchId} · events+${result.eventsImported} · linked ${result.linked}`,
          );
        }
      }
      enriched += 1;
      if (row.seasonId) seasonIds.add(row.seasonId);
    } catch (error) {
      failed += 1;
      failures.push({
        matchId,
        slug: row.slug,
        error: error instanceof Error ? error.message : String(error),
      });
      if (failures.length <= 20) {
        console.warn(`  ✗ ${row.slug ?? matchId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  });

  console.log(`\nEnrichment done: ${enriched} ok · ${failed} failed`);

  if (seasonIds.size > 0) {
    console.log(`Re-aggregating season stats for ${seasonIds.size} season(s)…`);
    const seasonList = [...seasonIds];
    const combos = await db
      .selectDistinct({
        playerId: playerMatchPerformanceStats.playerId,
        seasonId: playerMatchPerformanceStats.seasonId,
        teamId: playerMatchPerformanceStats.teamId,
      })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          isNotNull(playerMatchPerformanceStats.seasonId),
          inArray(playerMatchPerformanceStats.seasonId, seasonList),
        ),
      );

    let agg = 0;
    for (const combo of combos) {
      if (!combo.seasonId) continue;
      await aggregatePlayerSeasonStats({
        playerId: combo.playerId,
        seasonId: combo.seasonId,
        teamId: combo.teamId,
      });
      agg += 1;
      if (agg % 200 === 0) console.log(`  aggregated ${agg}/${combos.length}`);
    }
    console.log(`  aggregated ${agg} player-season-team rows`);

    console.log(`Recomputing season performance ranks…`);
    let seasonIndex = 0;
    for (const seasonId of seasonList) {
      seasonIndex += 1;
      await recomputeSeasonPerformanceRanks(seasonId);
      if (seasonIndex % 10 === 0 || seasonIndex === seasonList.length) {
        console.log(`  ranks ${seasonIndex}/${seasonList.length}`);
      }
    }
  }

  if (!skipRatings) {
    console.log("Recalculating player ratings (all squad players)…");
    const summary = await batchCalculateAllPlayerRatings({
      onlyMissing: false,
      onlyWithSquads: true,
      onProgress: ({ index, total }) => {
        if (index % 100 === 0 || index === total) {
          console.log(`  ratings ${index}/${total}`);
        }
      },
    });
    console.log(
      `Ratings: ${summary.rated} rated · ${summary.skipped} skipped · ${summary.failed} failed`,
    );
  }

  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const row of failures.slice(0, 40)) {
      console.log(`- ${row.matchId} (${row.slug ?? "—"}) ${row.error}`);
    }
    if (failures.length > 40) console.log(`… and ${failures.length - 40} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
