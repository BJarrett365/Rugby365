/**
 * List Rassie 2018–19 SA matches and coverage gaps.
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/list-rassie-2018-19-coverage.ts
 */
import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import {
  fixtures,
  teams,
  teamMatchStats,
  fixturePlayers,
  playerMatchRatings,
  playerMatchPerformanceStats,
} from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../apps/web/src/lib/db";

const COACH_ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  const db = getDb();
  const [sa] = await db
    .select()
    .from(teams)
    .where(or(eq(teams.slug, "south-africa"), eq(teams.name, "South Africa")))
    .limit(1);
  if (!sa) throw new Error("South Africa team not found");

  const home = alias(teams, "h");
  const away = alias(teams, "a");
  const rows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: home.name,
      awayName: away.name,
      externalMatchId: fixtures.externalMatchId,
      planetRugbyUrl: fixtures.planetRugbyUrl,
    })
    .from(fixtures)
    .leftJoin(home, eq(fixtures.homeTeamId, home.id))
    .leftJoin(away, eq(fixtures.awayTeamId, away.id))
    .where(
      and(
        or(eq(fixtures.homeTeamId, sa.id), eq(fixtures.awayTeamId, sa.id)),
        gte(fixtures.kickoffAt, new Date("2018-03-01T00:00:00Z")),
        lte(fixtures.kickoffAt, new Date("2019-12-31T23:59:59Z")),
      ),
    )
    .orderBy(fixtures.kickoffAt);

  console.log(`SA team ${sa.id} · fixtures ${rows.length}\n`);
  for (const r of rows) {
    const linked = r.homeCoachId === COACH_ID || r.awayCoachId === COACH_ID;
    const [ts] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(teamMatchStats)
      .where(eq(teamMatchStats.fixtureId, r.id));
    const [lp] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(fixturePlayers)
      .where(eq(fixturePlayers.fixtureId, r.id));
    const [pr] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(playerMatchRatings)
      .where(eq(playerMatchRatings.fixtureId, r.id));
    const [perf] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.fixtureId, r.id));
    console.log(
      `${r.kickoffAt?.toISOString().slice(0, 10)} ${r.homeName} ${r.homeScore}-${r.awayScore} ${r.awayName}`,
    );
    console.log(
      `  ${r.competitionName} | linked=${linked} lineups=${lp?.n ?? 0} teamStats=${ts?.n ?? 0} playerPerf=${perf?.n ?? 0} ratings=${pr?.n ?? 0}`,
    );
    console.log(
      `  id=${r.id} ext=${r.externalMatchId ?? "—"} planet=${r.planetRugbyUrl ?? "—"} slug=${r.slug}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
