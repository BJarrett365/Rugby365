import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  competitions,
  competitionSeasons,
  fixtures,
  players,
  playerSuspensions,
  teams,
} from "@rugby365/db";
import {
  sanitizePublicAvailabilityNotes,
  type SuspensionStatus,
} from "./availability-types";
import { getDb } from "./db";

export type SuspensionRow = {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  competitionId: string | null;
  competitionName: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  fixtureId: string | null;
  fixtureSlug: string | null;
  incidentDate: string | null;
  offence: string | null;
  cardType: string | null;
  hearingDate: string | null;
  suspensionStart: string | null;
  suspensionEnd: string | null;
  matchesSuspended: number | null;
  matchesServed: number;
  matchesRemaining: number | null;
  status: SuspensionStatus;
  source: string | null;
  sourceUrl: string | null;
  notes: string | null;
  lastVerifiedDate: string | null;
};

function mapSuspensionRow(row: {
  suspension: typeof playerSuspensions.$inferSelect;
  playerName: string;
  teamName: string | null;
  competitionName: string | null;
  seasonLabel: string | null;
  fixtureSlug: string | null;
}): SuspensionRow {
  return {
    id: row.suspension.id,
    playerId: row.suspension.playerId,
    playerName: row.playerName,
    teamId: row.suspension.teamId,
    teamName: row.teamName,
    competitionId: row.suspension.competitionId,
    competitionName: row.competitionName,
    seasonId: row.suspension.seasonId,
    seasonLabel: row.seasonLabel,
    fixtureId: row.suspension.fixtureId,
    fixtureSlug: row.fixtureSlug,
    incidentDate: row.suspension.incidentDate,
    offence: row.suspension.offence,
    cardType: row.suspension.cardType,
    hearingDate: row.suspension.hearingDate,
    suspensionStart: row.suspension.suspensionStart,
    suspensionEnd: row.suspension.suspensionEnd,
    matchesSuspended: row.suspension.matchesSuspended,
    matchesServed: row.suspension.matchesServed,
    matchesRemaining: row.suspension.matchesRemaining,
    status: row.suspension.status as SuspensionStatus,
    source: row.suspension.source,
    sourceUrl: row.suspension.sourceUrl,
    notes: row.suspension.notes,
    lastVerifiedDate: row.suspension.lastVerifiedDate,
  };
}

export async function listSuspensions(filters: {
  playerId?: string;
  teamId?: string;
  seasonId?: string;
  competitionId?: string;
  status?: string;
  search?: string;
  limit?: number;
} = {}): Promise<SuspensionRow[]> {
  const db = getDb();
  const conditions = [];
  if (filters.playerId) conditions.push(eq(playerSuspensions.playerId, filters.playerId));
  if (filters.teamId) conditions.push(eq(playerSuspensions.teamId, filters.teamId));
  if (filters.seasonId) conditions.push(eq(playerSuspensions.seasonId, filters.seasonId));
  if (filters.competitionId) conditions.push(eq(playerSuspensions.competitionId, filters.competitionId));
  if (filters.status) conditions.push(eq(playerSuspensions.status, filters.status));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(or(sql`${players.name} ilike ${q}`, sql`${playerSuspensions.offence} ilike ${q}`));
  }

  const rows = await db
    .select({
      suspension: playerSuspensions,
      playerName: players.name,
      teamName: teams.name,
      competitionName: competitions.name,
      seasonLabel: competitionSeasons.label,
      fixtureSlug: fixtures.slug,
    })
    .from(playerSuspensions)
    .innerJoin(players, eq(playerSuspensions.playerId, players.id))
    .leftJoin(teams, eq(playerSuspensions.teamId, teams.id))
    .leftJoin(competitions, eq(playerSuspensions.competitionId, competitions.id))
    .leftJoin(competitionSeasons, eq(playerSuspensions.seasonId, competitionSeasons.id))
    .leftJoin(fixtures, eq(playerSuspensions.fixtureId, fixtures.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(playerSuspensions.incidentDate), desc(playerSuspensions.updatedAt))
    .limit(filters.limit ?? 200);

  return rows.map(mapSuspensionRow);
}

export async function createSuspension(input: {
  playerId: string;
  teamId?: string | null;
  competitionId?: string | null;
  seasonId?: string | null;
  fixtureId?: string | null;
  incidentDate?: string | null;
  offence?: string | null;
  cardType?: string | null;
  hearingDate?: string | null;
  suspensionStart?: string | null;
  suspensionEnd?: string | null;
  matchesSuspended?: number | null;
  matchesServed?: number;
  matchesRemaining?: number | null;
  status?: string;
  source?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  lastVerifiedDate?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(playerSuspensions)
    .values({
      playerId: input.playerId,
      teamId: input.teamId ?? null,
      competitionId: input.competitionId ?? null,
      seasonId: input.seasonId ?? null,
      fixtureId: input.fixtureId ?? null,
      incidentDate: input.incidentDate ?? null,
      offence: input.offence?.trim() || null,
      cardType: input.cardType?.trim() || null,
      hearingDate: input.hearingDate ?? null,
      suspensionStart: input.suspensionStart ?? null,
      suspensionEnd: input.suspensionEnd ?? null,
      matchesSuspended: input.matchesSuspended ?? null,
      matchesServed: input.matchesServed ?? 0,
      matchesRemaining: input.matchesRemaining ?? null,
      status: input.status ?? "suspended",
      source: input.source?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      notes: sanitizePublicAvailabilityNotes(input.notes),
      lastVerifiedDate: input.lastVerifiedDate ?? null,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateSuspension(
  id: string,
  input: Partial<Parameters<typeof createSuspension>[0]>,
) {
  const db = getDb();
  const [row] = await db
    .update(playerSuspensions)
    .set({
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.competitionId !== undefined ? { competitionId: input.competitionId } : {}),
      ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}),
      ...(input.fixtureId !== undefined ? { fixtureId: input.fixtureId } : {}),
      ...(input.incidentDate !== undefined ? { incidentDate: input.incidentDate } : {}),
      ...(input.offence !== undefined ? { offence: input.offence?.trim() || null } : {}),
      ...(input.cardType !== undefined ? { cardType: input.cardType?.trim() || null } : {}),
      ...(input.hearingDate !== undefined ? { hearingDate: input.hearingDate } : {}),
      ...(input.suspensionStart !== undefined ? { suspensionStart: input.suspensionStart } : {}),
      ...(input.suspensionEnd !== undefined ? { suspensionEnd: input.suspensionEnd } : {}),
      ...(input.matchesSuspended !== undefined ? { matchesSuspended: input.matchesSuspended } : {}),
      ...(input.matchesServed !== undefined ? { matchesServed: input.matchesServed } : {}),
      ...(input.matchesRemaining !== undefined ? { matchesRemaining: input.matchesRemaining } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.source !== undefined ? { source: input.source?.trim() || null } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: sanitizePublicAvailabilityNotes(input.notes) } : {}),
      ...(input.lastVerifiedDate !== undefined ? { lastVerifiedDate: input.lastVerifiedDate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(playerSuspensions.id, id))
    .returning();
  if (!row) throw new Error("Suspension not found");
  return row;
}

export async function deleteSuspension(id: string) {
  const db = getDb();
  await db.delete(playerSuspensions).where(eq(playerSuspensions.id, id));
}

export async function getSuspensionById(id: string): Promise<SuspensionRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      suspension: playerSuspensions,
      playerName: players.name,
      teamName: teams.name,
      competitionName: competitions.name,
      seasonLabel: competitionSeasons.label,
      fixtureSlug: fixtures.slug,
    })
    .from(playerSuspensions)
    .innerJoin(players, eq(playerSuspensions.playerId, players.id))
    .leftJoin(teams, eq(playerSuspensions.teamId, teams.id))
    .leftJoin(competitions, eq(playerSuspensions.competitionId, competitions.id))
    .leftJoin(competitionSeasons, eq(playerSuspensions.seasonId, competitionSeasons.id))
    .leftJoin(fixtures, eq(playerSuspensions.fixtureId, fixtures.id))
    .where(eq(playerSuspensions.id, id))
    .limit(1);
  if (!row) return null;
  return mapSuspensionRow(row);
}
