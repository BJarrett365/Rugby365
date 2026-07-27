import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import {
  coaches,
  competitionSeasons,
  teamCoachingStaff,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { normalizeSlug, validateSlug } from "./fixture-admin-service";
import {
  type CoachSocialAccounts,
  type CoachingRole,
  coachingRoleLabel,
  normalizeCoachingRole,
} from "./coach-types";
import { calculatePlayerAge } from "./player-profile-utils";

function uniqueCoachSlug(base: string, externalProviderId?: string): string {
  const slug = normalizeSlug(base);
  if (!externalProviderId) return slug;
  const suffix = externalProviderId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase();
  return suffix ? `${slug}-${suffix}` : slug;
}

export function normalizeCoachSocialAccounts(input: unknown): CoachSocialAccounts {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const pick = (key: string) => {
    const value = raw[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return {
    twitter: pick("twitter"),
    instagram: pick("instagram"),
    facebook: pick("facebook"),
    linkedin: pick("linkedin"),
    website: pick("website"),
  };
}

export type CoachingStaffRow = {
  id: string;
  coachId: string;
  coachName: string;
  coachSlug: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  seasonId: string | null;
  seasonLabel: string | null;
  role: CoachingRole;
  roleLabel: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  bioSummary: string | null;
  notes: string | null;
  sourceUrl: string | null;
};

export type CoachDetail = {
  coach: typeof coaches.$inferSelect;
  age: number | null;
  assignments: CoachingStaffRow[];
  socialAccounts: CoachSocialAccounts;
};

function mapStaffRow(row: {
  assignment: typeof teamCoachingStaff.$inferSelect;
  coachName: string;
  coachSlug: string;
  teamName: string;
  teamSlug: string;
  seasonLabel: string | null;
}): CoachingStaffRow {
  const role = normalizeCoachingRole(row.assignment.role);
  return {
    id: row.assignment.id,
    coachId: row.assignment.coachId,
    coachName: row.coachName,
    coachSlug: row.coachSlug,
    teamId: row.assignment.teamId,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    seasonId: row.assignment.seasonId,
    seasonLabel: row.seasonLabel,
    role,
    roleLabel: coachingRoleLabel(role),
    startDate: row.assignment.startDate,
    endDate: row.assignment.endDate,
    isCurrent: row.assignment.isCurrent,
    bioSummary: row.assignment.bioSummary,
    notes: row.assignment.notes,
    sourceUrl: row.assignment.sourceUrl,
  };
}

async function selectStaffRows(whereClause?: ReturnType<typeof eq>) {
  const db = getDb();
  const query = db
    .select({
      assignment: teamCoachingStaff,
      coachName: coaches.name,
      coachSlug: coaches.slug,
      teamName: teams.name,
      teamSlug: teams.slug,
      seasonLabel: competitionSeasons.label,
    })
    .from(teamCoachingStaff)
    .innerJoin(coaches, eq(teamCoachingStaff.coachId, coaches.id))
    .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
    .leftJoin(competitionSeasons, eq(teamCoachingStaff.seasonId, competitionSeasons.id));

  const rows = whereClause ? await query.where(whereClause) : await query;
  return rows.map(mapStaffRow);
}

export type CoachListRow = typeof coaches.$inferSelect & {
  coachedCountries: string[];
};

export type CoachListFilters = {
  search?: string;
  countryTeamId?: string;
};

export async function listCoaches(filters?: string | CoachListFilters): Promise<CoachListRow[]> {
  const db = getDb();
  const normalized: CoachListFilters =
    typeof filters === "string" ? { search: filters } : (filters ?? {});

  const conditions = [];
  if (normalized.search?.trim()) {
    const q = `%${normalized.search.trim()}%`;
    conditions.push(or(ilike(coaches.name, q), ilike(coaches.nationality, q)));
  }

  let coachRows: (typeof coaches.$inferSelect)[];
  if (normalized.countryTeamId) {
    const filtered = await db
      .select({ coach: coaches })
      .from(coaches)
      .innerJoin(teamCoachingStaff, eq(teamCoachingStaff.coachId, coaches.id))
      .where(
        conditions.length > 0
          ? and(eq(teamCoachingStaff.teamId, normalized.countryTeamId), ...conditions)
          : eq(teamCoachingStaff.teamId, normalized.countryTeamId),
      )
      .orderBy(asc(coaches.name));
    const seen = new Set<string>();
    coachRows = [];
    for (const row of filtered) {
      if (seen.has(row.coach.id)) continue;
      seen.add(row.coach.id);
      coachRows.push(row.coach);
    }
  } else {
    coachRows = conditions.length
      ? await db
          .select()
          .from(coaches)
          .where(and(...conditions))
          .orderBy(asc(coaches.name))
      : await db.select().from(coaches).orderBy(asc(coaches.name));
  }

  const coachIds = coachRows.map((coach) => coach.id);
  const assignmentRows =
    coachIds.length > 0
      ? await db
          .select({
            coachId: teamCoachingStaff.coachId,
            teamName: teams.name,
          })
          .from(teamCoachingStaff)
          .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
          .where(inArray(teamCoachingStaff.coachId, coachIds))
      : [];

  const countriesByCoach = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const bucket = countriesByCoach.get(row.coachId) ?? [];
    if (!bucket.includes(row.teamName)) bucket.push(row.teamName);
    countriesByCoach.set(row.coachId, bucket);
  }

  return coachRows.map((coach) => ({
    ...coach,
    coachedCountries: (countriesByCoach.get(coach.id) ?? []).sort((a, b) => a.localeCompare(b)),
  }));
}

export async function resolveCoach(input: {
  name: string;
  birthDate?: string | null;
  nationality?: string | null;
  externalProviderId?: string | null;
  sourceProvider?: string;
  createIfMissing?: boolean;
}) {
  const db = getDb();
  const name = input.name.trim();
  if (!name) return null;

  if (input.externalProviderId) {
    const [byExternal] = await db
      .select()
      .from(coaches)
      .where(eq(coaches.externalProviderId, input.externalProviderId))
      .limit(1);
    if (byExternal) return byExternal;
  }

  const all = await db.select().from(coaches);
  const lower = name.toLowerCase();
  const nationality = input.nationality?.trim().toLowerCase() ?? null;

  const exact = all.find((coach) => {
    if (coach.name.toLowerCase() !== lower) return false;
    if (input.birthDate && coach.birthDate && coach.birthDate !== input.birthDate) return false;
    if (nationality && coach.nationality?.toLowerCase() !== nationality) return false;
    return true;
  });
  if (exact) return exact;

  const byName = all.find((coach) => coach.name.toLowerCase() === lower);
  if (byName && !input.birthDate && !nationality) return byName;

  if (input.createIfMissing === false) return null;

  const slug = uniqueCoachSlug(name, input.externalProviderId ?? undefined);
  const [row] = await db
    .insert(coaches)
    .values({
      name,
      slug,
      birthDate: input.birthDate ?? null,
      nationality: input.nationality?.trim() || null,
      externalProviderId: input.externalProviderId ?? null,
      sourceProvider: input.sourceProvider ?? (input.externalProviderId ? "import" : "manual"),
    })
    .returning();
  return row ?? null;
}

export async function getCoachById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(coaches).where(eq(coaches.id, id)).limit(1);
  return row ?? null;
}

export async function getCoachDetail(id: string): Promise<CoachDetail | null> {
  const coach = await getCoachById(id);
  if (!coach) return null;
  const assignments = await selectStaffRows(eq(teamCoachingStaff.coachId, id));
  assignments.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return (b.startDate ?? "").localeCompare(a.startDate ?? "");
  });
  return {
    coach,
    age: calculatePlayerAge(coach.birthDate),
    assignments,
    socialAccounts: normalizeCoachSocialAccounts(coach.socialAccounts),
  };
}

export async function createCoach(input: {
  name: string;
  slug?: string;
  birthDate?: string | null;
  nationality?: string | null;
  imageUrl?: string | null;
  bioSummary?: string | null;
  wikipediaUrl?: string | null;
  wikidataId?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  externalProviderId?: string | null;
  socialAccounts?: CoachSocialAccounts;
}) {
  const coach = await resolveCoach({
    name: input.name,
    birthDate: input.birthDate,
    nationality: input.nationality,
    externalProviderId: input.externalProviderId,
    createIfMissing: true,
  });
  if (!coach) throw new Error("Failed to create coach");

  const updates: Partial<typeof coaches.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.slug) {
    const slug = normalizeSlug(input.slug);
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
    updates.slug = slug;
  }
  if (input.birthDate !== undefined) updates.birthDate = input.birthDate;
  if (input.nationality !== undefined) updates.nationality = input.nationality?.trim() || null;
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl?.trim() || null;
  if (input.bioSummary !== undefined) updates.bioSummary = input.bioSummary?.trim() || null;
  if (input.wikipediaUrl !== undefined) updates.wikipediaUrl = input.wikipediaUrl?.trim() || null;
  if (input.wikidataId !== undefined) updates.wikidataId = input.wikidataId?.trim() || null;
  if (input.sourceUrl !== undefined) updates.sourceUrl = input.sourceUrl?.trim() || null;
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
  if (input.socialAccounts !== undefined) {
    updates.socialAccounts = normalizeCoachSocialAccounts(input.socialAccounts);
  }

  if (Object.keys(updates).length > 1) {
    const db = getDb();
    const [updated] = await db
      .update(coaches)
      .set(updates)
      .where(eq(coaches.id, coach.id))
      .returning();
    return updated ?? coach;
  }
  return coach;
}

export async function updateCoach(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    birthDate: string | null;
    nationality: string | null;
    imageUrl: string | null;
    bioSummary: string | null;
    wikipediaUrl: string | null;
    wikidataId: string | null;
    sourceUrl: string | null;
    notes: string | null;
    socialAccounts: CoachSocialAccounts;
  }>,
) {
  const db = getDb();
  const existing = await getCoachById(id);
  if (!existing) throw new Error("Coach not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const [row] = await db
    .update(coaches)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality?.trim() || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.bioSummary !== undefined ? { bioSummary: input.bioSummary?.trim() || null } : {}),
      ...(input.wikipediaUrl !== undefined ? { wikipediaUrl: input.wikipediaUrl?.trim() || null } : {}),
      ...(input.wikidataId !== undefined ? { wikidataId: input.wikidataId?.trim() || null } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.socialAccounts !== undefined
        ? { socialAccounts: normalizeCoachSocialAccounts(input.socialAccounts) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(coaches.id, id))
    .returning();
  return row!;
}

export async function deleteCoach(id: string) {
  const db = getDb();
  await db.delete(coaches).where(eq(coaches.id, id));
}

export async function getTeamCoachingStaff(teamId: string) {
  const rows = await selectStaffRows(eq(teamCoachingStaff.teamId, teamId));
  rows.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    const roleOrder = (r: CoachingStaffRow) => (r.role === "head_coach" ? 0 : 1);
    if (roleOrder(a) !== roleOrder(b)) return roleOrder(a) - roleOrder(b);
    return (b.startDate ?? "").localeCompare(a.startDate ?? "");
  });
  return {
    current: rows.filter((row) => row.isCurrent),
    past: rows.filter((row) => !row.isCurrent),
    bySeason: groupStaffBySeason(rows),
  };
}

function groupStaffBySeason(rows: CoachingStaffRow[]) {
  const map = new Map<string, CoachingStaffRow[]>();
  for (const row of rows) {
    const key = row.seasonLabel ?? "Unknown season";
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([season, items]) => ({ season, items }));
}

export function buildCoachingStaffImportKey(input: {
  teamId: string;
  coachId: string;
  role: string;
  seasonId?: string | null;
}): string {
  return [
    input.teamId,
    input.coachId,
    normalizeCoachingRole(input.role),
    input.seasonId ?? "none",
  ].join(":");
}

export async function upsertCoachingStaffAssignment(input: {
  coachId: string;
  teamId: string;
  seasonId?: string | null;
  role: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  bioSummary?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  importKey?: string | null;
}) {
  const db = getDb();
  const role = normalizeCoachingRole(input.role);
  const importKey =
    input.importKey ??
    buildCoachingStaffImportKey({
      teamId: input.teamId,
      coachId: input.coachId,
      role,
      seasonId: input.seasonId,
    });

  const payload = {
    coachId: input.coachId,
    teamId: input.teamId,
    seasonId: input.seasonId ?? null,
    role,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    isCurrent: input.isCurrent ?? false,
    bioSummary: input.bioSummary?.trim() || null,
    notes: input.notes?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    importKey,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.importKey, importKey))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(teamCoachingStaff)
      .set(payload)
      .where(eq(teamCoachingStaff.id, existing.id))
      .returning();
    return { assignment: updated!, created: false };
  }

  const [created] = await db.insert(teamCoachingStaff).values(payload).returning();
  return { assignment: created!, created: true };
}

export async function updateCoachingStaffAssignment(
  id: string,
  input: Partial<{
    seasonId: string | null;
    role: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    bioSummary: string | null;
    notes: string | null;
    sourceUrl: string | null;
  }>,
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.id, id))
    .limit(1);
  if (!existing) throw new Error("Coaching staff assignment not found");

  const [row] = await db
    .update(teamCoachingStaff)
    .set({
      ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}),
      ...(input.role !== undefined ? { role: normalizeCoachingRole(input.role) } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.isCurrent !== undefined ? { isCurrent: input.isCurrent } : {}),
      ...(input.bioSummary !== undefined ? { bioSummary: input.bioSummary?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(teamCoachingStaff.id, id))
    .returning();
  return row!;
}

export async function deleteCoachingStaffAssignment(id: string) {
  const db = getDb();
  await db.delete(teamCoachingStaff).where(eq(teamCoachingStaff.id, id));
}
