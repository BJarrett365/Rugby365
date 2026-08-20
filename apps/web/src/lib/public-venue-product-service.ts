/**
 * Public Venues product — ONE canonical venues table + fixture/team joins.
 * Editorial rankings stored separately; never hardcode country/competition lists.
 */
import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  teams,
  venueEditorialRankings,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import { countryNameToIsoCode } from "./open-meteo-service";
import {
  LARGE_CAPACITY_THRESHOLD,
  TOP_LIMIT_OPTIONS,
  avgOrNull,
  buildVenueRankingTitle,
  countryNameToSlug,
  flagUrlForVenue,
  parseVenueType,
  remotenessKm,
  sumOrNull,
  venueFlagIso,
  venueTypeLabel,
} from "./public-venue-product-math";
import {
  deriveVenueType,
  effectiveRugbyCapacity,
  mergeEditorialAndDataRanks,
  type VenueEditorialRow,
  type VenueRankingRow,
} from "./public-venue-ranking-engine";
import type {
  CountryVenueStats,
  DivisionBrowseCard,
  DivisionVenueStats,
  PublicVenueCard,
  PublicVenuesOverview,
  VenueAggregates,
  VenueFacts,
  VenueFilterOptions,
  VenueMapMarker,
  VenueProductCategory,
  VenueProfileCategoryRank,
  VenueRankingFilters,
  VenueTopLimit,
  VenueType,
} from "./public-venue-product-types";

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  countryName: string | null;
  countryCode: string | null;
  capacity: number | null;
  rugbyCapacity: number | null;
  venueType: VenueType | null;
  openedYear: number | null;
  surface: string | null;
  r365Rating: number | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  wikipediaUrl: string | null;
};

type HomeTeamRef = { id: string; name: string; slug: string; homeVenueId: string };

type VenueStatsBundle = {
  fixtureCounts: Map<string, number>;
  intlFixtureCounts: Map<string, number>;
  homeWinPct: Map<string, number>;
  avgAttendancePct: Map<string, number>;
};

function asRows<T>(result: unknown): T[] {
  return result as unknown as T[];
}

function resolveIso(countryName: string | null, countryCode: string | null): string | null {
  const fromName = countryName ? countryNameToIsoCode(countryName) : null;
  return venueFlagIso(countryName, fromName ?? countryCode);
}

function toRankingRow(
  row: VenueRow,
  stats: VenueStatsBundle,
  homeTeamCount: number,
): VenueRankingRow {
  return {
    id: row.id,
    capacity: row.capacity,
    rugbyCapacity: row.rugbyCapacity,
    venueType: row.venueType,
    latitude: row.latitude,
    longitude: row.longitude,
    openedYear: row.openedYear,
    r365Rating: row.r365Rating,
    fixtureCount: stats.fixtureCounts.get(row.id) ?? 0,
    homeWinPct: stats.homeWinPct.get(row.id) ?? null,
    avgAttendancePct: stats.avgAttendancePct.get(row.id) ?? null,
    homeTeamCount,
    intlFixtureCount: stats.intlFixtureCounts.get(row.id) ?? 0,
    wikipediaUrl: row.wikipediaUrl,
  };
}

function toCard(
  row: VenueRow,
  rankMeta: {
    rank: number;
    dataRank: number | null;
    rankSource: PublicVenueCard["rankSource"];
    categoryLabel: string;
    reason: string | null;
    editorialRank: number | null;
    editorialCategory: VenueProductCategory | null;
  },
  extras: {
    homeTeams: PublicVenueCard["homeTeams"];
    fixtureCount: number;
    stats: VenueStatsBundle;
  },
): PublicVenueCard {
  const iso = resolveIso(row.countryName, row.countryCode);
  const lat = row.latitude;
  const lng = row.longitude;
  const rankingRow = toRankingRow(row, extras.stats, extras.homeTeams.length);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    countryName: row.countryName,
    countrySlug: row.countryName ? countryNameToSlug(row.countryName) : null,
    countryCode: row.countryCode,
    flagUrl: flagUrlForVenue(iso),
    capacity: row.capacity,
    rugbyCapacity: row.rugbyCapacity,
    openedYear: row.openedYear,
    surface: row.surface,
    venueType: deriveVenueType(rankingRow),
    r365Rating: row.r365Rating,
    latitude: lat,
    longitude: lng,
    imageUrl: row.imageUrl,
    homeTeams: extras.homeTeams,
    fixtureCount: extras.fixtureCount,
    rank: rankMeta.rank,
    dataRank: rankMeta.dataRank,
    rankSource: rankMeta.rankSource,
    categoryLabel: rankMeta.categoryLabel,
    reason: rankMeta.reason,
    editorialRank: rankMeta.editorialRank,
    editorialCategory: rankMeta.editorialCategory,
    remotenessKm:
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? remotenessKm(lat, lng)
        : null,
  };
}

async function loadAllVenues(): Promise<VenueRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: venues.id,
      slug: venues.slug,
      name: venues.name,
      city: venues.city,
      countryName: venues.countryName,
      countryCode: venues.countryCode,
      capacity: venues.capacity,
      rugbyCapacity: venues.rugbyCapacity,
      venueType: venues.venueType,
      openedYear: venues.openedYear,
      surface: venues.surface,
      r365Rating: venues.r365VenueRating,
      imageUrl: venues.imageUrl,
      latitude: venues.latitude,
      longitude: venues.longitude,
      wikipediaUrl: venues.wikipediaUrl,
    })
    .from(venues)
    .orderBy(asc(venues.name));
  return rows.map((r) => ({
    ...r,
    venueType: parseVenueType(r.venueType),
  }));
}

async function loadEditorialRankings(): Promise<VenueEditorialRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      venueId: venueEditorialRankings.venueId,
      category: venueEditorialRankings.category,
      editorialRank: venueEditorialRankings.editorialRank,
      editorialReason: venueEditorialRankings.editorialReason,
    })
    .from(venueEditorialRankings)
    .where(eq(venueEditorialRankings.isPublished, true));
  return rows;
}

async function loadHomeTeamsByVenue(): Promise<Map<string, PublicVenueCard["homeTeams"]>> {
  const db = getDb();
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      homeVenueId: teams.homeVenueId,
    })
    .from(teams)
    .where(isNotNull(teams.homeVenueId));

  const map = new Map<string, PublicVenueCard["homeTeams"]>();
  for (const t of rows as HomeTeamRef[]) {
    if (!t.homeVenueId) continue;
    const list = map.get(t.homeVenueId) ?? [];
    list.push({ id: t.id, name: t.name, slug: t.slug });
    map.set(t.homeVenueId, list);
  }

  const linked = await db
    .select({ venueId: venues.id, teamId: venues.teamId })
    .from(venues)
    .where(isNotNull(venues.teamId));
  const teamIds = linked.map((r) => r.teamId!).filter(Boolean);
  if (teamIds.length > 0) {
    const teamRows = await db
      .select({ id: teams.id, name: teams.name, slug: teams.slug })
      .from(teams)
      .where(inArray(teams.id, teamIds));
    const byId = new Map(teamRows.map((t) => [t.id, t]));
    for (const link of linked) {
      if (!link.teamId) continue;
      const team = byId.get(link.teamId);
      if (!team) continue;
      const list = map.get(link.venueId) ?? [];
      if (!list.some((t) => t.id === team.id)) {
        list.push(team);
        map.set(link.venueId, list);
      }
    }
  }

  return map;
}

async function loadVenueStatsBundle(): Promise<VenueStatsBundle> {
  const db = getDb();

  const fixtureRows = await db
    .select({
      venueId: fixtures.venueId,
      count: sql<number>`count(*)::int`,
    })
    .from(fixtures)
    .where(isNotNull(fixtures.venueId))
    .groupBy(fixtures.venueId);

  const intlRows = await db.execute(sql`
    select f.venue_id as id, count(*)::int as count
    from fixtures f
    join competitions c on c.id = f.competition_id
    where f.venue_id is not null
      and lower(coalesce(c.competition_type, '')) in ('international', 'world_cup')
    group by f.venue_id
  `);

  const winRows = await db.execute(sql`
    select
      f.venue_id as id,
      count(*) filter (
        where f.status = 'completed'
          and f.is_neutral_venue = false
          and f.home_score > f.away_score
      )::float
      / nullif(
        count(*) filter (where f.status = 'completed' and f.is_neutral_venue = false),
        0
      ) as home_win_pct
    from fixtures f
    where f.venue_id is not null
    group by f.venue_id
  `);

  const attRows = await db.execute(sql`
    select
      f.venue_id as id,
      avg(f.attendance::float / nullif(v.capacity, 0)) as avg_att_pct
    from fixtures f
    join venues v on v.id = f.venue_id
    where f.venue_id is not null
      and f.attendance is not null
      and v.capacity is not null
      and v.capacity > 0
    group by f.venue_id
  `);

  return {
    fixtureCounts: new Map(fixtureRows.map((r) => [r.venueId!, r.count])),
    intlFixtureCounts: new Map(
      asRows<{ id: string; count: number }>(intlRows).map((r) => [r.id, r.count]),
    ),
    homeWinPct: new Map(
      asRows<{ id: string; home_win_pct: number | null }>(winRows)
        .filter((r) => r.home_win_pct != null)
        .map((r) => [r.id, r.home_win_pct!]),
    ),
    avgAttendancePct: new Map(
      asRows<{ id: string; avg_att_pct: number | null }>(attRows)
        .filter((r) => r.avg_att_pct != null)
        .map((r) => [r.id, r.avg_att_pct!]),
    ),
  };
}

async function loadInternationalVenueIds(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.execute(sql`
    select distinct f.venue_id as id
    from fixtures f
    join competitions c on c.id = f.competition_id
    where f.venue_id is not null
      and lower(coalesce(c.competition_type, '')) in ('international', 'world_cup')
  `);
  const set = new Set<string>();
  for (const row of asRows<{ id: string }>(rows)) {
    if (row.id) set.add(row.id);
  }
  return set;
}

function computeAggregates(
  all: VenueRow[],
  internationalIds: Set<string>,
  filter?: (v: VenueRow) => boolean,
): VenueAggregates {
  const rows = filter ? all.filter(filter) : all;
  const caps = rows.map((v) => effectiveRugbyCapacity(v)).filter((c): c is number => c != null);
  const countries = new Set(
    rows.map((v) => v.countryName?.trim()).filter((c): c is string => Boolean(c)),
  );
  const withCoords = rows.filter(
    (v) => v.latitude != null && v.longitude != null && Number.isFinite(v.latitude) && Number.isFinite(v.longitude),
  ).length;
  const intl = rows.filter((v) => internationalIds.has(v.id)).length;
  return {
    totalVenues: rows.length,
    countries: countries.size,
    internationalVenues: intl,
    largeCapacityVenues: caps.filter((c) => c >= LARGE_CAPACITY_THRESHOLD).length,
    withCoordinates: withCoords,
    withCapacity: caps.length,
    totalCapacity: sumOrNull(caps),
    avgCapacity: avgOrNull(caps),
    maxCapacity: caps.length ? Math.max(...caps) : null,
    minCapacity: caps.length ? Math.min(...caps) : null,
  };
}

async function resolveDivisionVenueIds(
  competitionSlug: string,
  seasonId: string | null,
  countrySlug?: string | null,
): Promise<Set<string>> {
  const db = getDb();
  const [comp] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, competitionSlug))
    .limit(1);
  if (!comp) return new Set();

  const fixtureConds = [eq(fixtures.competitionId, comp.id), isNotNull(fixtures.venueId)];
  if (seasonId) fixtureConds.push(eq(fixtures.seasonId, seasonId));

  const fixtureVenues = await db
    .selectDistinct({ venueId: fixtures.venueId })
    .from(fixtures)
    .where(and(...fixtureConds));

  const homeVenues = await db.execute(sql`
    select distinct t.home_venue_id as id
    from fixtures f
    join teams t on t.id = f.home_team_id
    where f.competition_id = ${comp.id}
      and t.home_venue_id is not null
      ${seasonId ? sql`and f.season_id = ${seasonId}` : sql``}
  `);

  const set = new Set<string>();
  for (const r of fixtureVenues) {
    if (r.venueId) set.add(r.venueId);
  }
  for (const r of asRows<{ id: string }>(homeVenues)) {
    if (r.id) set.add(r.id);
  }

  if (countrySlug) {
    const all = await loadAllVenues();
    const inCountry = new Set(
      all
        .filter((v) => v.countryName && countryNameToSlug(v.countryName) === countrySlug)
        .map((v) => v.id),
    );
    for (const id of [...set]) {
      if (!inCountry.has(id)) set.delete(id);
    }
  }

  return set;
}

function filterCohort(
  all: VenueRow[],
  input: {
    countrySlug?: string | null;
    competitionSlug?: string | null;
    divisionVenueIds?: Set<string>;
    venueType?: VenueType | null;
  },
): VenueRow[] {
  let cohort = all;
  if (input.countrySlug) {
    cohort = cohort.filter(
      (v) => v.countryName && countryNameToSlug(v.countryName) === input.countrySlug,
    );
  }
  if (input.divisionVenueIds) {
    cohort = cohort.filter((v) => input.divisionVenueIds!.has(v.id));
  }
  if (input.venueType) {
    cohort = cohort.filter(
      (v) =>
        deriveVenueType(
          toRankingRow(v, { fixtureCounts: new Map(), intlFixtureCounts: new Map(), homeWinPct: new Map(), avgAttendancePct: new Map() }, 0),
        ) === input.venueType,
    );
  }
  return cohort;
}

function rankVenueCards(input: {
  cohort: VenueRow[];
  category: VenueProductCategory;
  editorial: VenueEditorialRow[];
  stats: VenueStatsBundle;
  homeByVenue: Map<string, PublicVenueCard["homeTeams"]>;
  limit: number;
}): PublicVenueCard[] {
  const rankingRows = input.cohort.map((row) =>
    toRankingRow(row, input.stats, (input.homeByVenue.get(row.id) ?? []).length),
  );
  const merged = mergeEditorialAndDataRanks({
    cohort: rankingRows,
    category: input.category,
    editorial: input.editorial,
    limit: input.limit,
  });
  const byId = new Map(input.cohort.map((r) => [r.id, r]));
  return merged
    .map((m) => {
      const row = byId.get(m.venueId);
      if (!row) return null;
      return toCard(
        row,
        {
          rank: m.rank,
          dataRank: m.dataRank,
          rankSource: m.rankSource,
          categoryLabel: m.categoryLabel,
          reason: m.reason,
          editorialRank: m.editorialRank,
          editorialCategory: m.editorialRank != null ? input.category : null,
        },
        {
          homeTeams: input.homeByVenue.get(row.id) ?? [],
          fixtureCount: input.stats.fixtureCounts.get(row.id) ?? 0,
          stats: input.stats,
        },
      );
    })
    .filter((c): c is PublicVenueCard => c != null);
}

export async function listCountryVenueStats(): Promise<CountryVenueStats[]> {
  const [all, intl] = await Promise.all([
    loadAllVenues(),
    loadInternationalVenueIds(),
  ]);

  const byCountry = new Map<string, VenueRow[]>();
  for (const v of all) {
    const name = v.countryName?.trim();
    if (!name) continue;
    const list = byCountry.get(name) ?? [];
    list.push(v);
    byCountry.set(name, list);
  }

  const stats: CountryVenueStats[] = [];
  for (const [countryName, rows] of byCountry) {
    const slug = countryNameToSlug(countryName);
    const caps = rows
      .map((v) => effectiveRugbyCapacity(v))
      .filter((c): c is number => c != null && Number.isFinite(c));
    const largest = [...rows]
      .filter((v) => effectiveRugbyCapacity(v) != null)
      .sort((a, b) => (effectiveRugbyCapacity(b) ?? 0) - (effectiveRugbyCapacity(a) ?? 0))[0];
    const iso = resolveIso(countryName, rows.find((r) => r.countryCode)?.countryCode ?? null);
    stats.push({
      countryName,
      countrySlug: slug,
      countryCode: rows.find((r) => r.countryCode)?.countryCode ?? null,
      flagUrl: flagUrlForVenue(iso),
      venueCount: rows.length,
      internationalVenueCount: rows.filter((v) => intl.has(v.id)).length,
      totalCapacity: sumOrNull(caps),
      avgCapacity: avgOrNull(caps),
      maxCapacity: caps.length ? Math.max(...caps) : null,
      minCapacity: caps.length ? Math.min(...caps) : null,
      withCoordinates: rows.filter((v) => v.latitude != null && v.longitude != null).length,
      largestVenue: largest
        ? { name: largest.name, slug: largest.slug, capacity: effectiveRugbyCapacity(largest) }
        : null,
      topRatedVenue: null,
      competitions: [],
    });
  }

  return stats.sort((a, b) => b.venueCount - a.venueCount || a.countryName.localeCompare(b.countryName));
}

async function listCompetitionsForCountry(countrySlug: string): Promise<DivisionBrowseCard[]> {
  const allDivisions = await listDivisionBrowseCards();
  const all = await loadAllVenues();
  const countryVenueIds = new Set(
    all
      .filter((v) => v.countryName && countryNameToSlug(v.countryName) === countrySlug)
      .map((v) => v.id),
  );
  const result: DivisionBrowseCard[] = [];
  for (const d of allDivisions) {
    const ids = await resolveDivisionVenueIds(d.competitionSlug, null, countrySlug);
    const inCountry = [...ids].filter((id) => countryVenueIds.has(id));
    if (inCountry.length === 0) continue;
    result.push({ ...d, venueCount: inCountry.length });
  }
  return result.sort((a, b) => b.venueCount - a.venueCount);
}

export async function getCountryVenueStats(countrySlug: string): Promise<CountryVenueStats | null> {
  const base = await listCountryVenueStats();
  const stats = base.find((c) => c.countrySlug === countrySlug);
  if (!stats) return null;
  const competitions = await listCompetitionsForCountry(countrySlug);
  return { ...stats, competitions };
}

export async function listDivisionBrowseCards(): Promise<DivisionBrowseCard[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    with fixture_venues as (
      select f.competition_id,
             f.venue_id,
             t.home_venue_id,
             f.home_team_id
      from fixtures f
      left join teams t on t.id = f.home_team_id
      where f.competition_id is not null
    ),
    venue_set as (
      select competition_id, venue_id as vid from fixture_venues where venue_id is not null
      union
      select competition_id, home_venue_id as vid from fixture_venues where home_venue_id is not null
    ),
    team_set as (
      select distinct competition_id, home_team_id as tid
      from fixture_venues
      where home_team_id is not null
    )
    select
      c.id as competition_id,
      c.slug as competition_slug,
      c.name as competition_name,
      c.competition_type,
      count(distinct vs.vid)::int as venue_count,
      count(distinct ts.tid)::int as team_count,
      count(distinct v.country_name)::int as country_count,
      avg(v.capacity)::int as avg_capacity,
      max(v.capacity) as max_capacity
    from competitions c
    join venue_set vs on vs.competition_id = c.id
    left join team_set ts on ts.competition_id = c.id
    left join venues v on v.id = vs.vid
    group by c.id, c.slug, c.name, c.competition_type
    having count(distinct vs.vid) > 0
    order by count(distinct vs.vid) desc, c.name asc
  `);

  return asRows<{
    competition_id: string;
    competition_slug: string;
    competition_name: string;
    competition_type: string | null;
    venue_count: number;
    team_count: number;
    country_count: number;
    avg_capacity: number | null;
    max_capacity: number | null;
  }>(rows).map((r) => ({
    competitionId: r.competition_id,
    competitionSlug: r.competition_slug,
    competitionName: r.competition_name,
    competitionType: r.competition_type,
    venueCount: r.venue_count,
    teamCount: r.team_count,
    countryCount: r.country_count,
    avgCapacity: r.avg_capacity,
    maxCapacity: r.max_capacity,
  }));
}

export async function getFilterOptions(input?: {
  countrySlug?: string | null;
  competitionSlug?: string | null;
}): Promise<VenueFilterOptions> {
  const [countries, competitions, all] = await Promise.all([
    listCountryVenueStats(),
    listDivisionBrowseCards(),
    loadAllVenues(),
  ]);

  let compOptions = competitions;
  if (input?.countrySlug) {
    compOptions = await listCompetitionsForCountry(input.countrySlug);
  }

  let seasons: VenueFilterOptions["seasons"] = [];
  if (input?.competitionSlug) {
    const stats = await getDivisionVenueStats(input.competitionSlug);
    seasons = (stats?.seasons ?? []).map((s) => ({
      value: s.slug,
      label: s.label + (s.isActive ? " (current)" : ""),
    }));
  }

  const typeCounts = new Map<VenueType, number>();
  for (const v of all) {
    const t = deriveVenueType(
      toRankingRow(v, { fixtureCounts: new Map(), intlFixtureCounts: new Map(), homeWinPct: new Map(), avgAttendancePct: new Map() }, 0),
    );
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  return {
    countries: countries.map((c) => ({
      value: c.countrySlug,
      label: c.countryName,
      count: c.venueCount,
    })),
    competitions: compOptions.map((c) => ({
      value: c.competitionSlug,
      label: c.competitionName,
      count: c.venueCount,
    })),
    seasons,
    venueTypes: (["dedicated_rugby", "multi_sport", "occasional_rugby", "historic_rugby"] as VenueType[]).map(
      (t) => ({
        value: t,
        label: venueTypeLabel(t),
        count: typeCounts.get(t) ?? 0,
      }),
    ),
    topLimits: TOP_LIMIT_OPTIONS.map((n) => ({ value: String(n), label: `Top ${n}` })),
  };
}

export async function getVenueAggregates(filters?: { countrySlug?: string }): Promise<VenueAggregates> {
  const [all, intl] = await Promise.all([loadAllVenues(), loadInternationalVenueIds()]);
  if (filters?.countrySlug) {
    const slug = filters.countrySlug;
    return computeAggregates(all, intl, (v) =>
      v.countryName ? countryNameToSlug(v.countryName) === slug : false,
    );
  }
  return computeAggregates(all, intl);
}

export async function getVenueRankings(input: {
  cohort?: "all" | "country" | "division";
  countrySlug?: string;
  competitionSlug?: string;
  seasonId?: string | null;
  venueType?: VenueType | null;
  category: VenueProductCategory;
  limit?: number;
}): Promise<PublicVenueCard[]> {
  const limit = input.limit ?? 24;
  const [all, homeByVenue, stats, editorial] = await Promise.all([
    loadAllVenues(),
    loadHomeTeamsByVenue(),
    loadVenueStatsBundle(),
    loadEditorialRankings(),
  ]);

  let divisionVenueIds: Set<string> | undefined;
  if (input.cohort === "division" && input.competitionSlug) {
    divisionVenueIds = await resolveDivisionVenueIds(
      input.competitionSlug,
      input.seasonId ?? null,
      input.countrySlug ?? null,
    );
  } else if (input.competitionSlug) {
    divisionVenueIds = await resolveDivisionVenueIds(
      input.competitionSlug,
      input.seasonId ?? null,
      input.countrySlug ?? null,
    );
  }

  const cohort = filterCohort(all, {
    countrySlug: input.cohort === "country" ? input.countrySlug : input.countrySlug,
    divisionVenueIds,
    venueType: input.venueType ?? null,
  });

  return rankVenueCards({
    cohort,
    category: input.category,
    editorial,
    stats,
    homeByVenue,
    limit,
  });
}

export async function getDivisionVenueStats(
  competitionSlug: string,
  seasonSlugOrId?: string | null,
): Promise<DivisionVenueStats | null> {
  const db = getDb();
  const [comp] = await db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      competitionType: competitions.competitionType,
    })
    .from(competitions)
    .where(eq(competitions.slug, competitionSlug))
    .limit(1);
  if (!comp) return null;

  const seasons = await db
    .select({
      id: competitionSeasons.id,
      slug: competitionSeasons.slug,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, comp.id))
    .orderBy(desc(competitionSeasons.year));

  let seasonId: string | null = null;
  let seasonLabel: string | null = null;
  if (seasonSlugOrId) {
    const match = seasons.find(
      (s) => s.id === seasonSlugOrId || s.slug === seasonSlugOrId || String(s.year) === seasonSlugOrId,
    );
    if (match) {
      seasonId = match.id;
      seasonLabel = match.label;
    }
  } else {
    const active = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
    if (active) {
      seasonId = active.id;
      seasonLabel = active.label;
    }
  }

  const venueIds = await resolveDivisionVenueIds(comp.slug, seasonId);
  const all = await loadAllVenues();
  const cohort = all.filter((v) => venueIds.has(v.id));
  const caps = cohort
    .map((v) => effectiveRugbyCapacity(v))
    .filter((c): c is number => c != null && Number.isFinite(c));
  const countries = new Set(
    cohort.map((v) => v.countryName?.trim()).filter((c): c is string => Boolean(c)),
  );

  const teamConds = [eq(fixtures.competitionId, comp.id), isNotNull(fixtures.homeTeamId)];
  if (seasonId) teamConds.push(eq(fixtures.seasonId, seasonId));
  const teamRows = await db
    .selectDistinct({ teamId: fixtures.homeTeamId })
    .from(fixtures)
    .where(and(...teamConds));

  return {
    competitionId: comp.id,
    competitionSlug: comp.slug,
    competitionName: comp.name,
    competitionType: comp.competitionType,
    seasonId,
    seasonLabel,
    seasons: seasons.map((s) => ({
      id: s.id,
      slug: s.slug,
      label: s.label,
      year: s.year,
      isActive: s.isActive,
    })),
    teamCount: teamRows.length,
    venueCount: cohort.length,
    countryCount: countries.size,
    totalCapacity: sumOrNull(caps),
    avgCapacity: avgOrNull(caps),
    maxCapacity: caps.length ? Math.max(...caps) : null,
  };
}

export async function getVenueMapMarkers(input?: {
  countrySlug?: string;
  competitionSlug?: string;
  seasonId?: string | null;
}): Promise<VenueMapMarker[]> {
  let all = await loadAllVenues();
  if (input?.countrySlug) {
    all = all.filter(
      (v) => v.countryName && countryNameToSlug(v.countryName) === input.countrySlug,
    );
  }
  if (input?.competitionSlug) {
    const ids = await resolveDivisionVenueIds(
      input.competitionSlug,
      input.seasonId ?? null,
      input.countrySlug ?? null,
    );
    all = all.filter((v) => ids.has(v.id));
  }
  return all
    .filter(
      (v) =>
        v.latitude != null &&
        v.longitude != null &&
        Number.isFinite(v.latitude) &&
        Number.isFinite(v.longitude),
    )
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      latitude: v.latitude!,
      longitude: v.longitude!,
      capacity: effectiveRugbyCapacity(v),
      city: v.city,
      countryName: v.countryName,
    }));
}

function buildFacts(all: VenueRow[]): VenueFacts {
  const withCap = all.filter((v) => effectiveRugbyCapacity(v) != null);
  const largest = [...withCap].sort(
    (a, b) => (effectiveRugbyCapacity(b) ?? 0) - (effectiveRugbyCapacity(a) ?? 0),
  )[0];
  const lowest = [...withCap].sort(
    (a, b) => (effectiveRugbyCapacity(a) ?? 0) - (effectiveRugbyCapacity(b) ?? 0),
  )[0];
  const oldest = [...all]
    .filter((v) => v.openedYear != null)
    .sort((a, b) => (a.openedYear ?? 9999) - (b.openedYear ?? 9999))[0];
  return {
    oldestStadium: oldest
      ? { name: oldest.name, slug: oldest.slug, year: oldest.openedYear }
      : null,
    largestCapacity: largest
      ? { name: largest.name, slug: largest.slug, capacity: effectiveRugbyCapacity(largest) }
      : null,
    highestAltitude: null,
    lowestCapacity: lowest
      ? { name: lowest.name, slug: lowest.slug, capacity: effectiveRugbyCapacity(lowest) }
      : null,
  };
}

export async function getPublicVenuesOverview(input?: Partial<VenueRankingFilters>): Promise<PublicVenuesOverview> {
  const filters: VenueRankingFilters = {
    category: input?.category ?? "best",
    countrySlug: input?.countrySlug ?? null,
    competitionSlug: input?.competitionSlug ?? null,
    seasonSlug: input?.seasonSlug ?? null,
    venueType: input?.venueType ?? null,
    top: input?.top ?? 10,
  };

  const [
    all,
    homeByVenue,
    stats,
    editorial,
    intl,
    countries,
    divisions,
    filterOptions,
  ] = await Promise.all([
    loadAllVenues(),
    loadHomeTeamsByVenue(),
    loadVenueStatsBundle(),
    loadEditorialRankings(),
    loadInternationalVenueIds(),
    listCountryVenueStats(),
    listDivisionBrowseCards(),
    getFilterOptions({
      countrySlug: filters.countrySlug,
      competitionSlug: filters.competitionSlug,
    }),
  ]);

  let divisionVenueIds: Set<string> | undefined;
  if (filters.competitionSlug) {
    const divStats = await getDivisionVenueStats(filters.competitionSlug, filters.seasonSlug);
    const seasonId = divStats?.seasonId ?? null;
    divisionVenueIds = await resolveDivisionVenueIds(
      filters.competitionSlug,
      seasonId,
      filters.countrySlug,
    );
  }

  const cohort = filterCohort(all, {
    countrySlug: filters.countrySlug,
    divisionVenueIds,
    venueType: filters.venueType,
  });

  const aggregates = computeAggregates(cohort, intl);
  const rankedVenues = rankVenueCards({
    cohort,
    category: filters.category,
    editorial,
    stats,
    homeByVenue,
    limit: filters.top ?? 10,
  });
  const byCapacity = rankVenueCards({
    cohort: all,
    category: "biggest",
    editorial,
    stats,
    homeByVenue,
    limit: 5,
  });
  const mostRemote = rankVenueCards({
    cohort: all,
    category: "remote",
    editorial,
    stats,
    homeByVenue,
    limit: 5,
  });

  const featuredEden =
    editorial.find((e) => e.category === "best" && e.editorialRank === 1) ??
    null;
  const featuredVenue =
    (featuredEden
      ? rankedVenues.find((v) => v.id === featuredEden.venueId)
      : null) ??
    rankedVenues[0] ??
    null;

  const countryName = filters.countrySlug
    ? countries.find((c) => c.countrySlug === filters.countrySlug)?.countryName
    : null;
  const competitionName = filters.competitionSlug
    ? divisions.find((d) => d.competitionSlug === filters.competitionSlug)?.competitionName
    : null;

  const pageTitle = buildVenueRankingTitle({
    category: filters.category,
    countryName,
    competitionName,
    top: filters.top,
  });

  const categoryCounts: Partial<Record<VenueProductCategory, number | null>> = {
    best: cohort.length,
    atmosphere: stats.avgAttendancePct.size || null,
    fortress: stats.homeWinPct.size || null,
    historic: all.filter((v) => v.openedYear != null || stats.intlFixtureCounts.has(v.id)).length,
    iconic: editorial.filter((e) => e.category === "iconic").length || null,
    picturesque: editorial.filter((e) => e.category === "picturesque").length || null,
    remote: cohort.filter((v) => v.latitude != null && v.longitude != null).length,
    biggest: cohort.filter((v) => effectiveRugbyCapacity(v) != null).length,
    smallest: cohort.filter((v) => effectiveRugbyCapacity(v) != null).length,
    club_ground: cohort.filter((v) => (homeByVenue.get(v.id) ?? []).length > 0).length,
    matchday: stats.avgAttendancePct.size || null,
    all: cohort.length,
  };

  return {
    aggregates,
    filters,
    filterOptions,
    pageTitle,
    categoryCounts,
    featuredVenue,
    rankedVenues,
    byCapacity,
    mostRemote,
    facts: buildFacts(all),
    countries,
    divisions,
    scaffolds: {
      mapView: true,
      compare: true,
      newVenues: true,
      ratings: true,
      openedYear: true,
      surface: true,
      altitude: true,
    },
  };
}

export async function getCountryVenuePage(
  countrySlug: string,
  opts?: Partial<VenueRankingFilters> & { view?: "map" },
) {
  const stats = await getCountryVenueStats(countrySlug);
  if (!stats) return null;
  const category = opts?.category ?? "best";
  const top = opts?.top ?? 10;

  let seasonId: string | null | undefined;
  if (opts?.competitionSlug && opts?.seasonSlug) {
    const divStats = await getDivisionVenueStats(opts.competitionSlug, opts.seasonSlug);
    seasonId = divStats?.seasonId;
  } else if (opts?.competitionSlug) {
    const divStats = await getDivisionVenueStats(opts.competitionSlug);
    seasonId = divStats?.seasonId;
  }

  const [venuesList, markers, aggregates, filterOptions] = await Promise.all([
    getVenueRankings({
      cohort: "country",
      countrySlug,
      competitionSlug: opts?.competitionSlug ?? undefined,
      seasonId,
      venueType: opts?.venueType,
      category,
      limit: top,
    }),
    getVenueMapMarkers({
      countrySlug,
      competitionSlug: opts?.competitionSlug ?? undefined,
      seasonId: seasonId ?? null,
    }),
    getVenueAggregates({ countrySlug }),
    getFilterOptions({ countrySlug, competitionSlug: opts?.competitionSlug }),
  ]);
  const pageTitle = buildVenueRankingTitle({
    category,
    countryName: stats.countryName,
    competitionName: opts?.competitionSlug
      ? filterOptions.competitions.find((c) => c.value === opts.competitionSlug)?.label
      : null,
    top,
  });
  return {
    stats,
    venues: venuesList,
    markers,
    aggregates,
    category,
    filters: { category, countrySlug, competitionSlug: opts?.competitionSlug, seasonSlug: opts?.seasonSlug, venueType: opts?.venueType, top } as VenueRankingFilters,
    filterOptions,
    pageTitle,
    showMap: opts?.view === "map",
  };
}

export async function getDivisionVenuePage(
  competitionSlug: string,
  opts?: Partial<VenueRankingFilters> & {
    view?: "map";
    countrySlug?: string | null;
    season?: string | null;
    competitionSlug?: string;
  },
) {
  const category = opts?.category ?? "best";
  const stats = await getDivisionVenueStats(competitionSlug, opts?.seasonSlug ?? opts?.season ?? null);
  if (!stats) return null;
  const top = opts?.top ?? 25;
  const [venuesList, markers, filterOptions] = await Promise.all([
    getVenueRankings({
      cohort: "division",
      competitionSlug,
      countrySlug: opts?.countrySlug ?? undefined,
      seasonId: stats.seasonId,
      venueType: opts?.venueType,
      category,
      limit: top,
    }),
    getVenueMapMarkers({
      competitionSlug,
      seasonId: stats.seasonId,
      countrySlug: opts?.countrySlug ?? undefined,
    }),
    getFilterOptions({ countrySlug: opts?.countrySlug, competitionSlug }),
  ]);
  const countryName = opts?.countrySlug
    ? (await getCountryVenueStats(opts.countrySlug))?.countryName
    : null;
  const pageTitle = buildVenueRankingTitle({
    category,
    countryName,
    competitionName: stats.competitionName,
    top,
  });
  return {
    stats,
    venues: venuesList,
    markers,
    category,
    filters: {
      category,
      competitionSlug,
      countrySlug: opts?.countrySlug ?? undefined,
      seasonSlug: opts?.season ?? opts?.seasonSlug,
      venueType: opts?.venueType,
      top,
    } as VenueRankingFilters,
    filterOptions,
    pageTitle,
    showMap: opts?.view === "map",
  };
}

/** Future hook — published editorial + data ranks for a venue profile. */
export async function getVenueProfileCategoryRankings(
  venueId: string,
): Promise<VenueProfileCategoryRank[]> {
  const db = getDb();
  const editorial = await db
    .select({
      category: venueEditorialRankings.category,
      editorialRank: venueEditorialRankings.editorialRank,
      editorialReason: venueEditorialRankings.editorialReason,
      isPublished: venueEditorialRankings.isPublished,
    })
    .from(venueEditorialRankings)
    .where(
      and(eq(venueEditorialRankings.venueId, venueId), eq(venueEditorialRankings.isPublished, true)),
    );

  return editorial.map((e) => ({
    category: e.category as VenueProductCategory,
    categoryLabel: categoryLabelFromKey(e.category),
    rank: e.editorialRank,
    rankSource: "editorial" as const,
    reason: e.editorialReason,
    isPublished: e.isPublished,
  }));
}

function categoryLabelFromKey(key: string): string {
  const map: Record<string, string> = {
    best: "Best Overall",
    atmosphere: "Best Atmosphere",
    fortress: "Biggest Fortress",
    historic: "Most Historic",
    iconic: "Most Iconic",
    picturesque: "Most Picturesque",
    remote: "Most Remote",
    biggest: "Biggest",
    smallest: "Smallest",
    club_ground: "Best Club Ground",
    matchday: "Best Matchday Experience",
  };
  return map[key] ?? key;
}
