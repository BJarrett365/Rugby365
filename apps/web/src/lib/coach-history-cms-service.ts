/**
 * CMS CRUD helpers for coach history nested resources
 * (playing stints, honours, awards, medals, milestones).
 */
import { and, asc, desc, eq } from "drizzle-orm";
import {
  coachAwards,
  coachHonours,
  coachMedals,
  coachMilestones,
  coachPlayingStints,
} from "@rugby365/db";
import { getDb } from "./db";

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optInt(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/* ── Playing stints ─────────────────────────────────────────── */

export async function listCoachPlayingStints(coachId: string) {
  const db = getDb();
  return db
    .select()
    .from(coachPlayingStints)
    .where(eq(coachPlayingStints.coachId, coachId))
    .orderBy(asc(coachPlayingStints.sortOrder), asc(coachPlayingStints.startYear));
}

export async function createCoachPlayingStint(
  coachId: string,
  input: {
    teamType?: string;
    startYear?: number | string | null;
    endYear?: number | string | null;
    yearsLabel: string;
    teamName: string;
    teamId?: string | null;
    competitionId?: string | null;
    country?: string | null;
    apps?: number | string | null;
    starts?: number | string | null;
    points?: number | string | null;
    tries?: number | string | null;
    position?: string | null;
    captain?: boolean;
    sortOrder?: number;
    sourceUrl?: string | null;
    showOnOverview?: boolean;
  },
) {
  const yearsLabel = input.yearsLabel.trim();
  const teamName = input.teamName.trim();
  if (!yearsLabel) throw new Error("yearsLabel is required");
  if (!teamName) throw new Error("teamName is required");

  const db = getDb();
  const [row] = await db
    .insert(coachPlayingStints)
    .values({
      coachId,
      teamType: trimOrNull(input.teamType) ?? "provincial",
      startYear: optInt(input.startYear),
      endYear: optInt(input.endYear),
      yearsLabel,
      teamName,
      teamId: input.teamId || null,
      competitionId: input.competitionId || null,
      country: trimOrNull(input.country),
      apps: optInt(input.apps),
      starts: optInt(input.starts),
      points: optInt(input.points),
      tries: optInt(input.tries),
      position: trimOrNull(input.position),
      captain: input.captain ?? false,
      sortOrder: input.sortOrder ?? 0,
      sourceUrl: trimOrNull(input.sourceUrl),
      showOnOverview: input.showOnOverview ?? true,
    })
    .returning();
  return row!;
}

export async function deleteCoachPlayingStint(stintId: string, coachId: string) {
  const db = getDb();
  const deleted = await db
    .delete(coachPlayingStints)
    .where(and(eq(coachPlayingStints.id, stintId), eq(coachPlayingStints.coachId, coachId)))
    .returning({ id: coachPlayingStints.id });
  return deleted.length > 0;
}

/* ── Honours ────────────────────────────────────────────────── */

export async function listCoachHonours(coachId: string) {
  const db = getDb();
  return db
    .select()
    .from(coachHonours)
    .where(eq(coachHonours.coachId, coachId))
    .orderBy(desc(coachHonours.year), asc(coachHonours.sortOrder));
}

export async function createCoachHonour(
  coachId: string,
  input: {
    roleType?: string;
    teamId?: string | null;
    teamName?: string | null;
    competitionId?: string | null;
    competitionName?: string | null;
    seasonId?: string | null;
    seasonLabel?: string | null;
    year?: number | string | null;
    achievementType?: string;
    honourLevel?: string;
    shared?: boolean;
    position?: string | null;
    notes?: string | null;
    sourceUrl?: string | null;
    showOnOverview?: boolean;
    visibility?: string;
    sortOrder?: number;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(coachHonours)
    .values({
      coachId,
      roleType: trimOrNull(input.roleType) ?? "coach",
      teamId: input.teamId || null,
      teamName: trimOrNull(input.teamName),
      competitionId: input.competitionId || null,
      competitionName: trimOrNull(input.competitionName),
      seasonId: input.seasonId || null,
      seasonLabel: trimOrNull(input.seasonLabel),
      year: optInt(input.year),
      achievementType: trimOrNull(input.achievementType) ?? "winner",
      honourLevel: trimOrNull(input.honourLevel) ?? "secondary",
      shared: input.shared ?? false,
      position: trimOrNull(input.position),
      notes: trimOrNull(input.notes),
      sourceUrl: trimOrNull(input.sourceUrl),
      showOnOverview: input.showOnOverview ?? false,
      visibility: trimOrNull(input.visibility) ?? "public",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

export async function deleteCoachHonour(honourId: string, coachId: string) {
  const db = getDb();
  const deleted = await db
    .delete(coachHonours)
    .where(and(eq(coachHonours.id, honourId), eq(coachHonours.coachId, coachId)))
    .returning({ id: coachHonours.id });
  return deleted.length > 0;
}

/* ── Awards ─────────────────────────────────────────────────── */

export async function listCoachAwards(coachId: string) {
  const db = getDb();
  return db
    .select()
    .from(coachAwards)
    .where(eq(coachAwards.coachId, coachId))
    .orderBy(desc(coachAwards.year), asc(coachAwards.sortOrder));
}

export async function createCoachAward(
  coachId: string,
  input: {
    awardName: string;
    awardingBody?: string | null;
    year?: number | string | null;
    category?: string | null;
    result?: string;
    teamIdAtTime?: string | null;
    isMajor?: boolean;
    sourceUrl?: string | null;
    showOnOverview?: boolean;
    visibility?: string;
    sortOrder?: number;
  },
) {
  const awardName = input.awardName.trim();
  if (!awardName) throw new Error("awardName is required");

  const db = getDb();
  const [row] = await db
    .insert(coachAwards)
    .values({
      coachId,
      awardName,
      awardingBody: trimOrNull(input.awardingBody),
      year: optInt(input.year),
      category: trimOrNull(input.category),
      result: trimOrNull(input.result) ?? "winner",
      teamIdAtTime: input.teamIdAtTime || null,
      isMajor: input.isMajor ?? false,
      sourceUrl: trimOrNull(input.sourceUrl),
      showOnOverview: input.showOnOverview ?? false,
      visibility: trimOrNull(input.visibility) ?? "public",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

export async function deleteCoachAward(awardId: string, coachId: string) {
  const db = getDb();
  const deleted = await db
    .delete(coachAwards)
    .where(and(eq(coachAwards.id, awardId), eq(coachAwards.coachId, coachId)))
    .returning({ id: coachAwards.id });
  return deleted.length > 0;
}

/* ── Medals ─────────────────────────────────────────────────── */

export async function listCoachMedals(coachId: string) {
  const db = getDb();
  return db
    .select()
    .from(coachMedals)
    .where(eq(coachMedals.coachId, coachId))
    .orderBy(desc(coachMedals.year), asc(coachMedals.sortOrder));
}

export async function createCoachMedal(
  coachId: string,
  input: {
    roleType?: string;
    teamId?: string | null;
    teamName?: string | null;
    competitionId?: string | null;
    competitionName?: string | null;
    year?: number | string | null;
    finish: string;
    medalType?: string;
    honourId?: string | null;
    sourceUrl?: string | null;
    sortOrder?: number;
  },
) {
  const finish = input.finish.trim();
  if (!finish) throw new Error("finish is required");

  const db = getDb();
  const [row] = await db
    .insert(coachMedals)
    .values({
      coachId,
      roleType: trimOrNull(input.roleType) ?? "coach",
      teamId: input.teamId || null,
      teamName: trimOrNull(input.teamName),
      competitionId: input.competitionId || null,
      competitionName: trimOrNull(input.competitionName),
      year: optInt(input.year),
      finish,
      medalType: trimOrNull(input.medalType) ?? "none",
      honourId: input.honourId || null,
      sourceUrl: trimOrNull(input.sourceUrl),
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

export async function deleteCoachMedal(medalId: string, coachId: string) {
  const db = getDb();
  const deleted = await db
    .delete(coachMedals)
    .where(and(eq(coachMedals.id, medalId), eq(coachMedals.coachId, coachId)))
    .returning({ id: coachMedals.id });
  return deleted.length > 0;
}

/* ── Milestones ─────────────────────────────────────────────── */

export async function listCoachMilestones(coachId: string) {
  const db = getDb();
  return db
    .select()
    .from(coachMilestones)
    .where(eq(coachMilestones.coachId, coachId))
    .orderBy(asc(coachMilestones.milestoneYear), asc(coachMilestones.sortOrder));
}

export async function createCoachMilestone(
  coachId: string,
  input: {
    milestoneDate?: string | null;
    milestoneYear?: number | string | null;
    milestoneType: string;
    title: string;
    description?: string | null;
    teamId?: string | null;
    competitionId?: string | null;
    matchId?: string | null;
    sourceUrl?: string | null;
    showOnOverview?: boolean;
    sortOrder?: number;
  },
) {
  const milestoneType = input.milestoneType.trim();
  const title = input.title.trim();
  if (!milestoneType) throw new Error("milestoneType is required");
  if (!title) throw new Error("title is required");

  const db = getDb();
  const [row] = await db
    .insert(coachMilestones)
    .values({
      coachId,
      milestoneDate: input.milestoneDate || null,
      milestoneYear: optInt(input.milestoneYear),
      milestoneType,
      title,
      description: trimOrNull(input.description),
      teamId: input.teamId || null,
      competitionId: input.competitionId || null,
      matchId: input.matchId || null,
      sourceUrl: trimOrNull(input.sourceUrl),
      showOnOverview: input.showOnOverview ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

export async function deleteCoachMilestone(milestoneId: string, coachId: string) {
  const db = getDb();
  const deleted = await db
    .delete(coachMilestones)
    .where(and(eq(coachMilestones.id, milestoneId), eq(coachMilestones.coachId, coachId)))
    .returning({ id: coachMilestones.id });
  return deleted.length > 0;
}
