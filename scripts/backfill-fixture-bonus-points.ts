/**
 * Backfill try / losing bonus points onto completed fixtures (no Next server-only).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/backfill-fixture-bonus-points.ts [--force] [--limit=6000]
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  createDb,
  fixtures,
  matchEvents,
  teamMatchStats,
  teams,
  coaches,
  teamCoachingStaff,
} from "@rugby365/db";
import { computeMatchBonusPoints } from "../apps/web/src/lib/match-bonus-points";
import { scoringRulesForCompetitionSlug } from "../apps/web/src/lib/table-lab/competition-scoring-rules-catalog";
import { stripTeamSponsorAndSeasonLabels, teamDedupKey } from "../apps/web/src/lib/entity-normalize";

const COMPLETED = ["full_time", "completed", "ft", "final", "result"] as const;

async function sideTries(
  db: ReturnType<typeof createDb>,
  fixtureId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
) {
  const stats = await db
    .select({ side: teamMatchStats.side, tries: teamMatchStats.tries })
    .from(teamMatchStats)
    .where(eq(teamMatchStats.fixtureId, fixtureId));
  let homeTries = stats.find((r) => r.side === "home")?.tries ?? null;
  let awayTries = stats.find((r) => r.side === "away")?.tries ?? null;
  if (homeTries != null && awayTries != null) return { homeTries, awayTries };

  const events = await db
    .select({ teamId: matchEvents.teamId, eventType: matchEvents.eventType })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId));
  let homeFromEvents = 0;
  let awayFromEvents = 0;
  let counted = 0;
  for (const ev of events) {
    if (!/\btry\b|penalty_try|penalty[\s_-]?try/i.test(ev.eventType)) continue;
    counted += 1;
    if (homeTeamId && ev.teamId === homeTeamId) homeFromEvents += 1;
    else if (awayTeamId && ev.teamId === awayTeamId) awayFromEvents += 1;
  }
  if (counted > 0) {
    return {
      homeTries: homeTries ?? homeFromEvents,
      awayTries: awayTries ?? awayFromEvents,
    };
  }
  return { homeTries, awayTries };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureStormersCoach(db: ReturnType<typeof createDb>, fixtureId: string) {
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture?.awayTeamId) return null;

  const [awayTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, fixture.awayTeamId))
    .limit(1);
  if (!awayTeam) return null;

  const core = stripTeamSponsorAndSeasonLabels(awayTeam.name).toLowerCase();
  if (!core.includes("stormers")) return null;

  let [coach] = await db
    .select()
    .from(coaches)
    .where(sql`lower(${coaches.name}) = 'john dobson'`)
    .limit(1);
  if (!coach) {
    const id = randomUUID();
    const slug = `john-dobson-${id.slice(0, 8)}`;
    const [created] = await db
      .insert(coaches)
      .values({
        id,
        name: "John Dobson",
        slug,
        nationality: "South Africa",
        wikipediaUrl: "https://en.wikipedia.org/wiki/John_Dobson_(rugby_union)",
      })
      .returning();
    coach = created!;
  }

  const clubKey = teamDedupKey(awayTeam.name);
  const clubTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(sql`lower(${teams.name}) like '%stormers%'`)
    .limit(40);

  for (const t of clubTeams) {
    if (teamDedupKey(t.name) !== clubKey && t.id !== awayTeam.id) continue;
    const [existing] = await db
      .select()
      .from(teamCoachingStaff)
      .where(
        and(
          eq(teamCoachingStaff.teamId, t.id),
          eq(teamCoachingStaff.coachId, coach.id),
          eq(teamCoachingStaff.role, "head_coach"),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(teamCoachingStaff)
        .set({ isCurrent: true, updatedAt: new Date() })
        .where(eq(teamCoachingStaff.id, existing.id));
    } else {
      await db.insert(teamCoachingStaff).values({
        coachId: coach.id,
        teamId: t.id,
        role: "head_coach",
        isCurrent: true,
        importKey: `match-header-default:${t.id}:head_coach`,
      });
    }
  }

  await db.update(fixtures).set({ awayCoachId: coach.id }).where(eq(fixtures.id, fixtureId));
  return { coachId: coach.id, team: awayTeam.name, slug: slugify(awayTeam.name) };
}

async function main() {
  const force = process.argv.includes("--force");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 6000;
  const db = createDb();

  const boland = "02ff60f7-62df-444c-bce1-13f8435ed86d";
  console.log("Stormers coach →", await ensureStormersCoach(db, boland));

  const rows = await db
    .select()
    .from(fixtures)
    .where(
      and(
        or(
          inArray(fixtures.status, [...COMPLETED]),
          sql`lower(${fixtures.status}) like '%full%time%'`,
          sql`lower(${fixtures.status}) like '%complete%'`,
        ),
        force ? sql`true` : isNull(fixtures.bonusPointsComputedAt),
      ),
    )
    .limit(limit);

  let updated = 0;
  const rules = scoringRulesForCompetitionSlug("currie-cup");
  for (const fixture of rows) {
    const { homeTries, awayTries } = await sideTries(
      db,
      fixture.id,
      fixture.homeTeamId,
      fixture.awayTeamId,
    );
    const bonus = computeMatchBonusPoints({
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeTries,
      awayTries,
      rules,
    });
    await db
      .update(fixtures)
      .set({
        homeTryBonusPoints: bonus.homeTryBonusPoints,
        awayTryBonusPoints: bonus.awayTryBonusPoints,
        homeLosingBonusPoints: bonus.homeLosingBonusPoints,
        awayLosingBonusPoints: bonus.awayLosingBonusPoints,
        bonusPointsComputedAt: new Date(),
      })
      .where(eq(fixtures.id, fixture.id));
    updated += 1;
    if (updated % 250 === 0) console.log(`… ${updated}/${rows.length}`);
  }

  const [check] = await db.select().from(fixtures).where(eq(fixtures.id, boland)).limit(1);
  console.log("Boland fixture bonus/coach", {
    awayCoachId: check?.awayCoachId,
    homeTry: check?.homeTryBonusPoints,
    awayTry: check?.awayTryBonusPoints,
    homeLosing: check?.homeLosingBonusPoints,
    awayLosing: check?.awayLosingBonusPoints,
  });
  console.log(`Backfill complete: ${updated} fixtures`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
