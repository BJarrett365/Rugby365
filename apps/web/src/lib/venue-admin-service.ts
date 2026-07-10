import { asc, desc, eq, sql } from "drizzle-orm";
import { fixtures, teams, venues } from "@rugby365/db";
import type { WikipediaVenueArchive } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { normalizeSlug, validateSlug } from "./fixture-admin-service";
import { buildVenueResolver } from "./venue-fixture-resolve-service";

async function loadVenueRefs() {
  const db = getDb();
  return db
    .select({
      id: venues.id,
      name: venues.name,
      slug: venues.slug,
      city: venues.city,
      countryName: venues.countryName,
      teamId: venues.teamId,
    })
    .from(venues);
}

export async function resolveVenue(input: {
  name: string;
  city?: string;
  countryName?: string;
  teamId?: string;
  createIfMissing?: boolean;
}) {
  const name = input.name.trim();
  if (!name) return null;

  const db = getDb();
  const cmsVenues = await loadVenueRefs();
  const resolver = buildVenueResolver(cmsVenues);

  let homeVenueId: string | undefined;
  if (input.teamId) {
    const db = getDb();
    const [team] = await db.select({ homeVenueId: teams.homeVenueId }).from(teams).where(eq(teams.id, input.teamId)).limit(1);
    homeVenueId = team?.homeVenueId ?? undefined;
  }

  const matched = resolver.resolveFixtureVenue({
    venueName: name,
    homeTeamId: input.teamId,
    homeVenueId,
  });
  if (matched) {
    const [fullVenue] = await db.select().from(venues).where(eq(venues.id, matched.venue.id)).limit(1);
    if (fullVenue) return fullVenue;
  }

  const slug = normalizeSlug(name);
  const [existing] = await db.select().from(venues).where(eq(venues.slug, slug)).limit(1);
  if (existing) return existing;

  if (!input.createIfMissing) return null;

  return createVenue({
    name,
    slug,
    city: input.city,
    countryName: input.countryName,
    teamId: input.teamId,
  });
}

export async function listVenues() {
  const db = getDb();
  const rows = await db.select().from(venues).orderBy(asc(venues.name));
  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  const fixtureCounts = await db
    .select({
      venueId: fixtures.venueId,
      count: sql<number>`count(*)::int`,
      lastAttendance: sql<number | null>`max(${fixtures.attendance})`,
    })
    .from(fixtures)
    .where(sql`${fixtures.venueId} is not null`)
    .groupBy(fixtures.venueId);

  const countByVenue = Object.fromEntries(
    fixtureCounts.map((r) => [
      r.venueId!,
      { fixtureCount: r.count, lastAttendance: r.lastAttendance },
    ]),
  );

  return rows.map((v) => ({
    ...v,
    teamName: v.teamId ? teamById[v.teamId] : null,
    fixtureCount: countByVenue[v.id]?.fixtureCount ?? 0,
    lastAttendance: countByVenue[v.id]?.lastAttendance ?? v.recordAttendance ?? null,
  }));
}

export async function getVenueById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
  return row ?? null;
}

export async function getVenueDetail(id: string) {
  const venue = await getVenueById(id);
  if (!venue) return null;

  const db = getDb();
  const team = venue.teamId
    ? await db
        .select()
        .from(teams)
        .where(eq(teams.id, venue.teamId))
        .limit(1)
        .then((r) => r[0])
    : null;

  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.venueId, id))
    .orderBy(desc(fixtures.kickoffAt));

  const allTeams = await db.select().from(teams);
  const teamById = Object.fromEntries(allTeams.map((t) => [t.id, t]));

  const fixtureList = fixtureRows.map((f) => ({
    id: f.id,
    slug: f.slug,
    kickoffAt: f.kickoffAt,
    status: f.status,
    attendance: f.attendance,
    homeTeam: f.homeTeamId ? teamById[f.homeTeamId]?.name : null,
    awayTeam: f.awayTeamId ? teamById[f.awayTeamId]?.name : null,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    competitionName: f.competitionName,
  }));

  return { venue, team, fixtures: fixtureList };
}

export async function createVenue(input: {
  name: string;
  slug?: string;
  city?: string;
  countryName?: string;
  capacity?: number;
  teamId?: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Venue name is required");
  const slug = normalizeSlug(input.slug || name);
  const slugErr = validateSlug(slug);
  if (slugErr) throw new Error(slugErr);

  const db = getDb();
  const [row] = await db
    .insert(venues)
    .values({
      name,
      slug,
      city: input.city?.trim() || null,
      countryName: input.countryName?.trim() || null,
      capacity: input.capacity ?? null,
      teamId: input.teamId || null,
    })
    .returning();

  if (row.teamId) {
    await db.update(teams).set({ homeVenueId: row.id }).where(eq(teams.id, row.teamId));
  }
  return row;
}

export async function applyVenueWikipediaArchive(venueId: string, archive: WikipediaVenueArchive) {
  const db = getDb();
  const [existing] = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
  if (!existing) throw new Error("Venue not found");

  const [row] = await db
    .update(venues)
    .set({
      ...(archive.capacity != null ? { capacity: archive.capacity } : {}),
      ...(archive.recordAttendance != null ? { recordAttendance: archive.recordAttendance } : {}),
      ...(archive.city && !existing.city ? { city: archive.city } : {}),
      ...(archive.countryName && !existing.countryName ? { countryName: archive.countryName } : {}),
      wikipediaUrl: archive.wikipediaUrl,
      wikidataId: archive.wikidataId ?? null,
      archiveSyncedAt: new Date(),
    })
    .where(eq(venues.id, venueId))
    .returning();

  return row;
}

export async function updateVenue(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    city: string;
    countryName: string;
    capacity: number | null;
    teamId: string | null;
  }>,
) {
  const db = getDb();
  const [existing] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
  if (!existing) throw new Error("Venue not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const [row] = await db
    .update(venues)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.city !== undefined ? { city: input.city.trim() || null } : {}),
      ...(input.countryName !== undefined ? { countryName: input.countryName.trim() || null } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId || null } : {}),
    })
    .where(eq(venues.id, id))
    .returning();

  if (row.teamId) {
    await db.update(teams).set({ homeVenueId: row.id }).where(eq(teams.id, row.teamId));
  }
  return row;
}

export async function deleteVenue(id: string) {
  const db = getDb();
  await db.update(fixtures).set({ venueId: null }).where(eq(fixtures.venueId, id));
  await db.update(teams).set({ homeVenueId: null }).where(eq(teams.homeVenueId, id));
  const [row] = await db.delete(venues).where(eq(venues.id, id)).returning({ id: venues.id });
  if (!row) throw new Error("Venue not found");
  return row;
}
