/**
 * Sync Rugby World Cup fixture_players scoring (tries/points/C/P/DG) into
 * player_match_performance_stats so /competitions/rugby-world-cup/stats boards work
 * from rugbydatabase / Wikipedia lineups when SDMS stats are missing.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-rwc-fixture-player-performance.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-rwc-fixture-player-performance.ts --years=1987,1991
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertMatchPerformanceStat } from "../apps/web/src/lib/player-season-stats-service";

const PROVIDER = "fixture_players";
const COMPETITION_SLUG = "rugby-world-cup";

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));

async function main() {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup not found");

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id));

  const selected = seasons
    .filter((s) => s.year != null && s.year <= 2023)
    .filter((s) => !onlyYears?.length || onlyYears.includes(s.year!))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  console.log(`Syncing fixture_players → performance for ${selected.map((s) => s.year).join(", ")}`);

  let totalUpserted = 0;
  for (const season of selected) {
    const seasonFixtures = await db
      .select({
        id: fixtures.id,
        externalMatchId: fixtures.externalMatchId,
        providerSnapshot: fixtures.providerSnapshot,
      })
      .from(fixtures)
      .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.competitionId, competition.id)));

    if (!seasonFixtures.length) {
      console.log(`  ${season.year}: no fixtures`);
      continue;
    }

    const fixtureIds = seasonFixtures.map((f) => f.id);
    const squadRows = await db
      .select()
      .from(fixturePlayers)
      .where(inArray(fixturePlayers.fixtureId, fixtureIds));

    const byFixture = new Map<string, typeof squadRows>();
    for (const row of squadRows) {
      const list = byFixture.get(row.fixtureId) ?? [];
      list.push(row);
      byFixture.set(row.fixtureId, list);
    }

    // Never clobber SDMS/Opta/Wikipedia performance rows (they share fixture+player uniqueness).
    const protectedProviders = new Set([
      "sdms",
      "sdms_gap_fill",
      "opta_published_leaderboard",
      "wikipedia_statistics",
    ]);
    const existingPerf = await db
      .select({
        fixtureId: playerMatchPerformanceStats.fixtureId,
        playerId: playerMatchPerformanceStats.playerId,
        sourceProvider: playerMatchPerformanceStats.sourceProvider,
      })
      .from(playerMatchPerformanceStats)
      .where(inArray(playerMatchPerformanceStats.fixtureId, fixtureIds));
    const protectedKeys = new Set(
      existingPerf
        .filter((r) => protectedProviders.has(r.sourceProvider ?? ""))
        .map((r) => `${r.fixtureId}:${r.playerId}`),
    );

    let upserted = 0;
    let withScores = 0;
    let skippedProtected = 0;
    for (const fixture of seasonFixtures) {
      const rows = byFixture.get(fixture.id) ?? [];
      // Always scope by fixture id so duplicate Wikipedia/RDB fixtures cannot collide on import_key.
      const externalMatchId = `fixture:${fixture.id}`;

      for (const row of rows) {
        if (protectedKeys.has(`${fixture.id}:${row.playerId}`)) {
          skippedProtected += 1;
          continue;
        }

        const hasScore =
          (row.tries ?? 0) > 0 ||
          (row.points ?? 0) > 0 ||
          (row.conversions ?? 0) > 0 ||
          (row.penalties ?? 0) > 0 ||
          (row.dropGoals ?? 0) > 0;
        if (hasScore) withScores += 1;

        // Always write appearances so boards get coverage + conversion/pen paths later.
        await upsertMatchPerformanceStat({
          fixtureId: fixture.id,
          playerId: row.playerId,
          teamId: row.teamId,
          seasonId: season.id,
          competitionId: competition.id,
          externalMatchId,
          externalPlayerId: `fp:${row.playerId}`,
          sourceProvider: PROVIDER,
          skipBioRefresh: true,
          stats: {
            minutesPlayed: 0,
            tries: row.tries ?? 0,
            points: row.points ?? 0,
            carries: 0,
            metresCarried: 0,
            tacklesMade: 0,
            tacklesCompleted: 0,
            dominantTackles: 0,
            turnoversWon: 0,
            tryAssists: 0,
            lineBreaks: 0,
            defendersBeaten: 0,
            touches: 0,
            postContactMetres: 0,
            ruckArrivalEffectiveness: 0,
            passes: 0,
            offloads: 0,
            missedTackles: 0,
            kicks: 0,
            kicksFromHand: 0,
            kickFromHandMetres: 0,
            kickPossessionRetained: 0,
            badPasses: 0,
            droppedCatch: 0,
            handlingError: 0,
            turnoversConceded: 0,
            runs: 0,
            gainLine: 0,
            carriesMetres: 0,
            carriesCrossedGainLine: 0,
            carriesNotMadeGainLine: 0,
          },
        });

        // Attach conversion/pen/drop/jersey detail onto extras.
        if (
          (row.conversions ?? 0) > 0 ||
          (row.penalties ?? 0) > 0 ||
          (row.dropGoals ?? 0) > 0 ||
          row.jerseyNumber != null
        ) {
          const [existing] = await db
            .select({
              id: playerMatchPerformanceStats.id,
              extras: playerMatchPerformanceStats.extras,
            })
            .from(playerMatchPerformanceStats)
            .where(
              and(
                eq(playerMatchPerformanceStats.fixtureId, fixture.id),
                eq(playerMatchPerformanceStats.playerId, row.playerId),
                eq(playerMatchPerformanceStats.sourceProvider, PROVIDER),
              ),
            )
            .limit(1);
          if (existing) {
            await db
              .update(playerMatchPerformanceStats)
              .set({
                extras: {
                  ...(typeof existing.extras === "object" && existing.extras
                    ? (existing.extras as object)
                    : {}),
                  conversions: row.conversions ?? 0,
                  penalties: row.penalties ?? 0,
                  dropGoals: row.dropGoals ?? 0,
                  jerseyNumber: row.jerseyNumber,
                  squadRole: row.squadRole,
                  positionName: row.positionName,
                  source: PROVIDER,
                },
              })
              .where(eq(playerMatchPerformanceStats.id, existing.id));
          }
        }
        upserted += 1;
      }
    }

    totalUpserted += upserted;
    console.log(
      `  ${season.year}: fixtures=${seasonFixtures.length} squadRows=${squadRows.length} upserted=${upserted} skippedProtected=${skippedProtected} withScores=${withScores}`,
    );
  }

  console.log(`Done. Upserted ${totalUpserted} performance rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
