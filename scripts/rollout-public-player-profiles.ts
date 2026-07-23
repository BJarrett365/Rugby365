/**
 * Bulk data rollout for public player profiles (season attach + season aggregates).
 * Uses @rugby365/db directly so it can run from tsx without Next server-only.
 */
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  competitionSeasons,
  createDb,
  fixtures,
  playerMatchPerformanceStats,
  playerSeasonStats,
  playerTransfers,
} from "@rugby365/db";
import { resolveFixtureSeasonLabel } from "../apps/web/src/lib/fixture-season-utils";

function normalizeClubKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "none";
}

function transferCollapseKey(t: {
  movementType: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromClub: string | null;
  toClub: string | null;
}): string {
  return [
    t.movementType,
    t.fromTeamId ?? normalizeClubKey(t.fromClub),
    t.toTeamId ?? normalizeClubKey(t.toClub),
  ].join("|");
}

type Db = ReturnType<typeof createDb>;

async function resolveSeasonId(
  db: Db,
  input: { competitionId: string | null; kickoffAt: Date | null },
): Promise<string | null> {
  if (!input.competitionId || !input.kickoffAt) return null;
  const seasonRows = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, input.competitionId));
  const label = resolveFixtureSeasonLabel({
    kickoffAt: input.kickoffAt,
    competitionId: input.competitionId,
    seasons: seasonRows,
  });
  return seasonRows.find((s) => s.label === label)?.id ?? null;
}

async function attachNullFixtureSeasons(db: Db, log: (m: string) => void) {
  let attached = 0;
  let skipped = 0;
  for (let pass = 1; pass <= 30; pass += 1) {
    const rows = await db
      .select({
        id: fixtures.id,
        competitionId: fixtures.competitionId,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(fixtures)
      .where(and(isNull(fixtures.seasonId), isNotNull(fixtures.competitionId)))
      .limit(500);

    if (!rows.length) break;
    let passAttached = 0;
    for (const row of rows) {
      const seasonId = await resolveSeasonId(db, {
        competitionId: row.competitionId,
        kickoffAt: row.kickoffAt,
      });
      if (!seasonId) {
        skipped += 1;
        continue;
      }
      const [updated] = await db
        .update(fixtures)
        .set({ seasonId })
        .where(and(eq(fixtures.id, row.id), isNull(fixtures.seasonId)))
        .returning({ id: fixtures.id });
      if (updated) {
        attached += 1;
        passAttached += 1;
      }
    }
    log(`  season attach pass ${pass}: +${passAttached} (batch ${rows.length})`);
    if (passAttached === 0) break;
  }
  return { attached, skipped };
}

async function rebuildSeasonStats(db: Db, log: (m: string) => void) {
  const buckets = await db
    .select({
      playerId: playerMatchPerformanceStats.playerId,
      seasonId: playerMatchPerformanceStats.seasonId,
      teamId: playerMatchPerformanceStats.teamId,
      competitionId: playerMatchPerformanceStats.competitionId,
    })
    .from(playerMatchPerformanceStats)
    .where(isNotNull(playerMatchPerformanceStats.seasonId))
    .groupBy(
      playerMatchPerformanceStats.playerId,
      playerMatchPerformanceStats.seasonId,
      playerMatchPerformanceStats.teamId,
      playerMatchPerformanceStats.competitionId,
    );

  log(`  aggregating ${buckets.length} player/season/team buckets…`);
  const seasonIds = new Set<string>();
  let upserted = 0;

  for (let i = 0; i < buckets.length; i += 1) {
    const b = buckets[i]!;
    if (!b.seasonId) continue;

    const rows = await db
      .select()
      .from(playerMatchPerformanceStats)
      .where(
        and(
          eq(playerMatchPerformanceStats.playerId, b.playerId),
          eq(playerMatchPerformanceStats.seasonId, b.seasonId),
          eq(playerMatchPerformanceStats.teamId, b.teamId),
        ),
      );

    const totals = rows.reduce(
      (acc, row) => {
        acc.appearances += 1;
        acc.minutesPlayed += row.minutesPlayed;
        acc.tries += row.tries;
        acc.points += row.points;
        acc.carries += row.carries;
        acc.metresCarried += row.metresCarried;
        acc.tacklesMade += row.tacklesMade;
        acc.tacklesCompleted += row.tacklesCompleted;
        acc.dominantTackles += row.dominantTackles;
        acc.turnoversWon += row.turnoversWon;
        acc.tryAssists += row.tryAssists;
        acc.lineBreaks += row.lineBreaks;
        acc.defendersBeaten += row.defendersBeaten;
        acc.touches += row.touches;
        acc.postContactMetres += row.postContactMetres;
        acc.ruckArrivalEffectiveness += row.ruckArrivalEffectiveness;
        return acc;
      },
      {
        appearances: 0,
        minutesPlayed: 0,
        tries: 0,
        points: 0,
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
      },
    );

    const [season] = await db
      .select()
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, b.seasonId))
      .limit(1);
    if (!season) continue;

    const competitionId = b.competitionId ?? season.competitionId;
    const [existing] = await db
      .select({ id: playerSeasonStats.id })
      .from(playerSeasonStats)
      .where(
        and(
          eq(playerSeasonStats.playerId, b.playerId),
          eq(playerSeasonStats.seasonId, b.seasonId),
          eq(playerSeasonStats.teamId, b.teamId),
        ),
      )
      .limit(1);

    const values = {
      playerId: b.playerId,
      seasonId: b.seasonId,
      competitionId,
      teamId: b.teamId,
      ...totals,
      sourceProvider: "sdms" as const,
      syncedAt: new Date(),
    };

    if (existing) {
      await db.update(playerSeasonStats).set(values).where(eq(playerSeasonStats.id, existing.id));
    } else {
      await db.insert(playerSeasonStats).values(values);
    }
    upserted += 1;
    seasonIds.add(b.seasonId);
    if ((i + 1) % 200 === 0 || i + 1 === buckets.length) {
      log(`  season stats ${i + 1}/${buckets.length}`);
    }
  }

  // Rankings: mark seasons touched; attack/defence ranks computed on next CMS season-stats view / optional later pass.
  return { buckets: buckets.length, upserted, ranked: seasonIds.size };
}

async function scanTransfers(db: Db) {
  const rows = await db
    .select({
      id: playerTransfers.id,
      playerId: playerTransfers.playerId,
      effectiveDate: playerTransfers.effectiveDate,
      fromClub: playerTransfers.fromClub,
      toClub: playerTransfers.toClub,
      fromTeamId: playerTransfers.fromTeamId,
      toTeamId: playerTransfers.toTeamId,
      movementType: playerTransfers.movementType,
      seasonId: playerTransfers.seasonId,
    })
    .from(playerTransfers);

  const byPlayer = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row);
    byPlayer.set(row.playerId, list);
  }
  let players = 0;
  let groups = 0;
  for (const list of byPlayer.values()) {
    const buckets = new Map<string, number>();
    for (const row of list) {
      const key = transferCollapseKey(row);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const conflictCount = [...buckets.values()].filter((n) => n > 1).length;
    if (conflictCount) {
      players += 1;
      groups += conflictCount;
    }
  }
  return { players, groups };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipStats = process.argv.includes("--skip-stats");
  const skipSeasons = process.argv.includes("--skip-seasons");
  const log = (m: string) => console.log(m);

  const db = createDb();
  log("Public player profile rollout");
  log(dryRun ? "Mode: dry-run (no writes except reads)" : "Mode: apply");

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM players WHERE is_public IS TRUE AND publish_status = 'published') AS public_players,
      (SELECT count(*)::int FROM players p WHERE p.is_public IS TRUE AND p.publish_status = 'published'
        AND EXISTS (SELECT 1 FROM fixture_players fp WHERE fp.player_id = p.id)) AS public_with_apps,
      (SELECT count(*)::int FROM fixtures WHERE season_id IS NULL AND competition_id IS NOT NULL) AS null_season_fixtures,
      (SELECT count(*)::int FROM player_season_stats) AS season_stat_rows
  `);
  log(`Coverage: ${JSON.stringify((counts as unknown as unknown[])[0] ?? counts)}`);

  let seasonAttach = { attached: 0, skipped: 0 };
  if (!skipSeasons) {
    if (dryRun) {
      log("Skipping season writes (dry-run)");
    } else {
      log("Attaching seasons to fixtures…");
      seasonAttach = await attachNullFixtureSeasons(db, log);
      log(`Seasons attached: ${seasonAttach.attached}, unresolved attempts: ${seasonAttach.skipped}`);
    }
  }

  let stats = { buckets: 0, upserted: 0, ranked: 0 };
  if (!skipStats) {
    if (dryRun) {
      const buckets = await db.execute(sql`
        SELECT count(*)::int AS n FROM (
          SELECT 1 FROM player_match_performance_stats
          WHERE season_id IS NOT NULL
          GROUP BY player_id, season_id, team_id
        ) t
      `);
      stats.buckets = Number(((buckets as unknown as Array<{ n: number }>)[0] ?? { n: 0 }).n);
      log(`Would rebuild ~${stats.buckets} season-stat buckets`);
    } else {
      log("Rebuilding player_season_stats…");
      stats = await rebuildSeasonStats(db, log);
      log(
        `Season stats upserted: ${stats.upserted}/${stats.buckets}; seasons ranked: ${stats.ranked}`,
      );
    }
  }

  const transfers = await scanTransfers(db);
  log(
    `Transfer conflicts (CMS review): ${transfers.groups} groups across ${transfers.players} players`,
  );

  const after = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM fixtures WHERE season_id IS NULL AND competition_id IS NOT NULL) AS null_season_fixtures,
      (SELECT count(*)::int FROM player_season_stats) AS season_stat_rows,
      (SELECT count(DISTINCT player_id)::int FROM player_season_stats) AS players_with_season_stats
  `);
  log(`After: ${JSON.stringify((after as unknown as unknown[])[0] ?? after)}`);
  log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
