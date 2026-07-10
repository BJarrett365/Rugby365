import { eq } from "drizzle-orm";
import { coaches, teamCoachingStaff } from "@rugby365/db";
import {
  getCoachById,
  upsertCoachingStaffAssignment,
} from "./coach-admin-service";
import { importCoachFromWikipedia } from "./coach-wikipedia-import-service";
import {
  buildCoachTeamResolver,
  loadCmsTeamsForCoachAssignment,
  parseCoachedCountryFromCoachNotes,
  resolveCoachStintToCmsTeam,
} from "./coach-team-resolve-service";
import { getDb } from "./db";

export type AssignCoachesToCmsTeamsResult = {
  coachesProcessed: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsRelinked: number;
  skippedNoTeam: number;
  failures: Array<{ coachId: string; coachName: string; error: string }>;
};

async function relinkAssignmentTeamId(assignmentId: string, teamId: string) {
  const db = getDb();
  await db
    .update(teamCoachingStaff)
    .set({ teamId, updatedAt: new Date() })
    .where(eq(teamCoachingStaff.id, assignmentId));
}

export async function assignCoachToCmsTeams(coachId: string): Promise<{
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsRelinked: number;
  skippedNoTeam: number;
}> {
  const coach = await getCoachById(coachId);
  if (!coach) throw new Error("Coach not found");

  const db = getDb();
  const cmsTeams = await loadCmsTeamsForCoachAssignment();
  const resolver = buildCoachTeamResolver(cmsTeams);

  let assignmentsCreated = 0;
  let assignmentsUpdated = 0;
  let assignmentsRelinked = 0;
  let skippedNoTeam = 0;

  const assignmentRows = await db
    .select()
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.coachId, coachId));

  for (const assignment of assignmentRows) {
    const currentTeam = cmsTeams.find((team) => team.id === assignment.teamId);
    if (!currentTeam) continue;
    const canonical = resolver.findCanonicalTeamForExisting(currentTeam);
    if (canonical && canonical.id !== assignment.teamId) {
      await relinkAssignmentTeamId(assignment.id, canonical.id);
      assignmentsRelinked += 1;
    }
  }

  if (coach.wikipediaUrl) {
    const refreshed = await importCoachFromWikipedia({
      articleTitleOrUrl: coach.wikipediaUrl,
      countryName: parseCoachedCountryFromCoachNotes(coach.notes),
    });
    assignmentsCreated += refreshed.assignmentsCreated;
    assignmentsUpdated += refreshed.assignmentsUpdated;
  } else {
    const coachedCountry = parseCoachedCountryFromCoachNotes(coach.notes);
    if (coachedCountry) {
      const team = resolver.resolveCountry(coachedCountry);
      if (team) {
        const result = await upsertCoachingStaffAssignment({
          coachId,
          teamId: team.id,
          role: "head_coach",
          bioSummary: `Coached country: ${coachedCountry}`,
          notes: coach.nationality ? `Nationality: ${coach.nationality}` : null,
          importKey: `cms-country:${coachId}:${team.id}`,
        });
        if (result.created) assignmentsCreated += 1;
        else assignmentsUpdated += 1;
      } else {
        skippedNoTeam += 1;
      }
    }
  }

  return { assignmentsCreated, assignmentsUpdated, assignmentsRelinked, skippedNoTeam };
}

export async function assignCoachesToCmsTeams(input?: {
  coachId?: string;
}): Promise<AssignCoachesToCmsTeamsResult> {
  const db = getDb();
  let coachRows: (typeof coaches.$inferSelect)[] = [];
  if (input?.coachId) {
    const coach = await getCoachById(input.coachId);
    if (coach) coachRows = [coach];
  } else {
    coachRows = await db.select().from(coaches);
  }

  const result: AssignCoachesToCmsTeamsResult = {
    coachesProcessed: 0,
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    assignmentsRelinked: 0,
    skippedNoTeam: 0,
    failures: [],
  };

  for (const coach of coachRows) {
    try {
      const row = await assignCoachToCmsTeams(coach.id);
      result.coachesProcessed += 1;
      result.assignmentsCreated += row.assignmentsCreated;
      result.assignmentsUpdated += row.assignmentsUpdated;
      result.assignmentsRelinked += row.assignmentsRelinked;
      result.skippedNoTeam += row.skippedNoTeam;
    } catch (error) {
      result.failures.push({
        coachId: coach.id,
        coachName: coach.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function relinkMisassignedCoachTeams(): Promise<{
  relinked: number;
  unresolvedTeamNames: string[];
}> {
  const db = getDb();
  const cmsTeams = await loadCmsTeamsForCoachAssignment();
  const resolver = buildCoachTeamResolver(cmsTeams);
  const assignments = await db.select().from(teamCoachingStaff);

  let relinked = 0;
  const unresolved = new Set<string>();

  for (const assignment of assignments) {
    const currentTeam = cmsTeams.find((team) => team.id === assignment.teamId);
    if (!currentTeam) continue;
    const canonical = resolver.findCanonicalTeamForExisting(currentTeam);
    if (canonical && canonical.id !== assignment.teamId) {
      await relinkAssignmentTeamId(assignment.id, canonical.id);
      relinked += 1;
      continue;
    }
    if (!resolver.isCanonicalCmsTeam(currentTeam)) {
      unresolved.add(currentTeam.name);
    }
  }

  return { relinked, unresolvedTeamNames: [...unresolved].sort() };
}

export { resolveCoachStintToCmsTeam };
