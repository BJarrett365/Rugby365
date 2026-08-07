/**
 * Fill / repair South Africa team_match_stats by rolling up match_events
 * and player_match_performance_stats. Overwrites empty SDMS shells (all zeros)
 * rather than leaving "0 0 0 0 0" rows on admin Team match statistics.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/sync-sa-team-match-stats-from-events.ts
 */
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  players,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { upsertTeamMatchStat } from "../apps/web/src/lib/team-match-stats-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const PROVIDER = "sa_event_rollup";

function eventBucket(eventType: string | null | undefined): "try" | "conversion" | "penalty" | "drop_goal" | null {
  const t = (eventType ?? "").toLowerCase();
  if (t === "try" || t === "penalty_try") return "try";
  if (t === "conversion") return "conversion";
  if (t === "penalty") return "penalty";
  if (t === "drop_goal" || t === "dropgoal") return "drop_goal";
  return null;
}

function isEmptyShell(row: {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  carries: number;
  metres: number;
  tackles: number;
  turnoversWon: number;
}): boolean {
  return (
    row.tries === 0 &&
    row.conversions === 0 &&
    row.penalties === 0 &&
    row.dropGoals === 0 &&
    row.carries === 0 &&
    row.metres === 0 &&
    row.tackles === 0 &&
    row.turnoversWon === 0
  );
}

/** Prefer advanced SDMS metrics (carries/metres/tackles) over event-only rollups. */
function hasAdvancedSignal(row: { carries: number; metres: number; tackles: number; turnoversWon: number }): boolean {
  return row.carries > 0 || row.metres > 0 || row.tackles > 0 || row.turnoversWon > 0;
}

function numExtra(extras: unknown, key: string): number {
  if (!extras || typeof extras !== "object") return 0;
  const v = (extras as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
}

async function main() {
  const db = getDb();

  const saFixtures = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      externalMatchId: fixtures.externalMatchId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      seasonId: fixtures.seasonId,
      competitionId: fixtures.competitionId,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(
      and(
        or(eq(fixtures.homeTeamId, SA_ID), eq(fixtures.awayTeamId, SA_ID)),
        eq(fixtures.status, "full_time"),
      ),
    );

  const realFixtures = saFixtures.filter((f) => f.homeTeamId && f.awayTeamId);
  const fixtureIds = realFixtures.map((f) => f.id);
  console.log(`SA full-time fixtures: ${realFixtures.length}`);
  if (!fixtureIds.length) return;

  const existing = await db
    .select({
      id: teamMatchStats.id,
      fixtureId: teamMatchStats.fixtureId,
      teamId: teamMatchStats.teamId,
      sourceProvider: teamMatchStats.sourceProvider,
      tries: teamMatchStats.tries,
      conversions: teamMatchStats.conversions,
      penalties: teamMatchStats.penalties,
      dropGoals: teamMatchStats.dropGoals,
      carries: teamMatchStats.carries,
      metres: teamMatchStats.metres,
      tackles: teamMatchStats.tackles,
      turnoversWon: teamMatchStats.turnoversWon,
    })
    .from(teamMatchStats)
    .where(inArray(teamMatchStats.fixtureId, fixtureIds));

  const existingByKey = new Map(existing.map((r) => [`${r.fixtureId}:${r.teamId}`, r]));

  const events = await db
    .select({
      fixtureId: matchEvents.fixtureId,
      teamId: matchEvents.teamId,
      eventType: matchEvents.eventType,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, fixtureIds));

  const eventTeamIds = [...new Set(events.map((e) => e.teamId).filter(Boolean))] as string[];
  const fixtureTeamIds = [
    ...new Set(realFixtures.flatMap((f) => [f.homeTeamId!, f.awayTeamId!])),
  ];
  const allTeamIds = [...new Set([...eventTeamIds, ...fixtureTeamIds])];
  const teamNameRows =
    allTeamIds.length === 0
      ? []
      : await db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, allTeamIds));
  const teamNameById = new Map(teamNameRows.map((t) => [t.id, t.name.trim().toLowerCase()]));
  const fixtureById = new Map(realFixtures.map((f) => [f.id, f]));

  const scoringByFixtureTeam = new Map<
    string,
    { tries: number; conversions: number; penalties: number; dropGoals: number }
  >();
  for (const ev of events) {
    if (!ev.teamId) continue;
    const bucket = eventBucket(ev.eventType);
    if (!bucket) continue;
    const fx = fixtureById.get(ev.fixtureId);
    if (!fx?.homeTeamId || !fx.awayTeamId) continue;

    let scoredTeamId = ev.teamId;
    if (scoredTeamId !== fx.homeTeamId && scoredTeamId !== fx.awayTeamId) {
      const eventName = teamNameById.get(ev.teamId);
      const homeName = teamNameById.get(fx.homeTeamId);
      const awayName = teamNameById.get(fx.awayTeamId);
      if (eventName && eventName === homeName) scoredTeamId = fx.homeTeamId;
      else if (eventName && eventName === awayName) scoredTeamId = fx.awayTeamId;
      else continue;
    }

    const key = `${ev.fixtureId}:${scoredTeamId}`;
    const cur = scoringByFixtureTeam.get(key) ?? {
      tries: 0,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
    };
    if (bucket === "try") cur.tries += 1;
    else if (bucket === "conversion") cur.conversions += 1;
    else if (bucket === "penalty") cur.penalties += 1;
    else cur.dropGoals += 1;
    scoringByFixtureTeam.set(key, cur);
  }

  const playerRows = await db
    .select({
      fixtureId: playerMatchPerformanceStats.fixtureId,
      teamId: playerMatchPerformanceStats.teamId,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      carries: playerMatchPerformanceStats.carries,
      tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      extras: playerMatchPerformanceStats.extras,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .where(inArray(playerMatchPerformanceStats.fixtureId, fixtureIds));

  const advancedByFixtureTeam = new Map<
    string,
    {
      metres: number;
      carries: number;
      tackles: number;
      turnoversWon: number;
      offloads: number;
      cleanBreaks: number;
      defendersBeaten: number;
    }
  >();
  for (const row of playerRows) {
    if (!row.fixtureId) continue;
    const key = `${row.fixtureId}:${row.teamId}`;
    const cur = advancedByFixtureTeam.get(key) ?? {
      metres: 0,
      carries: 0,
      tackles: 0,
      turnoversWon: 0,
      offloads: 0,
      cleanBreaks: 0,
      defendersBeaten: 0,
    };
    cur.metres += row.metresCarried ?? 0;
    cur.carries += row.carries ?? 0;
    cur.tackles += row.tacklesCompleted ?? 0;
    cur.turnoversWon += row.turnoversWon ?? 0;
    cur.offloads += numExtra(row.extras, "offloads");
    cur.cleanBreaks += row.lineBreaks ?? 0;
    cur.defendersBeaten += row.defendersBeaten ?? 0;
    advancedByFixtureTeam.set(key, cur);
  }

  let updatedEmpty = 0;
  let created = 0;
  let skippedRich = 0;
  let skippedNoSignal = 0;

  for (const fx of realFixtures) {
    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? fx.homeTeamId! : fx.awayTeamId!;
      const matchPoints = side === "home" ? (fx.homeScore ?? 0) : (fx.awayScore ?? 0);
      const key = `${fx.id}:${teamId}`;
      const scoring = scoringByFixtureTeam.get(key) ?? {
        tries: 0,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
      };
      const advanced = advancedByFixtureTeam.get(key) ?? {
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        offloads: 0,
        cleanBreaks: 0,
        defendersBeaten: 0,
      };

      const hasSignal =
        scoring.tries +
          scoring.conversions +
          scoring.penalties +
          scoring.dropGoals +
          advanced.carries +
          advanced.metres +
          advanced.tackles +
          advanced.turnoversWon >
        0;
      if (!hasSignal) {
        skippedNoSignal += 1;
        continue;
      }

      const existingRow = existingByKey.get(key);
      // Never overwrite rows that already have advanced SDMS metrics.
      if (existingRow && (hasAdvancedSignal(existingRow) || !isEmptyShell(existingRow))) {
        // Allow fill of scoring-only empty shells; skip anything with non-zero scoring OR advanced.
        if (!isEmptyShell(existingRow)) {
          skippedRich += 1;
          continue;
        }
      }

      const stats = {
        side,
        tries: scoring.tries,
        conversions: scoring.conversions,
        penalties: scoring.penalties,
        dropGoals: scoring.dropGoals,
        carries: advanced.carries,
        metres: advanced.metres,
        tackles: advanced.tackles,
        turnoversWon: advanced.turnoversWon,
        sections: {
          summary: {
            tries: scoring.tries,
            conversions: scoring.conversions,
            penalties: scoring.penalties,
            drop_goals: scoring.dropGoals,
            carries: advanced.carries,
            metres: advanced.metres,
            tackles: advanced.tackles,
            turnovers_won: advanced.turnoversWon,
          },
          scoring: { match_points: matchPoints },
          attack: {
            tries: scoring.tries,
            carries: advanced.carries,
            metres: advanced.metres,
            offloads: advanced.offloads,
            clean_breaks: advanced.cleanBreaks,
            defenders_beaten: advanced.defendersBeaten,
          },
          kicking: {
            conversions: scoring.conversions,
            penalties: scoring.penalties,
            drop_goals: scoring.dropGoals,
          },
          defence: {
            tackles: advanced.tackles,
            turnovers_won: advanced.turnoversWon,
          },
        },
      };

      if (existingRow) {
        // Update empty shell in place. Keep source_provider so SDMS re-import can upsert
        // without colliding on team_match_stats.import_key.
        await db
          .update(teamMatchStats)
          .set({
            tries: stats.tries,
            conversions: stats.conversions,
            penalties: stats.penalties,
            dropGoals: stats.dropGoals,
            carries: stats.carries,
            metres: stats.metres,
            tackles: stats.tackles,
            turnoversWon: stats.turnoversWon,
            sections: stats.sections,
            syncedAt: new Date(),
          })
          .where(eq(teamMatchStats.id, existingRow.id));
        updatedEmpty += 1;
        console.log(`  patched ${fx.slug} ${side} T=${stats.tries} C=${stats.conversions}`);
      } else {
        if (!fx.competitionId) {
          skippedNoSignal += 1;
          continue;
        }
        await upsertTeamMatchStat({
          fixtureId: fx.id,
          teamId,
          side,
          seasonId: fx.seasonId,
          competitionId: fx.competitionId,
          externalMatchId: fx.externalMatchId ?? `fixture:${fx.id}`,
          sourceProvider: PROVIDER,
          stats,
        });
        created += 1;
        console.log(`  created ${fx.slug} ${side} T=${stats.tries}`);
      }
    }
  }

  const coverage = await db.execute(sql`
    select
      (select count(*)::int from fixtures f
        where (f.home_team_id=${SA_ID} or f.away_team_id=${SA_ID}) and f.status='full_time') as ft,
      (select count(distinct tms.fixture_id)::int from team_match_stats tms
        where tms.team_id=${SA_ID} and (tms.tries > 0 or tms.carries > 0 or tms.metres > 0)) as with_signal,
      (select count(distinct tms.fixture_id)::int from team_match_stats tms where tms.team_id=${SA_ID}) as with_row
  `);

  console.log({
    updatedEmpty,
    created,
    skippedRich,
    skippedNoSignal,
    coverage,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
