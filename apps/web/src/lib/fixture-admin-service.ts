import { asc, desc, eq, ilike } from "drizzle-orm";
import { coaches, fixtures, matchEvents, referees, teams, venues } from "@rugby365/db";
import { getDb } from "./db";
import { normalizeSlug, validateSlug } from "./fixture-slug";

export type { FixtureSlugFormat } from "./fixture-slug";
export {
  buildFixtureSlug,
  FIXTURE_SLUG_FORMAT_OPTIONS,
  normalizeSlug,
  validateSlug,
} from "./fixture-slug";

export type FixtureInput = {
  slug: string;
  homeTeamId: string;
  awayTeamId: string;
  competitionId?: string | null;
  competitionName?: string;
  kickoffAt?: string | null;
  status?: string;
  sport365Url?: string | null;
  planetRugbyUrl?: string | null;
  externalMatchId?: string | null;
  venueId?: string | null;
  attendance?: number | null;
  refereeId?: string | null;
  homeCoachId?: string | null;
  awayCoachId?: string | null;
  round?: string | null;
};

function extractExternalMatchId(sport365Url?: string | null, planetRugbyUrl?: string | null): string | null {
  if (sport365Url) {
    try {
      const last = new URL(sport365Url).pathname.split("/").filter(Boolean).at(-1) ?? "";
      if (/^\d+-\d+$/.test(last)) return last;
    } catch {
      /* ignore */
    }
  }
  if (planetRugbyUrl) {
    try {
      const parts = new URL(planetRugbyUrl).pathname.split("/").filter(Boolean);
      const matchIdx = parts.indexOf("matches");
      if (matchIdx >= 0 && parts[matchIdx + 1]) return parts[matchIdx + 1];
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function listTeams() {
  const db = getDb();
  return db.select().from(teams).orderBy(asc(teams.name));
}

export async function listFixtures() {
  const db = getDb();
  const rows = await db.select().from(fixtures).orderBy(desc(fixtures.kickoffAt));
  const teamRows = await listTeams();
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  return rows.map((f) => ({
    ...f,
    homeTeam: f.homeTeamId ? teamById[f.homeTeamId] : null,
    awayTeam: f.awayTeamId ? teamById[f.awayTeamId] : null,
  }));
}

export async function getFixtureById(id: string) {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
  if (!fixture) return null;
  const teamRows = await listTeams();
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  const venue =
    fixture.venueId != null
      ? await db
          .select({
            id: venues.id,
            name: venues.name,
            slug: venues.slug,
            city: venues.city,
            countryName: venues.countryName,
            capacity: venues.capacity,
            recordAttendance: venues.recordAttendance,
          })
          .from(venues)
          .where(eq(venues.id, fixture.venueId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
  const referee =
    fixture.refereeId != null
      ? await db
          .select({ id: referees.id, name: referees.name, slug: referees.slug, countryName: referees.countryName })
          .from(referees)
          .where(eq(referees.id, fixture.refereeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
  const homeCoach =
    fixture.homeCoachId != null
      ? await db
          .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
          .from(coaches)
          .where(eq(coaches.id, fixture.homeCoachId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
  const awayCoach =
    fixture.awayCoachId != null
      ? await db
          .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
          .from(coaches)
          .where(eq(coaches.id, fixture.awayCoachId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
  return {
    ...fixture,
    homeTeam: fixture.homeTeamId ? teamById[fixture.homeTeamId] : null,
    awayTeam: fixture.awayTeamId ? teamById[fixture.awayTeamId] : null,
    venue,
    referee,
    homeCoach,
    awayCoach,
  };
}

export async function listFixtureEvents(fixtureId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(asc(matchEvents.sequenceNo));
  const teamRows = await listTeams();
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  return rows.map((event) => ({
    ...event,
    team: event.teamId ? teamById[event.teamId] : null,
  }));
}

export async function getFixtureAdminDetail(id: string) {
  const fixture = await getFixtureById(id);
  if (!fixture) return null;
  const events = await listFixtureEvents(id);
  return { fixture, events, eventCount: events.length };
}

export async function findFixtureBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  const db = getDb();
  const [row] = await db.select().from(fixtures).where(eq(fixtures.slug, normalized)).limit(1);
  return row ?? null;
}

export async function findFixtureByExternalMatchId(externalMatchId: string) {
  const id = externalMatchId.trim();
  if (!id) return null;
  const db = getDb();
  const [row] = await db.select().from(fixtures).where(eq(fixtures.externalMatchId, id)).limit(1);
  return row ?? null;
}

/** Resolve CMS fixture for an SDMS match id (external id or Planet Rugby URL). */
export async function findFixtureBySdmsMatchId(matchId: string) {
  const id = matchId.trim();
  if (!id) return null;
  const byExternal = await findFixtureByExternalMatchId(id);
  if (byExternal) return byExternal;

  const db = getDb();
  const [byPlanetUrl] = await db
    .select()
    .from(fixtures)
    .where(ilike(fixtures.planetRugbyUrl, `%/matches/${id}/%`))
    .limit(1);
  return byPlanetUrl ?? null;
}

export async function allocateUniqueFixtureSlug(baseSlug: string, excludeFixtureId?: string): Promise<string> {
  const normalized = normalizeSlug(baseSlug);
  let candidate = normalized;
  let suffix = 2;
  while (suffix < 100) {
    const existing = await findFixtureBySlug(candidate);
    if (!existing || existing.id === excludeFixtureId) return candidate;
    candidate = normalizeSlug(`${normalized}-${suffix}`);
    suffix += 1;
  }
  throw new Error(`Could not allocate a unique slug for ${baseSlug}`);
}

export async function createFixture(input: FixtureInput) {
  const slug = normalizeSlug(input.slug);
  const slugErr = validateSlug(slug);
  if (slugErr) throw new Error(slugErr);
  if (input.homeTeamId === input.awayTeamId) throw new Error("Home and away teams must be different");

  const db = getDb();
  const externalMatchId =
    input.externalMatchId?.trim() ||
    extractExternalMatchId(input.sport365Url, input.planetRugbyUrl) ||
    null;

  const [row] = await db
    .insert(fixtures)
    .values({
      slug,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      competitionId: input.competitionId ?? null,
      competitionName: input.competitionName?.trim() || null,
      kickoffAt: input.kickoffAt ? new Date(input.kickoffAt) : null,
      status: input.status ?? "scheduled",
      sport365Url: input.sport365Url?.trim() || null,
      planetRugbyUrl: input.planetRugbyUrl?.trim() || null,
      externalMatchId,
      venueId: input.venueId ?? null,
      attendance: input.attendance ?? null,
      refereeId: input.refereeId ?? null,
      homeCoachId: input.homeCoachId ?? null,
      awayCoachId: input.awayCoachId ?? null,
      round: input.round?.trim() || null,
    })
    .returning();

  return row;
}

export async function updateFixture(id: string, input: Partial<FixtureInput>) {
  const db = getDb();
  const [existing] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
  if (!existing) throw new Error("Fixture not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const homeTeamId = input.homeTeamId ?? existing.homeTeamId;
  const awayTeamId = input.awayTeamId ?? existing.awayTeamId;
  if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
    throw new Error("Home and away teams must be different");
  }

  const sport365Url =
    input.sport365Url !== undefined ? input.sport365Url?.trim() || null : existing.sport365Url;
  const planetRugbyUrl =
    input.planetRugbyUrl !== undefined ? input.planetRugbyUrl?.trim() || null : existing.planetRugbyUrl;
  const externalMatchId =
    input.externalMatchId?.trim() ||
    extractExternalMatchId(sport365Url, planetRugbyUrl) ||
    existing.externalMatchId;

  let venueName = existing.venueName;
  if (input.venueId !== undefined) {
    if (input.venueId) {
      const [venue] = await db.select().from(venues).where(eq(venues.id, input.venueId)).limit(1);
      venueName = venue?.name ?? null;
    } else {
      venueName = null;
    }
  }

  const [row] = await db
    .update(fixtures)
    .set({
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.homeTeamId !== undefined ? { homeTeamId: input.homeTeamId } : {}),
      ...(input.awayTeamId !== undefined ? { awayTeamId: input.awayTeamId } : {}),
      ...(input.competitionId !== undefined ? { competitionId: input.competitionId } : {}),
      ...(input.competitionName !== undefined
        ? { competitionName: input.competitionName?.trim() || null }
        : {}),
      ...(input.kickoffAt !== undefined
        ? { kickoffAt: input.kickoffAt ? new Date(input.kickoffAt) : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sport365Url !== undefined ? { sport365Url } : {}),
      ...(input.planetRugbyUrl !== undefined ? { planetRugbyUrl } : {}),
      externalMatchId,
      ...(input.venueId !== undefined ? { venueId: input.venueId || null, venueName } : {}),
      ...(input.attendance !== undefined ? { attendance: input.attendance } : {}),
      ...(input.refereeId !== undefined ? { refereeId: input.refereeId || null } : {}),
      ...(input.homeCoachId !== undefined ? { homeCoachId: input.homeCoachId || null } : {}),
      ...(input.awayCoachId !== undefined ? { awayCoachId: input.awayCoachId || null } : {}),
      ...(input.round !== undefined ? { round: input.round?.trim() || null } : {}),
    })
    .where(eq(fixtures.id, id))
    .returning();

  return row;
}

export async function deleteFixture(id: string) {
  const db = getDb();
  const [row] = await db.delete(fixtures).where(eq(fixtures.id, id)).returning({ id: fixtures.id });
  if (!row) throw new Error("Fixture not found");
  return row;
}
