import { and, eq, inArray } from "drizzle-orm";
import { teamCoachingStaff, teams } from "@rugby365/db";
import {
  resolveCoach,
  upsertCoachingStaffAssignment,
  type CoachingStaffRow,
} from "./coach-admin-service";
import { type CoachingRole } from "./coach-types";
import { createTeam } from "./entity-admin-service";
import { getDb } from "./db";

export type CurrentCoachAssignment = {
  teamSlug: string;
  teamName?: string;
  coachName: string;
  role: CoachingRole;
  startDate?: string;
  endDate?: string | null;
  /** When true, other current leadership assignments on this team are kept. */
  allowMultipleCurrent?: boolean;
};

const LEADERSHIP_ROLES: CoachingRole[] = ["head_coach", "director_of_rugby"];

/** Canonical current head coaches / directors of rugby (July 2026). */
export const CURRENT_COACH_ASSIGNMENTS: CurrentCoachAssignment[] = [
  // Premiership
  { teamSlug: "bath-rugby", coachName: "Johann van Graan", role: "director_of_rugby" },
  { teamSlug: "bristol-bears-4wjx0njp", coachName: "Pat Lam", role: "director_of_rugby" },
  { teamSlug: "exeter-chiefs-016owj5k", coachName: "Rob Baxter", role: "director_of_rugby" },
  { teamSlug: "gloucester-do6lo6yl", coachName: "George Skivington", role: "head_coach" },
  { teamSlug: "harlequins-216my6ng", coachName: "Jason Gilmore", role: "head_coach" },
  { teamSlug: "leicester-tigers-g567e9er", coachName: "Geoff Parling", role: "head_coach" },
  {
    teamSlug: "newcastle-red-bulls",
    coachName: "Stephen Jones",
    role: "head_coach",
    allowMultipleCurrent: true,
  },
  {
    teamSlug: "newcastle-red-bulls",
    coachName: "Dan McFarland",
    role: "head_coach",
    allowMultipleCurrent: true,
  },
  { teamSlug: "northampton-saints-og9nrjly", coachName: "Phil Dowson", role: "director_of_rugby" },
  { teamSlug: "sale-sharks-krjd4j3q", coachName: "Alex Sanderson", role: "director_of_rugby" },
  { teamSlug: "saracens-zv9039e5", coachName: "Mark McCall", role: "director_of_rugby" },

  // Internationals
  { teamSlug: "ireland-m46v8v9z", coachName: "Andy Farrell", role: "head_coach" },
  { teamSlug: "england-5294m098", coachName: "Steve Borthwick", role: "head_coach" },
  { teamSlug: "england-red-roses", teamName: "England Red Roses", coachName: "John Mitchell", role: "head_coach" },
  { teamSlug: "wales", coachName: "Steve Tandy", role: "head_coach" },
  { teamSlug: "scotland", coachName: "Gregor Townsend", role: "head_coach" },
  { teamSlug: "france-go9p0p68", coachName: "Fabien Galthié", role: "head_coach" },
  { teamSlug: "south-africa", coachName: "Rassie Erasmus", role: "head_coach" },
  { teamSlug: "new-zealand", coachName: "Dave Rennie", role: "head_coach" },
  { teamSlug: "australia", coachName: "Les Kiss", role: "head_coach" },
  { teamSlug: "argentina", coachName: "Felipe Contepomi", role: "head_coach" },
  { teamSlug: "fiji", teamName: "Fiji", coachName: "Senirusi Seruvakula", role: "head_coach", startDate: "2026-01-01" },

  // Super Rugby — Australian conference
  { teamSlug: "brumbies-vx91v29w", coachName: "Stephen Larkham", role: "head_coach" },
  { teamSlug: "melbourne-rebels", coachName: "Kevin Foote", role: "head_coach" },
  { teamSlug: "queensland-reds", coachName: "Les Kiss", role: "head_coach" },
  { teamSlug: "force", coachName: "Simon Cron", role: "head_coach" },

  // Super Rugby — New Zealand conference
  { teamSlug: "auckland-blues", coachName: "Vern Cotter", role: "head_coach" },
  { teamSlug: "chiefs", teamName: "Chiefs", coachName: "Jono Gibbes", role: "head_coach" },
  { teamSlug: "canterbury-crusaders", coachName: "Scott Hansen", role: "head_coach" },
  { teamSlug: "highlanders", coachName: "Jamie Joseph", role: "head_coach" },
  { teamSlug: "hurricanes", teamName: "Hurricanes", coachName: "Clark Laidlaw", role: "head_coach" },

  // Pacific franchises & cross-border
  { teamSlug: "fijian-drua", teamName: "Fijian Drua", coachName: "Glen Jackson", role: "head_coach" },
  { teamSlug: "moana-pasifika-dp9z1868", coachName: "Tana Umaga", role: "head_coach" },
  { teamSlug: "waratahs-016o2oj5", coachName: "Dan McKellar", role: "head_coach" },
];

export type AssignCurrentCoachesResult = {
  teamsCreated: string[];
  coachesCreated: string[];
  assignmentsCreated: number;
  assignmentsUpdated: number;
  demotedPriorCurrent: number;
  failures: Array<{ coachName: string; teamSlug: string; error: string }>;
};

async function resolveTeamBySlug(slug: string, name?: string) {
  const db = getDb();
  const [existing] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  if (existing) return { team: existing, created: false };

  if (!name) {
    throw new Error(`Team slug "${slug}" not found and no teamName provided to create it`);
  }

  const team = await createTeam({ name, slug, shortName: name.replace(/,.*/, "").trim() });
  return { team, created: true };
}

async function demotePriorLeadership(teamId: string, keepCoachIds: string[]) {
  const db = getDb();
  const rows = await db
    .select()
    .from(teamCoachingStaff)
    .where(
      and(
        eq(teamCoachingStaff.teamId, teamId),
        eq(teamCoachingStaff.isCurrent, true),
        inArray(teamCoachingStaff.role, LEADERSHIP_ROLES),
      ),
    );

  let demoted = 0;
  for (const row of rows) {
    const isCanonical = row.importKey?.startsWith("current-coach:") ?? false;
    if (isCanonical) continue;
    if (keepCoachIds.includes(row.coachId)) {
      await db
        .update(teamCoachingStaff)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(eq(teamCoachingStaff.id, row.id));
      demoted += 1;
      continue;
    }
    await db
      .update(teamCoachingStaff)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(teamCoachingStaff.id, row.id));
    demoted += 1;
  }
  return demoted;
}

export async function assignCurrentCoaches(
  assignments: CurrentCoachAssignment[] = CURRENT_COACH_ASSIGNMENTS,
): Promise<AssignCurrentCoachesResult> {
  const result: AssignCurrentCoachesResult = {
    teamsCreated: [],
    coachesCreated: [],
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    demotedPriorCurrent: 0,
    failures: [],
  };

  const teamCache = new Map<string, typeof teams.$inferSelect>();
  const teamCoachIds = new Map<string, Set<string>>();

  for (const entry of assignments) {
    try {
      let team = teamCache.get(entry.teamSlug);
      if (!team) {
        const resolved = await resolveTeamBySlug(entry.teamSlug, entry.teamName);
        team = resolved.team;
        teamCache.set(entry.teamSlug, team);
        if (resolved.created) {
          result.teamsCreated.push(`${entry.teamName ?? team.name} (${entry.teamSlug})`);
        }
      }

      const existingCoach = await resolveCoach({ name: entry.coachName, createIfMissing: false });
      const coach = await resolveCoach({ name: entry.coachName, createIfMissing: true });
      if (!coach) throw new Error("Failed to resolve coach");
      if (!existingCoach) result.coachesCreated.push(coach.name);

      const coachSet = teamCoachIds.get(team.id) ?? new Set<string>();
      coachSet.add(coach.id);
      teamCoachIds.set(team.id, coachSet);

      const upsert = await upsertCoachingStaffAssignment({
        coachId: coach.id,
        teamId: team.id,
        role: entry.role,
        startDate: entry.startDate ?? null,
        endDate: entry.endDate ?? null,
        isCurrent: true,
        importKey: `current-coach:${entry.teamSlug}:${entry.role}:${coach.slug}`,
        notes: entry.startDate
          ? `Head coach from ${entry.startDate.slice(0, 4)}`
          : "Current head coach assignment (July 2026)",
      });

      if (upsert.created) result.assignmentsCreated += 1;
      else result.assignmentsUpdated += 1;
    } catch (error) {
      result.failures.push({
        coachName: entry.coachName,
        teamSlug: entry.teamSlug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const [teamId, coachIds] of teamCoachIds) {
    result.demotedPriorCurrent += await demotePriorLeadership(teamId, [...coachIds]);
  }

  return result;
}

export function summarizeCurrentCoachAssignments(
  rows: CoachingStaffRow[],
): Array<{ team: string; coaches: string }> {
  const byTeam = new Map<string, string[]>();
  for (const row of rows.filter((r) => r.isCurrent && LEADERSHIP_ROLES.includes(r.role))) {
    const list = byTeam.get(row.teamName) ?? [];
    list.push(`${row.coachName} (${row.roleLabel})`);
    byTeam.set(row.teamName, list);
  }
  return [...byTeam.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([team, coaches]) => ({ team, coaches: coaches.join(", ") }));
}
