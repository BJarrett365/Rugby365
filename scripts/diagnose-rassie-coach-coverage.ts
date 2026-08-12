/**
 * Diagnose Rassie Erasmus coach data coverage vs SA tenures.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/diagnose-rassie-coach-coverage.ts
 */
import { and, eq, gte, lte, or, sql, inArray } from "drizzle-orm";
import {
  coaches,
  fixtures,
  teamCoachingStaff,
  teams,
  teamMatchStats,
  fixturePlayers,
  playerMatchRatings,
  coachRatingHistory,
  coachRatingSnapshots,
  worldRankingSnapshots,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const COACH_ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";

const COMPLETED = new Set(["completed", "finished", "result", "full_time", "ft"]);

function isCompleted(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().replace(/\s+/g, "_");
  return COMPLETED.has(s) || s.includes("complete") || s.includes("finished");
}

async function main() {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.id, COACH_ID)).limit(1);
  if (!coach) {
    console.error("Rassie not found");
    process.exit(1);
  }

  const assignments = await db
    .select({
      a: teamCoachingStaff,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(teamCoachingStaff)
    .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
    .where(eq(teamCoachingStaff.coachId, COACH_ID));

  console.log("=== COACH ===");
  console.log(`${coach.name} (${coach.slug})`);
  console.log("");

  console.log("=== ASSIGNMENTS ===");
  for (const row of assignments) {
    console.log(
      `${row.a.startDate ?? "?"}–${row.a.endDate ?? (row.a.isCurrent ? "" : "?")} | ${row.teamName} | ${row.a.role} | current=${row.a.isCurrent} | eligible=${row.a.eligibleForCareerRecord} | status=${row.a.recordStatus}`,
    );
  }

  const sa = assignments.find(
    (r) =>
      r.teamSlug.includes("south-africa") ||
      r.teamName.toLowerCase() === "south africa" ||
      r.teamName.toLowerCase().includes("springbok"),
  );
  if (!sa) {
    console.log("\nNo South Africa team assignment found — listing team IDs:");
    for (const row of assignments) {
      console.log(`  ${row.a.teamId} ${row.teamName} (${row.teamSlug})`);
    }
  }

  const saTeamId =
    sa?.a.teamId ??
    (
      await db
        .select()
        .from(teams)
        .where(or(eq(teams.slug, "south-africa"), eq(teams.name, "South Africa")))
        .limit(1)
    )[0]?.id;

  if (!saTeamId) {
    console.error("South Africa team not found");
    process.exit(1);
  }

  const saTenures = assignments.filter((r) => r.a.teamId === saTeamId);
  console.log("\n=== SA TENURES FOR MATCH LOOKUP ===");
  for (const t of saTenures) {
    console.log(
      `${t.a.role} ${t.a.startDate}–${t.a.endDate ?? "present"} eligible=${t.a.eligibleForCareerRecord}`,
    );
  }

  // Windows of interest from user: 2018–2019 head coach, 2024–
  const windows = [
    { label: "2018–2019", from: "2018-01-01", to: "2019-12-31" },
    { label: "2024–", from: "2024-01-01", to: null as string | null },
  ];

  async function countWindow(from: string, to: string | null) {
    const conditions = [
      or(eq(fixtures.homeTeamId, saTeamId), eq(fixtures.awayTeamId, saTeamId)),
      gte(fixtures.kickoffAt, new Date(from)),
    ];
    if (to) conditions.push(lte(fixtures.kickoffAt, new Date(to)));

    const rows = await db
      .select({
        id: fixtures.id,
        status: fixtures.status,
        kickoffAt: fixtures.kickoffAt,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
        homeCoachId: fixtures.homeCoachId,
        awayCoachId: fixtures.awayCoachId,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
      })
      .from(fixtures)
      .where(and(...conditions));

    const completed = rows.filter(
      (r) => isCompleted(r.status) && r.homeScore != null && r.awayScore != null,
    );
    const linked = completed.filter(
      (r) => r.homeCoachId === COACH_ID || r.awayCoachId === COACH_ID,
    );
    const ids = completed.map((r) => r.id);
    const linkedIds = linked.map((r) => r.id);

    let lineups = 0;
    let teamStats = 0;
    let playerRatings = 0;
    if (ids.length) {
      const [lu] = await db
        .select({ n: sql<number>`count(distinct ${fixturePlayers.fixtureId})::int` })
        .from(fixturePlayers)
        .where(inArray(fixturePlayers.fixtureId, ids));
      lineups = lu?.n ?? 0;

      const [ts] = await db
        .select({ n: sql<number>`count(distinct ${teamMatchStats.fixtureId})::int` })
        .from(teamMatchStats)
        .where(inArray(teamMatchStats.fixtureId, ids));
      teamStats = ts?.n ?? 0;

      const [pr] = await db
        .select({ n: sql<number>`count(distinct ${playerMatchRatings.fixtureId})::int` })
        .from(playerMatchRatings)
        .where(inArray(playerMatchRatings.fixtureId, ids));
      playerRatings = pr?.n ?? 0;
    }

    let linkedLineups = 0;
    let linkedTeamStats = 0;
    let linkedPlayerRatings = 0;
    if (linkedIds.length) {
      const [lu] = await db
        .select({ n: sql<number>`count(distinct ${fixturePlayers.fixtureId})::int` })
        .from(fixturePlayers)
        .where(inArray(fixturePlayers.fixtureId, linkedIds));
      linkedLineups = lu?.n ?? 0;
      const [ts] = await db
        .select({ n: sql<number>`count(distinct ${teamMatchStats.fixtureId})::int` })
        .from(teamMatchStats)
        .where(inArray(teamMatchStats.fixtureId, linkedIds));
      linkedTeamStats = ts?.n ?? 0;
      const [pr] = await db
        .select({ n: sql<number>`count(distinct ${playerMatchRatings.fixtureId})::int` })
        .from(playerMatchRatings)
        .where(inArray(playerMatchRatings.fixtureId, linkedIds));
      linkedPlayerRatings = pr?.n ?? 0;
    }

    return {
      totalFixtures: rows.length,
      completed: completed.length,
      linked: linked.length,
      lineups,
      teamStats,
      playerRatings,
      linkedLineups,
      linkedTeamStats,
      linkedPlayerRatings,
    };
  }

  console.log("\n=== SA MATCH COVERAGE BY WINDOW ===");
  for (const w of windows) {
    const c = await countWindow(w.from, w.to);
    console.log(`\n${w.label}`);
    console.log(`  SA fixtures in window: ${c.totalFixtures}`);
    console.log(`  Completed with scores: ${c.completed}`);
    console.log(`  Linked to Rassie (FK): ${c.linked}`);
    console.log(`  With lineups (all completed): ${c.lineups} / ${c.completed}`);
    console.log(`  With team stats: ${c.teamStats} / ${c.completed}`);
    console.log(`  With player ratings: ${c.playerRatings} / ${c.completed}`);
    console.log(`  Linked+lineups: ${c.linkedLineups}`);
    console.log(`  Linked+team stats: ${c.linkedTeamStats}`);
    console.log(`  Linked+player ratings: ${c.linkedPlayerRatings}`);
  }

  // All linked matches for coach
  const linkedAll = await db
    .select({ id: fixtures.id, status: fixtures.status, kickoffAt: fixtures.kickoffAt })
    .from(fixtures)
    .where(or(eq(fixtures.homeCoachId, COACH_ID), eq(fixtures.awayCoachId, COACH_ID)));
  const linkedCompleted = linkedAll.filter((r) => isCompleted(r.status));

  const [hist] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.coachId, COACH_ID));
  const [snaps] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(coachRatingSnapshots)
    .where(eq(coachRatingSnapshots.coachId, COACH_ID));
  const [wr] = await db.select({ n: sql<number>`count(*)::int` }).from(worldRankingSnapshots);

  // Upcoming SA fixtures
  const upcoming = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
    })
    .from(fixtures)
    .where(
      and(
        or(eq(fixtures.homeTeamId, saTeamId), eq(fixtures.awayTeamId, saTeamId)),
        gte(fixtures.kickoffAt, new Date()),
      ),
    )
    .orderBy(fixtures.kickoffAt)
    .limit(5);

  const current = saTenures.find((t) => t.a.isCurrent);

  console.log("\n=== GLOBAL COACH LINKS ===");
  console.log(`All fixtures with Rassie FK: ${linkedAll.length}`);
  console.log(`Completed among those: ${linkedCompleted.length}`);
  console.log(`Coach rating history rows: ${hist?.n ?? 0}`);
  console.log(`Coach rating snapshots: ${snaps?.n ?? 0}`);
  console.log(`World ranking snapshots (all): ${wr?.n ?? 0}`);
  console.log(`Current SA assignment: ${current ? `${current.a.role} from ${current.a.startDate}` : "NONE"}`);
  console.log(`Upcoming SA fixtures: ${upcoming.length}`);
  for (const u of upcoming) {
    console.log(
      `  ${u.kickoffAt?.toISOString() ?? "?"} status=${u.status} homeCoach=${u.homeCoachId === COACH_ID} awayCoach=${u.awayCoachId === COACH_ID}`,
    );
  }

  console.log("\n=== BLANK CARD REASONS (EXPECTED) ===");
  console.log(
    `Rating Trends: needs >=2 coach_rating_history rows (have ${hist?.n ?? 0}) — persist snapshots after recalc`,
  );
  console.log(
    `Selection Stability: UI hardcoded empty — needs lineup-derived service (linked lineups: check above)`,
  );
  console.log(
    `Player Development: UI hardcoded empty — needs player_match_ratings under tenure`,
  );
  console.log(
    `Recent Results: needs completed fixtures with home/awayCoachId = Rassie (linked completed: ${linkedCompleted.length})`,
  );
  console.log(
    `Upcoming Match: needs current team + future fixture (upcoming SA: ${upcoming.length}, current: ${Boolean(current)})`,
  );
  console.log(
    `World Rankings: needs coach_rating_snapshots across coaches (Rassie snaps: ${snaps?.n ?? 0})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
