import { alias } from "drizzle-orm/pg-core";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { getDb } from "./db";

const homeTeam = alias(teams, "fixture_home_team");
const awayTeam = alias(teams, "fixture_away_team");

export type AssignCoachToFixturesResult = {
  fixturesProcessed: number;
  homeUpdated: number;
  awayUpdated: number;
  skipped: number;
  failures: Array<{ fixtureId: string; error: string }>;
};

export async function assignCoachToTeamFixtures(input: {
  teamId: string;
  coachId: string;
  fromDate: string;
  toDate?: string | null;
  dryRun?: boolean;
  /** When false, only fills empty home/away coach slots. */
  overwrite?: boolean;
}): Promise<AssignCoachToFixturesResult> {
  const db = getDb();
  const from = new Date(input.fromDate);
  if (Number.isNaN(from.getTime())) {
    throw new Error(`Invalid fromDate: ${input.fromDate}`);
  }
  const to = input.toDate ? new Date(input.toDate) : null;
  if (to && Number.isNaN(to.getTime())) {
    throw new Error(`Invalid toDate: ${input.toDate}`);
  }

  const dateConditions = [gte(fixtures.kickoffAt, from)];
  if (to) dateConditions.push(lte(fixtures.kickoffAt, to));

  const rows = await db
    .select({
      fixture: fixtures,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
    })
    .from(fixtures)
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .where(
      and(
        ...dateConditions,
        or(eq(fixtures.homeTeamId, input.teamId), eq(fixtures.awayTeamId, input.teamId)),
      ),
    )
    .orderBy(fixtures.kickoffAt);

  const result: AssignCoachToFixturesResult = {
    fixturesProcessed: rows.length,
    homeUpdated: 0,
    awayUpdated: 0,
    skipped: 0,
    failures: [],
  };

  const overwrite = input.overwrite ?? true;

  for (const row of rows) {
    try {
      const patch: Partial<typeof fixtures.$inferInsert> = {};
      const isHome = row.fixture.homeTeamId === input.teamId;
      const isAway = row.fixture.awayTeamId === input.teamId;

      if (isHome && (overwrite || !row.fixture.homeCoachId)) {
        patch.homeCoachId = input.coachId;
        result.homeUpdated += 1;
      }
      if (isAway && (overwrite || !row.fixture.awayCoachId)) {
        patch.awayCoachId = input.coachId;
        result.awayUpdated += 1;
      }

      if (!patch.homeCoachId && !patch.awayCoachId) {
        result.skipped += 1;
        continue;
      }

      if (!input.dryRun) {
        await db.update(fixtures).set(patch).where(eq(fixtures.id, row.fixture.id));
      }
    } catch (error) {
      result.failures.push({
        fixtureId: row.fixture.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
