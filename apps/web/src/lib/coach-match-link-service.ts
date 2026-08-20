/**
 * Link fixtures to coaches from eligible career tenures (team + start/end).
 * Does not invent matches — only stamps homeCoachId/awayCoachId from Rugby365 fixtures.
 */

import { eq, sql } from "drizzle-orm";
import { fixtures, teamCoachingStaff } from "@rugby365/db";
import { getDb } from "./db";
import { getCoachDetail } from "./coach-admin-service";
import { assignCoachToTeamFixtures } from "./assign-coaches-to-fixtures-service";
import { isRoleEligibleForCareerRecord } from "./coach-role-eligibility";

export type RefreshCoachMatchLinksResult = {
  coachId: string;
  tenuresProcessed: number;
  fixturesProcessed: number;
  homeUpdated: number;
  awayUpdated: number;
  skipped: number;
  failures: Array<{ fixtureId?: string; tenureId?: string; error: string }>;
};

export async function refreshCoachMatchLinks(
  coachId: string,
  options: { dryRun?: boolean; overwrite?: boolean } = {},
): Promise<RefreshCoachMatchLinksResult> {
  const detail = await getCoachDetail(coachId);
  if (!detail) throw new Error("Coach not found");

  const result: RefreshCoachMatchLinksResult = {
    coachId,
    tenuresProcessed: 0,
    fixturesProcessed: 0,
    homeUpdated: 0,
    awayUpdated: 0,
    skipped: 0,
    failures: [],
  };

  const eligible = detail.assignments.filter((a) =>
    isRoleEligibleForCareerRecord({
      role: a.role,
      eligibleForCareerRecord: a.eligibleForCareerRecord,
      isPrimaryCoach: a.isPrimaryCoach,
    }),
  );

  for (const tenure of eligible) {
    if (!tenure.startDate && !tenure.isCurrent) {
      result.failures.push({
        tenureId: tenure.id,
        error: "Tenure has no startDate — skipped",
      });
      continue;
    }
    const fromDate = tenure.startDate ?? "1900-01-01";
    const toDate = tenure.endDate ?? null;
    result.tenuresProcessed += 1;
    try {
      const assign = await assignCoachToTeamFixtures({
        teamId: tenure.teamId,
        coachId,
        fromDate,
        toDate,
        dryRun: options.dryRun,
        overwrite: options.overwrite ?? true,
      });
      result.fixturesProcessed += assign.fixturesProcessed;
      result.homeUpdated += assign.homeUpdated;
      result.awayUpdated += assign.awayUpdated;
      result.skipped += assign.skipped;
      result.failures.push(
        ...assign.failures.map((f) => ({ fixtureId: f.fixtureId, error: f.error })),
      );
    } catch (e) {
      result.failures.push({
        tenureId: tenure.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

/** Coaches whose eligible tenure covers a fixture kickoff for that team. */
export async function findCoachesForFixtureTeamDate(input: {
  teamId: string;
  kickoffAt: Date;
}): Promise<string[]> {
  const db = getDb();
  const kickDate = input.kickoffAt.toISOString().slice(0, 10);
  const rows = await db
    .select({
      coachId: teamCoachingStaff.coachId,
      role: teamCoachingStaff.role,
      eligibleForCareerRecord: teamCoachingStaff.eligibleForCareerRecord,
      isPrimaryCoach: teamCoachingStaff.isPrimaryCoach,
      startDate: teamCoachingStaff.startDate,
      endDate: teamCoachingStaff.endDate,
    })
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.teamId, input.teamId));

  const out = new Set<string>();
  for (const row of rows) {
    if (
      !isRoleEligibleForCareerRecord({
        role: row.role,
        eligibleForCareerRecord: row.eligibleForCareerRecord,
        isPrimaryCoach: row.isPrimaryCoach,
      })
    ) {
      continue;
    }
    if (row.startDate && row.startDate > kickDate) continue;
    if (row.endDate && row.endDate < kickDate) continue;
    out.add(row.coachId);
  }
  return [...out];
}

export async function findCoachesAffectedByFixture(fixtureId: string): Promise<string[]> {
  const db = getDb();
  const [fx] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fx?.kickoffAt) return [];
  const ids = new Set<string>();
  if (fx.homeTeamId) {
    for (const id of await findCoachesForFixtureTeamDate({
      teamId: fx.homeTeamId,
      kickoffAt: fx.kickoffAt,
    })) {
      ids.add(id);
    }
  }
  if (fx.awayTeamId) {
    for (const id of await findCoachesForFixtureTeamDate({
      teamId: fx.awayTeamId,
      kickoffAt: fx.kickoffAt,
    })) {
      ids.add(id);
    }
  }
  if (fx.homeCoachId) ids.add(fx.homeCoachId);
  if (fx.awayCoachId) ids.add(fx.awayCoachId);
  return [...ids];
}

/** Mark coaches stale when underlying match data changes (batch-friendly). */
export async function markCoachesStale(coachIds: string[], reason: string): Promise<number> {
  if (coachIds.length === 0) return 0;
  const db = getDb();
  // calc_status columns added in migration 0071 — soft-fail if missing until migrated
  try {
    await db.execute(sql`
      update coaches
      set calc_status = 'stale',
          calc_stale_reason = ${reason},
          updated_at = now()
      where id in (${sql.join(
        coachIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
        and coalesce(calc_status, 'current') <> 'calculating'
    `);
    return coachIds.length;
  } catch {
    return 0;
  }
}
