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
  { teamSlug: "new-zealand", coachName: "Scott Robertson", role: "head_coach" },
  { teamSlug: "australia", coachName: "Joe Schmidt", role: "head_coach" },
  { teamSlug: "italy-n0620o98", coachName: "Gonzalo Quesada", role: "head_coach" },
  { teamSlug: "japan", coachName: "Eddie Jones", role: "head_coach" },
  { teamSlug: "united-states-216mky9n", teamName: "United States", coachName: "Scott Lawrence", role: "head_coach" },
  { teamSlug: "samoa-016oqwj5", teamName: "Samoa", coachName: "Mahonri Schwalger", role: "head_coach" },
  { teamSlug: "georgia-zd935n6v", teamName: "Georgia", coachName: "Pierre-Henry Broncan", role: "head_coach" },
  { teamSlug: "canada-k76k4rjy", teamName: "Canada", coachName: "Kingsley Jones", role: "head_coach" },
  { teamSlug: "uruguay-og9n31jl", teamName: "Uruguay", coachName: "Esteban Meneses", role: "head_coach" },
  { teamSlug: "chile-pm6wdmj4", teamName: "Chile", coachName: "Pablo Lemoine", role: "head_coach" },
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

  // Bunnings NPC — 2026 provincial head coaches
  { teamSlug: "canterbury", coachName: "Alex Robertson", role: "head_coach", startDate: "2026-01-01" },
  { teamSlug: "auckland", coachName: "Steven Bates", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "otago", coachName: "Mark Brown", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "waikato", coachName: "Leon Holden", role: "head_coach", startDate: "2026-01-01" },
  { teamSlug: "taranaki", coachName: "Jarrad Hoeata", role: "head_coach", startDate: "2026-01-01" },
  { teamSlug: "counties-manukau", coachName: "Reon Graham", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "hawke-s-bay", coachName: "Brock James", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "wellington", coachName: "Trent Renata", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "bay-of-plenty", coachName: "Richard Watt", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "southland", coachName: "Scott Eade", role: "head_coach", startDate: "2026-01-01" },
  { teamSlug: "northland", coachName: "Ryan Martin", role: "head_coach", startDate: "2025-01-01" },
  { teamSlug: "manawatu", coachName: "Wesley Clarke", role: "head_coach", startDate: "2025-06-01" },
  { teamSlug: "tasman", coachName: "Jono Phillips", role: "head_coach", startDate: "2026-01-01" },
  { teamSlug: "north-harbour", coachName: "Jimmy Maher", role: "head_coach", startDate: "2025-01-01" },

  // Currie Cup / URC SA sides (already used in match defaults)
  { teamSlug: "boland-cavaliers", coachName: "Kloppie Botha", role: "head_coach" },
  { teamSlug: "bulls-52944z98", coachName: "Phiwe Nomlomo", role: "head_coach" },
  { teamSlug: "cheetahs", coachName: "Frans Steyn", role: "head_coach" },
  { teamSlug: "lions-k76kd1jy", coachName: "Ivan van Rooyen", role: "head_coach" },
  { teamSlug: "sharks-1m98z29x", coachName: "John Plumtree", role: "head_coach" },
  { teamSlug: "stormers-g56el397", coachName: "John Dobson", role: "head_coach" },

  // URC
  { teamSlug: "leinster-pd9rxo98", coachName: "Leo Cullen", role: "head_coach" },
  { teamSlug: "munster-m46vomjz", coachName: "Clayton McMillan", role: "head_coach" },
  { teamSlug: "ulster-vx917e9w", coachName: "Richie Murphy", role: "head_coach" },
  { teamSlug: "connacht-rugby", coachName: "Pete Wilkins", role: "head_coach" },
  { teamSlug: "glasgow-warriors", coachName: "Franco Smith", role: "head_coach" },
  { teamSlug: "edinburgh", coachName: "Sean Everitt", role: "head_coach" },
  { teamSlug: "cardiff", coachName: "Matt Sherratt", role: "head_coach" },
  { teamSlug: "ospreys-n0628z68", coachName: "Mark Jones", role: "head_coach" },
  { teamSlug: "scarlets-qo6gdo63", coachName: "Dwayne Peel", role: "head_coach" },
  { teamSlug: "dragons-go9p5qj8", coachName: "Filo Paulo", role: "head_coach" },
  { teamSlug: "benetton-dp9zn98l", coachName: "Marco Bortolami", role: "head_coach" },
  { teamSlug: "zebre-zd93w56v", coachName: "Massimo Brunello", role: "head_coach" },

  // Top 14 / Champions Cup French sides
  { teamSlug: "stade-toulousain-016odw95", coachName: "Ugo Mola", role: "head_coach" },
  { teamSlug: "la-rochelle-4wjx1n6p", coachName: "Ronan O'Gara", role: "head_coach" },
  { teamSlug: "racing-92", coachName: "Patrice Collazo", role: "head_coach" },
  { teamSlug: "bordeaux-begles-do6l3o6y", coachName: "Yannick Bru", role: "head_coach" },
  { teamSlug: "section-paloise-zv90536e", coachName: "Sébastien Piqueronies", role: "head_coach" },
  { teamSlug: "montpellier-g56ey3j7", coachName: "Joan Caudullo", role: "head_coach" },

  // Autumn Nations Cup / Tier 2 (World Rugby Nations Cup 2026 guides)
  { teamSlug: "portugal-vx91y29w", teamName: "Portugal", coachName: "Simon Mannix", role: "head_coach" },
  { teamSlug: "spain-og9np16l", teamName: "Spain", coachName: "Pablo Bouza", role: "head_coach" },
  { teamSlug: "tonga-do6ly09y", teamName: "Tonga", coachName: "Tevita Tu'ifua", role: "head_coach" },
  { teamSlug: "hong-kong-qo6gqk93", teamName: "Hong Kong", coachName: "Logan Asplin", role: "head_coach" },
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
