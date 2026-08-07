/**
 * Estimate advanced player match stats for historical RWC seasons that lack Opta/SDMS
 * tracking (starting with 1987), using modern RWC position priors + official scores/lineups.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/estimate-rwc-historical-player-stats.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/estimate-rwc-historical-player-stats.ts --years=1987
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/estimate-rwc-historical-player-stats.ts --years=1987 --dry-run
 */
import { and, eq, ne, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertMatchPerformanceStat } from "../apps/web/src/lib/player-season-stats-service";
import { isJunkPlayerName } from "../apps/web/src/lib/entity-normalize";
import {
  ERA_INTENSITY_FACTOR,
  ESTIMATOR_METHOD,
  ESTIMATOR_PRIOR_YEARS,
  ESTIMATOR_PROVIDER,
  estimatePlayerMatchStats,
  teamStrengthFromRecord,
  type PositionPrior80,
} from "../apps/web/src/lib/rwc-historical-stat-estimator";

const COMPETITION_SLUG = "rugby-world-cup";
const PROTECTED_PROVIDERS = new Set([
  "sdms",
  "opta_published_leaderboard",
  "wikipedia_statistics",
]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y)) ?? [1987, 1991];

async function loadModernPriors(competitionId: string): Promise<Map<number, PositionPrior80>> {
  const db = getDb();
  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));
  const modernIds = seasons
    .filter((s) => s.year != null && ESTIMATOR_PRIOR_YEARS.includes(s.year as (typeof ESTIMATOR_PRIOR_YEARS)[number]))
    .map((s) => s.id);
  if (!modernIds.length) {
    console.warn("No modern RWC seasons found for priors; using fallback jersey tables only.");
    return new Map();
  }

  const rows = await db.execute(sql`
    with base as (
      select
        case
          when fp.jersey_number between 1 and 15 then fp.jersey_number
          else null
        end as jersey,
        pms.tackles_completed,
        pms.metres_carried,
        pms.carries,
        pms.line_breaks,
        pms.defenders_beaten,
        pms.turnovers_won,
        pms.try_assists,
        pms.dominant_tackles,
        pms.post_contact_metres,
        pms.touches,
        greatest(pms.minutes_played, 1) as minutes_played
      from player_match_performance_stats pms
      join fixtures f on f.id = pms.fixture_id
      left join fixture_players fp
        on fp.fixture_id = pms.fixture_id and fp.player_id = pms.player_id
      where f.season_id in ${sql`(${sql.join(
        modernIds.map((id) => sql`${id}`),
        sql`, `,
      )})`}
        and pms.source_provider not in (
          ${ESTIMATOR_PROVIDER},
          'opta_published_leaderboard',
          'wikipedia_statistics',
          'fixture_players'
        )
        and (coalesce(pms.tackles_completed, 0) + coalesce(pms.metres_carried, 0) + coalesce(pms.carries, 0)) > 0
        and coalesce(pms.minutes_played, 0) >= 20
    )
    select
      jersey,
      count(*)::int as n,
      avg(tackles_completed * 80.0 / minutes_played)::float as tackles,
      avg(metres_carried * 80.0 / minutes_played)::float as metres,
      avg(carries * 80.0 / minutes_played)::float as carries,
      avg(line_breaks * 80.0 / minutes_played)::float as line_breaks,
      avg(defenders_beaten * 80.0 / minutes_played)::float as defenders_beaten,
      avg(turnovers_won * 80.0 / minutes_played)::float as turnovers_won,
      avg(try_assists * 80.0 / minutes_played)::float as try_assists,
      avg(dominant_tackles * 80.0 / minutes_played)::float as dominant_tackles,
      avg(post_contact_metres * 80.0 / minutes_played)::float as post_contact_metres,
      avg(touches * 80.0 / minutes_played)::float as touches
    from base
    where jersey between 1 and 15
    group by jersey
    order by jersey
  `);

  const map = new Map<number, PositionPrior80>();
  for (const row of ((rows as { rows?: Array<Record<string, unknown>> }).rows ??
    (rows as Array<Record<string, unknown>>)) as Array<Record<string, unknown>>) {
    const jersey = Number(row.jersey);
    if (!Number.isFinite(jersey)) continue;
    map.set(jersey, {
      jersey,
      sampleSize: Number(row.n) || 0,
      tackles: Number(row.tackles) || 0,
      metres: Number(row.metres) || 0,
      carries: Number(row.carries) || 0,
      lineBreaks: Number(row.line_breaks) || 0,
      defendersBeaten: Number(row.defenders_beaten) || 0,
      turnoversWon: Number(row.turnovers_won) || 0,
      tryAssists: Number(row.try_assists) || 0,
      dominantTackles: Number(row.dominant_tackles) || 0,
      postContactMetres: Number(row.post_contact_metres) || 0,
      touches: Number(row.touches) || 0,
    });
  }
  return map;
}

type TeamRecord = { pf: number; pa: number; matches: number };

function advancedIsAuthoritative(existing: {
  sourceProvider: string;
  tacklesCompleted: number;
  metresCarried: number;
  carries: number;
} | null) {
  if (!existing) return false;
  if (PROTECTED_PROVIDERS.has(existing.sourceProvider)) return true;
  // Prefer Opta/SDMS-style data already present for advanced boards.
  if (
    existing.sourceProvider !== ESTIMATOR_PROVIDER &&
    existing.sourceProvider !== "fixture_players" &&
    (existing.tacklesCompleted > 0 || existing.metresCarried > 0 || existing.carries > 0)
  ) {
    return true;
  }
  return false;
}

type OptaOverlay = {
  metresCarried: boolean;
  carries: boolean;
  tacklesCompleted: boolean;
  lineBreaks: boolean;
  tryAssists: boolean;
  defendersBeaten: boolean;
  turnoversWon: boolean;
};

async function loadOptaOverlays(seasonId: string) {
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerMatchPerformanceStats.playerId,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      carries: playerMatchPerformanceStats.carries,
      tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      tryAssists: playerMatchPerformanceStats.tryAssists,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(fixtures, eq(fixtures.id, playerMatchPerformanceStats.fixtureId))
    .where(
      and(
        eq(playerMatchPerformanceStats.seasonId, seasonId),
        eq(playerMatchPerformanceStats.sourceProvider, "opta_published_leaderboard"),
        eq(fixtures.stage, "stats_seed"),
      ),
    );

  const map = new Map<string, OptaOverlay>();
  for (const row of rows) {
    const prev = map.get(row.playerId) ?? {
      metresCarried: false,
      carries: false,
      tacklesCompleted: false,
      lineBreaks: false,
      tryAssists: false,
      defendersBeaten: false,
      turnoversWon: false,
    };
    if ((row.metresCarried ?? 0) > 0) prev.metresCarried = true;
    if ((row.carries ?? 0) > 0) prev.carries = true;
    if ((row.tacklesCompleted ?? 0) > 0) prev.tacklesCompleted = true;
    if ((row.lineBreaks ?? 0) > 0) prev.lineBreaks = true;
    if ((row.tryAssists ?? 0) > 0) prev.tryAssists = true;
    if ((row.defendersBeaten ?? 0) > 0) prev.defendersBeaten = true;
    if ((row.turnoversWon ?? 0) > 0) prev.turnoversWon = true;
    map.set(row.playerId, prev);
  }
  return map;
}

async function estimateSeason(input: {
  competitionId: string;
  seasonId: string;
  year: number;
  priors: Map<number, PositionPrior80>;
}) {
  const db = getDb();
  const optaOverlays = await loadOptaOverlays(input.seasonId);
  const seasonFixtures = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      stage: fixtures.stage,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.seasonId, input.seasonId),
        eq(fixtures.competitionId, input.competitionId),
        ne(fixtures.stage, "stats_seed"),
      ),
    );

  const teamRecords = new Map<string, TeamRecord>();
  for (const fx of seasonFixtures) {
    if (fx.homeScore == null || fx.awayScore == null) continue;
    if (!fx.homeTeamId || !fx.awayTeamId) continue;
    for (const [teamId, pf, pa] of [
      [fx.homeTeamId, fx.homeScore, fx.awayScore],
      [fx.awayTeamId, fx.awayScore, fx.homeScore],
    ] as const) {
      const rec = teamRecords.get(teamId) ?? { pf: 0, pa: 0, matches: 0 };
      rec.pf += pf;
      rec.pa += pa;
      rec.matches += 1;
      teamRecords.set(teamId, rec);
    }
  }

  const strength = new Map<string, number>();
  for (const [teamId, rec] of teamRecords) {
    strength.set(teamId, teamStrengthFromRecord(rec.pf, rec.pa, rec.matches));
  }

  let upserted = 0;
  let skipped = 0;
  let drySamples: Array<Record<string, unknown>> = [];

  for (const fx of seasonFixtures) {
    if (!fx.homeTeamId || !fx.awayTeamId || fx.homeScore == null || fx.awayScore == null) {
      skipped += 1;
      continue;
    }

    const squad = await db
      .select({
        playerId: fixturePlayers.playerId,
        playerName: players.name,
        teamId: fixturePlayers.teamId,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
        positionName: fixturePlayers.positionName,
        tries: fixturePlayers.tries,
        conversions: fixturePlayers.conversions,
        penalties: fixturePlayers.penalties,
        dropGoals: fixturePlayers.dropGoals,
        points: fixturePlayers.points,
      })
      .from(fixturePlayers)
      .innerJoin(players, eq(fixturePlayers.playerId, players.id))
      .where(eq(fixturePlayers.fixtureId, fx.id));

    if (squad.length < 8) {
      skipped += 1;
      continue;
    }

    const existingRows = await db
      .select()
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.fixtureId, fx.id));
    const existingByPlayer = new Map(existingRows.map((r) => [r.playerId, r]));

    for (const row of squad) {
      if (isJunkPlayerName(row.playerName)) {
        skipped += 1;
        continue;
      }
      const existing = existingByPlayer.get(row.playerId) ?? null;
      if (advancedIsAuthoritative(existing)) {
        skipped += 1;
        continue;
      }

      const teamScore = row.teamId === fx.homeTeamId ? fx.homeScore : fx.awayScore;
      const oppScore = row.teamId === fx.homeTeamId ? fx.awayScore : fx.homeScore;
      const oppTeamId = row.teamId === fx.homeTeamId ? fx.awayTeamId : fx.homeTeamId;

      const estimated = estimatePlayerMatchStats(
        {
          jerseyNumber: row.jerseyNumber,
          positionName: row.positionName,
          squadRole: row.squadRole,
          tries: row.tries ?? 0,
          conversions: row.conversions ?? 0,
          penalties: row.penalties ?? 0,
          dropGoals: row.dropGoals ?? 0,
          points: row.points ?? 0,
          teamScore,
          oppositionScore: oppScore,
          teamStrength: strength.get(row.teamId) ?? 1,
          oppositionStrength: strength.get(oppTeamId) ?? 1,
          minutesPlayed: existing?.minutesPlayed && existing.minutesPlayed > 0 ? existing.minutesPlayed : null,
        },
        input.priors,
        { eraFactor: ERA_INTENSITY_FACTOR },
      );

      // Keep published Opta tournament totals on the void seed fixture; do not add
      // estimated match-level values for those (player, metric) pairs.
      const overlay = optaOverlays.get(row.playerId);
      const metresCarried = overlay?.metresCarried ? 0 : estimated.metresCarried;
      const carries = overlay?.carries ? 0 : estimated.carries;
      const tacklesCompleted = overlay?.tacklesCompleted ? 0 : estimated.tacklesCompleted;
      const tacklesMade = overlay?.tacklesCompleted ? 0 : estimated.tacklesMade;
      const lineBreaks = overlay?.lineBreaks ? 0 : estimated.lineBreaks;
      const tryAssists = overlay?.tryAssists ? 0 : estimated.tryAssists;
      const defendersBeaten = overlay?.defendersBeaten ? 0 : estimated.defendersBeaten;
      const turnoversWon = overlay?.turnoversWon ? 0 : estimated.turnoversWon;

      const tries = Math.max(existing?.tries ?? 0, row.tries ?? 0);
      const points = Math.max(existing?.points ?? 0, row.points ?? 0);

      if (dryRun) {
        if (drySamples.length < 8) {
          const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, row.teamId)).limit(1);
          drySamples.push({
            fixtureId: fx.id,
            team: team?.name,
            jersey: estimated.jerseyUsed,
            tackles: tacklesCompleted,
            metres: metresCarried,
            carries,
            confidence: estimated.confidence,
            reasoning: estimated.reasoning,
          });
        }
        upserted += 1;
        continue;
      }

      const externalMatchId = fx.externalMatchId ?? `rwc-estimate:${fx.id}`;
      await upsertMatchPerformanceStat({
        fixtureId: fx.id,
        playerId: row.playerId,
        teamId: row.teamId,
        seasonId: input.seasonId,
        competitionId: input.competitionId,
        externalMatchId,
        externalPlayerId: row.playerId,
        sourceProvider: ESTIMATOR_PROVIDER,
        skipBioRefresh: true,
        stats: {
          minutesPlayed: estimated.minutesPlayed,
          tries,
          points,
          carries,
          metresCarried,
          tacklesMade,
          tacklesCompleted,
          dominantTackles: estimated.dominantTackles,
          turnoversWon,
          tryAssists,
          lineBreaks,
          defendersBeaten,
          touches: estimated.touches,
          postContactMetres: estimated.postContactMetres,
          ruckArrivalEffectiveness: 0,
          passes: estimated.passes,
          offloads: estimated.offloads,
          kicks: estimated.kicks,
          kicksFromHand: estimated.kicksFromHand,
          kickFromHandMetres: 0,
          kickPossessionRetained: 0,
          missedTackles: 0,
          badPasses: 0,
          droppedCatch: 0,
          handlingError: 0,
          turnoversConceded: 0,
          runs: carries,
          gainLine: Math.round(carries * 0.45),
          carriesMetres: metresCarried,
          carriesCrossedGainLine: Math.round(carries * 0.45),
          carriesNotMadeGainLine: Math.max(0, carries - Math.round(carries * 0.45)),
          gapFilled: true,
        },
      });

      // Attach estimation metadata (upsert extras don't currently accept nested estimation blob).
      const [updated] = await db
        .select({ id: playerMatchPerformanceStats.id, extras: playerMatchPerformanceStats.extras })
        .from(playerMatchPerformanceStats)
        .where(
          and(
            eq(playerMatchPerformanceStats.fixtureId, fx.id),
            eq(playerMatchPerformanceStats.playerId, row.playerId),
          ),
        )
        .limit(1);
      if (updated) {
        const prev =
          updated.extras && typeof updated.extras === "object" && !Array.isArray(updated.extras)
            ? (updated.extras as Record<string, unknown>)
            : {};
        await db
          .update(playerMatchPerformanceStats)
          .set({
            extras: {
              ...prev,
              lineoutTakes: estimated.lineoutTakes,
              scrumInvolvements: estimated.scrumInvolvements,
              estimated: true,
              estimation: {
                method: ESTIMATOR_METHOD,
                confidence: estimated.confidence,
                confidenceByMetric: estimated.confidenceByMetric,
                reasoning: estimated.reasoning,
                priorsFrom: [...ESTIMATOR_PRIOR_YEARS],
                eraFactor: ERA_INTENSITY_FACTOR,
                jerseyUsed: estimated.jerseyUsed,
              },
            },
            syncedAt: new Date(),
          })
          .where(eq(playerMatchPerformanceStats.id, updated.id));
      }

      upserted += 1;
    }
  }

  return { fixtures: seasonFixtures.length, upserted, skipped, drySamples };
}

async function main() {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup not found");

  console.log(
    `Loading modern RWC priors from ${ESTIMATOR_PRIOR_YEARS.join(", ")} (era×${ERA_INTENSITY_FACTOR})…`,
  );
  const priors = await loadModernPriors(competition.id);
  console.log(`Priors loaded for jerseys: ${[...priors.keys()].sort((a, b) => a - b).join(", ") || "(fallback only)"}`);

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id));
  const selected = seasons
    .filter((s) => s.year != null && onlyYears.includes(s.year))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  if (!selected.length) {
    throw new Error(`No seasons found for years ${onlyYears.join(",")}`);
  }

  for (const season of selected) {
    console.log(`${dryRun ? "[dry-run] " : ""}Estimating ${season.year} (${season.label})…`);
    const result = await estimateSeason({
      competitionId: competition.id,
      seasonId: season.id,
      year: season.year!,
      priors,
    });
    console.log(
      `  ${season.year}: fixtures=${result.fixtures} upserted=${result.upserted} skipped=${result.skipped}`,
    );
    if (result.drySamples.length) {
      console.log("  sample:", JSON.stringify(result.drySamples, null, 2));
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
