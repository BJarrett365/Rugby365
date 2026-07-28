import { and, asc, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  coaches,
  competitionSeasons,
  competitions,
  dataFieldLocks,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  providerEntityMappings,
  referees,
  teamMatchStats,
  teams,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import { normalizeSlug, validateSlug } from "./fixture-slug";
import {
  inferMatchProvider,
  isMatchCmsProvider,
  localDateKey,
  type MatchCmsListFilters,
  type MatchCmsListRow,
  type MatchCmsProvider,
  type MatchCmsSort,
  MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE,
  MATCH_CMS_PAGE_SIZE_DEFAULT,
} from "./match-cms-list-utils";
import { mergeProviderSnapshot } from "./head-to-head-shared";
import { listProviderMappings } from "./provider-mapping-service";
import {
  classifyTodayBucket,
  matchWarningCount,
  rowMatchesOpsBucket,
  type TodayOpsBucket,
} from "./match-cms-warnings";
import { PROVIDER_RUGBY_DATA, WHOLE_RECORD_LOCK_FIELD } from "./provider-mapping-types";
import {
  assertSeasonBelongsToCompetition,
  resolveFixtureSeasonForCompetition,
} from "./fixture-season-resolve-service";
import {
  hasRequiredMatchCmsFilters,
  MATCH_CMS_DEFAULT_TIMEZONE,
  utcDayBoundsFromDateKeys,
} from "./match-cms-date-bounds";

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
  seasonId?: string | null;
  kickoffAt?: string | null;
  status?: string;
  sport365Url?: string | null;
  planetRugbyUrl?: string | null;
  watchalongYoutubeUrl?: string | null;
  highlightsYoutubeUrl?: string | null;
  externalMatchId?: string | null;
  venueId?: string | null;
  attendance?: number | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  additionalInfo?: string | null;
  weatherNote?: string | null;
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

/**
 * Paginated CMS match list — lean rows only (no lineups/stats/raw payloads).
 * Additive; does not replace listFixtures().
 */
export async function listFixturesCms(filters: MatchCmsListFilters = {}): Promise<{
  matches: MatchCmsListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  opsSummary?: Record<string, number>;
}> {
  const db = getDb();
  const isTodayOps = filters.ops === "today";
  const today = localDateKey();
  const fromDate = isTodayOps ? filters.fromDate || today : filters.fromDate;
  const toDate = isTodayOps ? filters.toDate || today : filters.toDate;

  if (!hasRequiredMatchCmsFilters({ fromDate, toDate })) {
    throw new Error(MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = isTodayOps
    ? Math.min(200, Math.max(1, filters.pageSize ?? 200))
    : Math.min(200, Math.max(1, filters.pageSize ?? MATCH_CMS_PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;
  const sort = (filters.sort ?? "kickoff") as MatchCmsSort;
  const sortDir =
    filters.sortDir === "asc" || filters.sortDir === "desc"
      ? filters.sortDir
      : isTodayOps
        ? "asc"
        : "desc";

  const homeTeam = alias(teams, "cms_home_team");
  const awayTeam = alias(teams, "cms_away_team");
  const rugbyDataMap = alias(providerEntityMappings, "cms_rugby_data_map");

  const hasLineupsExpr = sql<boolean>`(
    exists(select 1 from ${fixturePlayers} fp where fp.fixture_id = ${fixtures.id})
    or (${fixtures.providerSnapshot} -> 'lineups') is not null
    or (${fixtures.providerSnapshot} -> 'sport365' -> 'lineups') is not null
  )`;
  const hasTeamStatsExpr = sql<boolean>`exists(
    select 1 from ${teamMatchStats} tms where tms.fixture_id = ${fixtures.id}
  )`;
  const hasPlayerStatsExpr = sql<boolean>`exists(
    select 1 from ${playerMatchPerformanceStats} pms where pms.fixture_id = ${fixtures.id}
  )`;
  const scoreLockedExpr = sql<boolean>`exists(
    select 1 from ${dataFieldLocks} dfl
    where dfl.entity_type = 'match'
      and dfl.entity_id = ${fixtures.id}
      and dfl.field in ('homeScore', 'awayScore', ${WHOLE_RECORD_LOCK_FIELD})
  )`;
  const statusLockedExpr = sql<boolean>`exists(
    select 1 from ${dataFieldLocks} dfl
    where dfl.entity_type = 'match'
      and dfl.entity_id = ${fixtures.id}
      and dfl.field in ('status', ${WHOLE_RECORD_LOCK_FIELD})
  )`;

  const conditions = [];

  const { start, endExclusive } = utcDayBoundsFromDateKeys({
    fromDate: fromDate!,
    toDate: toDate!,
    timeZone: MATCH_CMS_DEFAULT_TIMEZONE,
  });
  conditions.push(gte(fixtures.kickoffAt, start));
  conditions.push(lt(fixtures.kickoffAt, endExclusive));
  if (filters.competitionId?.trim()) {
    conditions.push(eq(fixtures.competitionId, filters.competitionId.trim()));
  }
  if (filters.seasonId) {
    conditions.push(eq(fixtures.seasonId, filters.seasonId));
  }
  if (filters.status) {
    conditions.push(eq(fixtures.status, filters.status));
  }
  if (filters.teamQuery?.trim()) {
    const q = `%${filters.teamQuery.trim()}%`;
    conditions.push(or(ilike(homeTeam.name, q), ilike(awayTeam.name, q)));
  }

  if (filters.provider) {
    const p = filters.provider;
    if (p === "rugby_data") {
      conditions.push(sql`${rugbyDataMap.externalId} is not null`);
    } else if (p === "livesport") {
      conditions.push(sql`${fixtures.externalMatchId} like 'livesport:%'`);
    } else if (p === "wikipedia") {
      conditions.push(sql`${fixtures.externalMatchId} like 'wikipedia:%'`);
    } else if (p === "sport365") {
      conditions.push(sql`${fixtures.sport365Url} is not null and ${fixtures.sport365Url} <> ''`);
    } else if (p === "planet_rugby") {
      conditions.push(
        sql`(
          (${fixtures.planetRugbyUrl} is not null and ${fixtures.planetRugbyUrl} <> '')
          or (
            ${fixtures.externalMatchId} is not null
            and ${fixtures.externalMatchId} <> ''
            and ${fixtures.externalMatchId} not like '%:%'
            and (${fixtures.sport365Url} is null or ${fixtures.sport365Url} = '')
          )
        )`,
      );
    } else if (p === "manual") {
      conditions.push(
        sql`(
          (${fixtures.externalMatchId} is null or ${fixtures.externalMatchId} = '')
          and (${fixtures.sport365Url} is null or ${fixtures.sport365Url} = '')
          and (${fixtures.planetRugbyUrl} is null or ${fixtures.planetRugbyUrl} = '')
          and ${rugbyDataMap.externalId} is null
        )`,
      );
    }
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const orderColumn = (() => {
    switch (sort) {
      case "competition":
        return competitions.name;
      case "home":
        return homeTeam.name;
      case "away":
        return awayTeam.name;
      case "status":
        return fixtures.status;
      case "provider":
        return fixtures.sport365Url;
      case "id":
        return fixtures.id;
      case "kickoff":
      default:
        return fixtures.kickoffAt;
    }
  })();
  const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);

  const baseFrom = db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      externalMatchId: fixtures.externalMatchId,
      sport365Url: fixtures.sport365Url,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      competitionId: fixtures.competitionId,
      competitionName: competitions.name,
      competitionNameFallback: fixtures.competitionName,
      seasonId: fixtures.seasonId,
      seasonLabel: competitionSeasons.label,
      homeTeamId: fixtures.homeTeamId,
      homeTeamName: homeTeam.name,
      awayTeamId: fixtures.awayTeamId,
      awayTeamName: awayTeam.name,
      venueId: fixtures.venueId,
      refereeId: fixtures.refereeId,
      rugbyDataExternalId: rugbyDataMap.externalId,
      primarySource: sql<string | null>`(${fixtures.providerSnapshot} ->> 'primarySource')`,
      hasLineups: hasLineupsExpr,
      hasTeamStats: hasTeamStatsExpr,
      hasPlayerStats: hasPlayerStatsExpr,
      scoreLocked: scoreLockedExpr,
      statusLocked: statusLockedExpr,
    })
    .from(fixtures)
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .leftJoin(competitionSeasons, eq(fixtures.seasonId, competitionSeasons.id))
    .leftJoin(
      rugbyDataMap,
      and(
        eq(rugbyDataMap.entityType, "match"),
        eq(rugbyDataMap.provider, PROVIDER_RUGBY_DATA),
        eq(rugbyDataMap.status, "confirmed"),
        eq(rugbyDataMap.rugby365Id, fixtures.id),
      ),
    );

  const rows = await (whereClause ? baseFrom.where(whereClause) : baseFrom)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  const countQuery = db
    .select({ value: count() })
    .from(fixtures)
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .leftJoin(
      rugbyDataMap,
      and(
        eq(rugbyDataMap.entityType, "match"),
        eq(rugbyDataMap.provider, PROVIDER_RUGBY_DATA),
        eq(rugbyDataMap.status, "confirmed"),
        eq(rugbyDataMap.rugby365Id, fixtures.id),
      ),
    );

  const [totalRow] = await (whereClause ? countQuery.where(whereClause) : countQuery);
  const total = Number(totalRow?.value ?? 0);

  const matches: MatchCmsListRow[] = rows.map((row) => {
    const provider = inferMatchProvider({
      externalMatchId: row.externalMatchId,
      sport365Url: row.sport365Url,
      planetRugbyUrl: row.planetRugbyUrl,
      rugbyDataExternalId: row.rugbyDataExternalId,
      primarySource: row.primarySource,
    }) as MatchCmsProvider;

    const hasLineups = Boolean(row.hasLineups);
    const hasTeamStats = Boolean(row.hasTeamStats);
    const hasPlayerStats = Boolean(row.hasPlayerStats);
    const primaryApiMatchId = row.rugbyDataExternalId ?? null;
    const warningCount = matchWarningCount({
      competitionId: row.competitionId,
      seasonId: row.seasonId,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      venueId: row.venueId,
      refereeId: row.refereeId,
      hasLineups,
      hasTeamStats,
      hasPlayerStats,
      primaryApiMatchId,
      status: row.status,
    });

    return {
      id: row.id,
      slug: row.slug,
      kickoffAt: row.kickoffAt ? row.kickoffAt.toISOString() : null,
      status: row.status,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      externalMatchId: row.externalMatchId,
      primaryApiMatchId,
      provider,
      competitionId: row.competitionId,
      competitionName: row.competitionName ?? row.competitionNameFallback,
      seasonId: row.seasonId,
      seasonLabel: row.seasonLabel,
      homeTeamId: row.homeTeamId,
      homeTeamName: row.homeTeamName,
      awayTeamId: row.awayTeamId,
      awayTeamName: row.awayTeamName,
      venueId: row.venueId,
      refereeId: row.refereeId,
      hasLineups,
      hasTeamStats,
      hasPlayerStats,
      scoreLocked: Boolean(row.scoreLocked),
      statusLocked: Boolean(row.statusLocked),
      warningCount,
    };
  });

  let filtered = matches;
  if (isTodayOps && filters.opsBucket && filters.opsBucket !== "all") {
    filtered = matches.filter((m) =>
      rowMatchesOpsBucket(m, filters.opsBucket as TodayOpsBucket),
    );
  }

  const opsSummary = isTodayOps
    ? (() => {
        const summary: Record<string, number> = {
          all: matches.length,
          live: 0,
          starting_soon: 0,
          upcoming: 0,
          finished: 0,
          missing_data: 0,
          unmapped: 0,
          missing_lineups: 0,
          missing_venue: 0,
          missing_referee: 0,
        };
        for (const m of matches) {
          if (m.warningCount > 0) summary.missing_data += 1;
          for (const b of classifyTodayBucket(m)) {
            summary[b] = (summary[b] ?? 0) + 1;
          }
        }
        return summary;
      })()
    : undefined;

  return {
    matches: filtered,
    total: isTodayOps && filters.opsBucket && filters.opsBucket !== "all" ? filtered.length : total,
    page,
    pageSize,
    totalPages: Math.max(
      1,
      Math.ceil(
        (isTodayOps && filters.opsBucket && filters.opsBucket !== "all" ? filtered.length : total) /
          pageSize,
      ),
    ),
    opsSummary,
  };
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
            latitude: venues.latitude,
            longitude: venues.longitude,
            countryCode: venues.countryCode,
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
  const competition =
    fixture.competitionId != null
      ? await db
          .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
          .from(competitions)
          .where(eq(competitions.id, fixture.competitionId))
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
    competition,
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

  const competitionId = input.competitionId ?? null;
  const kickoffAt = input.kickoffAt ? new Date(input.kickoffAt) : null;
  const seasonId = await resolveSeasonIdForWrite({
    competitionId,
    kickoffAt,
    explicitSeasonId: input.seasonId,
    hasExplicitSeasonId: input.seasonId !== undefined,
  });

  const [row] = await db
    .insert(fixtures)
    .values({
      slug,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      competitionId,
      competitionName: input.competitionName?.trim() || null,
      seasonId,
      kickoffAt,
      status: input.status ?? "scheduled",
      sport365Url: input.sport365Url?.trim() || null,
      planetRugbyUrl: input.planetRugbyUrl?.trim() || null,
      externalMatchId,
      venueId: input.venueId ?? null,
      attendance: input.attendance ?? null,
      halfTimeHome: input.halfTimeHome ?? null,
      halfTimeAway: input.halfTimeAway ?? null,
      additionalInfo: input.additionalInfo?.trim() || null,
      weatherNote: input.weatherNote?.trim() || null,
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

  const competitionId =
    input.competitionId !== undefined ? input.competitionId : existing.competitionId;
  const kickoffAt =
    input.kickoffAt !== undefined
      ? input.kickoffAt
        ? new Date(input.kickoffAt)
        : null
      : existing.kickoffAt;

  const shouldResolveSeason =
    input.seasonId !== undefined ||
    input.competitionId !== undefined ||
    input.kickoffAt !== undefined ||
    existing.seasonId == null;

  const seasonId = shouldResolveSeason
    ? await resolveSeasonIdForWrite({
        competitionId,
        kickoffAt,
        explicitSeasonId: input.seasonId,
        hasExplicitSeasonId: input.seasonId !== undefined,
        fallbackSeasonId: existing.seasonId,
      })
    : existing.seasonId;

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
      ...(shouldResolveSeason ? { seasonId } : {}),
      ...(input.kickoffAt !== undefined
        ? { kickoffAt: input.kickoffAt ? new Date(input.kickoffAt) : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sport365Url !== undefined ? { sport365Url } : {}),
      ...(input.planetRugbyUrl !== undefined ? { planetRugbyUrl } : {}),
      ...(input.watchalongYoutubeUrl !== undefined
        ? { watchalongYoutubeUrl: input.watchalongYoutubeUrl?.trim() || null }
        : {}),
      ...(input.highlightsYoutubeUrl !== undefined
        ? { highlightsYoutubeUrl: input.highlightsYoutubeUrl?.trim() || null }
        : {}),
      externalMatchId,
      ...(input.venueId !== undefined ? { venueId: input.venueId || null, venueName } : {}),
      ...(input.attendance !== undefined ? { attendance: input.attendance } : {}),
      ...(input.halfTimeHome !== undefined ? { halfTimeHome: input.halfTimeHome } : {}),
      ...(input.halfTimeAway !== undefined ? { halfTimeAway: input.halfTimeAway } : {}),
      ...(input.additionalInfo !== undefined
        ? { additionalInfo: input.additionalInfo?.trim() || null }
        : {}),
      ...(input.weatherNote !== undefined
        ? { weatherNote: input.weatherNote?.trim() || null }
        : {}),
      ...(input.refereeId !== undefined ? { refereeId: input.refereeId || null } : {}),
      ...(input.homeCoachId !== undefined ? { homeCoachId: input.homeCoachId || null } : {}),
      ...(input.awayCoachId !== undefined ? { awayCoachId: input.awayCoachId || null } : {}),
      ...(input.round !== undefined ? { round: input.round?.trim() || null } : {}),
    })
    .where(eq(fixtures.id, id))
    .returning();

  return row;
}

export type FixtureSourcesInput = {
  primarySource?: string | null;
  sport365Url?: string | null;
  planetRugbyUrl?: string | null;
  externalMatchId?: string | null;
};

export type FixtureSourcesState = {
  fixtureId: string;
  primarySource: MatchCmsProvider;
  inferredSource: MatchCmsProvider;
  sport365Url: string | null;
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  rugbyDataExternalId: string | null;
  rugbyDataMappingStatus: string | null;
  connections: Record<MatchCmsProvider, boolean>;
};

function readPrimarySourceFromSnapshot(
  snapshot: unknown,
): MatchCmsProvider | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = (snapshot as Record<string, unknown>).primarySource;
  if (typeof value === "string" && isMatchCmsProvider(value)) return value;
  return null;
}

export async function getFixtureSourcesState(fixtureId: string): Promise<FixtureSourcesState | null> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return null;

  const rugbyMaps = await listProviderMappings({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    rugby365Id: fixtureId,
    limit: 5,
  });
  const confirmed = rugbyMaps.find((m) => m.status === "confirmed") ?? rugbyMaps[0] ?? null;
  const rugbyDataExternalId = confirmed?.externalId ?? null;

  const inferredSource = inferMatchProvider({
    externalMatchId: fixture.externalMatchId,
    sport365Url: fixture.sport365Url,
    planetRugbyUrl: fixture.planetRugbyUrl,
    rugbyDataExternalId,
  });
  const primarySource =
    readPrimarySourceFromSnapshot(fixture.providerSnapshot) ?? inferredSource;

  const connections: Record<MatchCmsProvider, boolean> = {
    rugby_data: Boolean(rugbyDataExternalId),
    planet_rugby: Boolean(fixture.planetRugbyUrl?.trim() || (fixture.externalMatchId && !fixture.externalMatchId.includes(":"))),
    sport365: Boolean(fixture.sport365Url?.trim()),
    livesport: Boolean(fixture.externalMatchId?.startsWith("livesport:")),
    wikipedia: Boolean(fixture.externalMatchId?.startsWith("wikipedia:")),
    manual: !fixture.planetRugbyUrl?.trim() && !fixture.sport365Url?.trim() && !fixture.externalMatchId?.trim() && !rugbyDataExternalId,
  };

  return {
    fixtureId,
    primarySource,
    inferredSource,
    sport365Url: fixture.sport365Url,
    planetRugbyUrl: fixture.planetRugbyUrl,
    externalMatchId: fixture.externalMatchId,
    rugbyDataExternalId,
    rugbyDataMappingStatus: confirmed?.status ?? null,
    connections,
  };
}

export async function updateFixtureSources(id: string, input: FixtureSourcesInput) {
  const db = getDb();
  const [existing] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
  if (!existing) throw new Error("Fixture not found");

  if (input.primarySource != null && input.primarySource !== "" && !isMatchCmsProvider(input.primarySource)) {
    throw new Error(`Unknown primary source: ${input.primarySource}`);
  }

  const sport365Url =
    input.sport365Url !== undefined ? input.sport365Url?.trim() || null : existing.sport365Url;
  const planetRugbyUrl =
    input.planetRugbyUrl !== undefined ? input.planetRugbyUrl?.trim() || null : existing.planetRugbyUrl;

  let externalMatchId =
    input.externalMatchId !== undefined
      ? input.externalMatchId?.trim() || null
      : existing.externalMatchId;

  if (input.externalMatchId === undefined) {
    externalMatchId =
      extractExternalMatchId(sport365Url, planetRugbyUrl) || existing.externalMatchId;
  }

  const existingSnap =
    existing.providerSnapshot && typeof existing.providerSnapshot === "object"
      ? (existing.providerSnapshot as Record<string, unknown>)
      : {};

  const nextSnap =
    input.primarySource !== undefined
      ? mergeProviderSnapshot(existingSnap, {
          primarySource: input.primarySource?.trim() || null,
          primarySourceSetAt: new Date().toISOString(),
        })
      : existingSnap;

  const [row] = await db
    .update(fixtures)
    .set({
      ...(input.sport365Url !== undefined ? { sport365Url } : {}),
      ...(input.planetRugbyUrl !== undefined ? { planetRugbyUrl } : {}),
      ...(input.externalMatchId !== undefined ||
      input.sport365Url !== undefined ||
      input.planetRugbyUrl !== undefined
        ? { externalMatchId }
        : {}),
      ...(input.primarySource !== undefined ? { providerSnapshot: nextSnap } : {}),
    })
    .where(eq(fixtures.id, id))
    .returning();

  return row;
}

async function resolveSeasonIdForWrite(input: {
  competitionId: string | null | undefined;
  kickoffAt: Date | string | null | undefined;
  explicitSeasonId?: string | null;
  hasExplicitSeasonId: boolean;
  fallbackSeasonId?: string | null;
}): Promise<string | null> {
  if (input.hasExplicitSeasonId) {
    const explicit = input.explicitSeasonId?.trim() || null;
    if (!explicit) return null;
    if (!input.competitionId) {
      throw new Error("Competition is required when setting seasonId");
    }
    await assertSeasonBelongsToCompetition(explicit, input.competitionId);
    return explicit;
  }

  if (!input.competitionId || !input.kickoffAt) {
    return input.fallbackSeasonId ?? null;
  }

  const resolved = await resolveFixtureSeasonForCompetition({
    competitionId: input.competitionId,
    kickoffAt: input.kickoffAt,
    createIfMissing: false,
  });

  if (resolved.seasonId) return resolved.seasonId;
  return input.fallbackSeasonId ?? null;
}

export async function deleteFixture(id: string) {
  const db = getDb();
  const [row] = await db.delete(fixtures).where(eq(fixtures.id, id)).returning({ id: fixtures.id });
  if (!row) throw new Error("Fixture not found");
  return row;
}
