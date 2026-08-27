import {
  DEFAULT_FIXTURES_TIMEZONE,
  fetchSdmsGlobalFixtures,
  filterSdmsRowsByCalendarDate,
  sdmsDatetimeRangeForDate,
  sdmsRowDisplayDate,
  sdmsScheduleKickoffIso,
  utcInstantFromZonedWallClock,
  type SdmsFixtureRow,
} from "@rugby365/import-sdk";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { competitions, fixtures, referees, teams } from "@rugby365/db";
import { extractYoutubeVideoId } from "./youtube-embed";
import {
  addDaysToDateKey,
  monthBoundsFromDateKey,
  fixtureCalendarDate,
  kickoffDateKey,
  dateKeyLocal,
  seasonFromDateKey,
  type ScheduleCompetition,
  type ScheduleFixture,
  type ScheduleTeam,
  formatRoundLabel,
} from "@/lib/match-schedule-utils";
import { listCompetitions } from "./competition-admin-service";
import { getDb } from "./db";
import { buildFixtureSlug } from "./fixture-admin-service";
import { autoImportSdmsFixtureRows } from "./sdms-auto-import-service";
import { syncRugbyDataFixturesForDate, scheduleLiteRugbyDataSync } from "./rugby-data-day-sync-service";
import { enrichScheduleFixturesForPublic } from "./schedule-fixture-enrichment";
import { weatherConditionFromText } from "./weather-condition";
import { sanitizePublicScheduleFixtures } from "./public-schedule-sanitize";
import { resolvePublicClubNamesFromFixtureSlug, stripImportedDateSuffix, isUnknownStandingsTeamName } from "./table-lab/standings-fixture-dedupe";

function sdmsStatusToFixtureStatus(status: string): string {
  if (status === "Result") return "full_time";
  if (status === "Fixture") return "scheduled";
  if (/half\s*time|halftime|^ht\b/i.test(status)) return "half_time";
  if (/live|first|second|in\s*play/i.test(status)) return "live";
  return "scheduled";
}

function dayBoundsInTimezone(dateKey: string, timeZone: string): { start: Date; end: Date } {
  const start = utcInstantFromZonedWallClock(dateKey, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(addDaysToDateKey(dateKey, 1), "00:00:00", timeZone);
  return { start, end };
}

function toScheduleTeam(
  team:
    | { id?: string | null; name: string; slug?: string | null; imageUrl?: string | null }
    | null
    | undefined,
  fallbackIcon?: string | null,
): ScheduleTeam | null {
  if (!team?.name) return null;
  return {
    id: team.id ?? null,
    name: stripImportedDateSuffix(team.name) || team.name,
    slug: team.slug ?? null,
    imageUrl: team.imageUrl ?? fallbackIcon ?? null,
  };
}

function mapDbFixture(
  row: {
    id: string;
    slug: string;
    competitionId: string | null;
    competitionName: string | null;
    kickoffAt: Date | null;
    status: string;
    round: string | null;
    venueName?: string | null;
    venueId?: string | null;
    homeScore: number;
    awayScore: number;
    attendance?: number | null;
    halfTimeHome?: number | null;
    halfTimeAway?: number | null;
    additionalInfo?: string | null;
    weatherNote?: string | null;
    refereeName?: string | null;
    isNeutralVenue?: boolean | null;
    watchalongYoutubeUrl?: string | null;
    highlightsYoutubeUrl?: string | null;
    externalMatchId: string | null;
    planetRugbyUrl: string | null;
    providerSnapshot?: unknown;
    homeTeam: {
      id?: string | null;
      name: string;
      slug?: string | null;
      imageUrl?: string | null;
    } | null;
    awayTeam: {
      id?: string | null;
      name: string;
      slug?: string | null;
      imageUrl?: string | null;
    } | null;
  },
  timeZone: string,
  icons?: { home?: string | null; away?: string | null },
): ScheduleFixture {
  const kickoffIso = row.kickoffAt?.toISOString() ?? null;
  const matchDate = kickoffDateKey(kickoffIso, timeZone);
  const resolved = resolvePublicClubNamesFromFixtureSlug(
    row.slug,
    row.homeTeam?.name ?? "",
    row.awayTeam?.name ?? "",
  );
  const snapNames = rugbyDataSnapshotSideNames(row.providerSnapshot);
  const homeName =
    isUnknownStandingsTeamName(resolved.homeName) && snapNames.home
      ? snapNames.home
      : resolved.homeName;
  const awayName =
    isUnknownStandingsTeamName(resolved.awayName) && snapNames.away
      ? snapNames.away
      : resolved.awayName;
  const homeTeam = toScheduleTeam(
    row.homeTeam
      ? { ...row.homeTeam, name: homeName || row.homeTeam.name }
      : homeName
        ? { name: homeName }
        : null,
    icons?.home,
  );
  const awayTeam = toScheduleTeam(
    row.awayTeam
      ? { ...row.awayTeam, name: awayName || row.awayTeam.name }
      : awayName
        ? { name: awayName }
        : null,
    icons?.away,
  );
  return {
    id: row.id,
    slug: row.slug,
    competitionId: row.competitionId,
    sdmsCompetitionId: null,
    competitionName: row.competitionName,
    matchDate,
    seasonLabel: seasonFromDateKey(matchDate),
    kickoffAt: kickoffIso,
    status: row.status,
    round: formatRoundLabel(row.round),
    venue: row.venueName?.trim() || null,
    venueId: row.venueId ?? null,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    halfTimeHome: row.halfTimeHome ?? null,
    halfTimeAway: row.halfTimeAway ?? null,
    attendance: row.attendance ?? null,
    additionalInfo: row.additionalInfo?.trim() || null,
    weather: row.weatherNote?.trim()
      ? (() => {
          const summary = row.weatherNote.trim();
          const condition = weatherConditionFromText(summary);
          return {
            temperatureC: null,
            windSpeedKmh: null,
            windCompass: null,
            summary,
            icon: condition.kind,
            conditionLabel: condition.label,
          };
        })()
      : null,
    refereeName: row.refereeName?.trim() || null,
    isNeutralVenue: Boolean(row.isNeutralVenue),
    hasWatchalong: Boolean(extractYoutubeVideoId(row.watchalongYoutubeUrl)),
    hasHighlights: Boolean(extractYoutubeVideoId(row.highlightsYoutubeUrl)),
    homeTeam,
    awayTeam,
    externalMatchId: row.externalMatchId,
    planetRugbyUrl: row.planetRugbyUrl,
    source: "db",
  };
}

function mapSdmsRow(
  row: SdmsFixtureRow,
  competitionBySdms: Map<string, ScheduleCompetition>,
  timeZone: string,
): ScheduleFixture {
  const comp = row.competition_id ? competitionBySdms.get(String(row.competition_id)) : undefined;
  const slug = buildFixtureSlug({
    homeSlug: row.home_team_slug,
    awaySlug: row.away_team_slug,
    kickoffAt: row.date,
    competitionName: row.competition_name,
    format: "teams-date",
  });
  const kickoffAt = sdmsScheduleKickoffIso(row.date, row.time);
  const matchDate = sdmsRowDisplayDate(row, timeZone);

  return {
    id: `sdms:${row.match_id}`,
    slug,
    competitionId: comp?.id ?? null,
    sdmsCompetitionId: row.competition_id ?? null,
    competitionName: row.competition_name ?? null,
    matchDate,
    seasonLabel: seasonFromDateKey(matchDate),
    kickoffAt,
    status: sdmsStatusToFixtureStatus(row.status),
    round: formatRoundLabel(row.round),
    venue: row.venue?.trim() || null,
    homeScore: row.home_team_score ?? 0,
    awayScore: row.away_team_score ?? 0,
    homeTeam: row.home_team_name
      ? {
          name: stripImportedDateSuffix(row.home_team_name) || row.home_team_name,
          slug: row.home_team_slug,
          imageUrl: row.home_team_icon ?? null,
        }
      : null,
    awayTeam: row.away_team_name
      ? {
          name: stripImportedDateSuffix(row.away_team_name) || row.away_team_name,
          slug: row.away_team_slug,
          imageUrl: row.away_team_icon ?? null,
        }
      : null,
    externalMatchId: row.match_id,
    planetRugbyUrl: null,
    source: "sdms",
  };
}

function fixtureOnCalendarDate(f: ScheduleFixture, dateKey: string): boolean {
  return fixtureCalendarDate(f) === dateKey;
}

function rugbyDataSnapshotSideNames(snapshot: unknown): { home: string | null; away: string | null } {
  if (!snapshot || typeof snapshot !== "object") return { home: null, away: null };
  const rd = (snapshot as Record<string, unknown>).rugby_data;
  if (!rd || typeof rd !== "object") return { home: null, away: null };
  const rec = rd as Record<string, unknown>;
  const home = typeof rec.homeName === "string" ? rec.homeName.trim() : "";
  const away = typeof rec.awayName === "string" ? rec.awayName.trim() : "";
  return { home: home || null, away: away || null };
}

function shouldKickLiteRugbyDataSync(dateKey: string, rows: ScheduleFixture[]): boolean {
  const today = dateKeyLocal(new Date());
  const yesterday = addDaysToDateKey(today, -1);
  if (dateKey !== today && dateKey !== yesterday) return false;
  return rows.some((f) => {
    const status = (f.status ?? "").toLowerCase();
    if (status === "live" || status === "half_time") return true;
    if (status !== "scheduled" || !f.kickoffAt) return false;
    const elapsed = Date.now() - new Date(f.kickoffAt).getTime();
    return elapsed > -15 * 60 * 1000 && elapsed < 5 * 60 * 60 * 1000;
  });
}

async function listDbFixturesForDate(dateKey: string, timeZone: string) {
  const db = getDb();
  const { start, end } = dayBoundsInTimezone(dateKey, timeZone);

  const rows = await db
    .select({
      fixture: fixtures,
      linkedRefereeName: referees.name,
    })
    .from(fixtures)
    .leftJoin(referees, eq(fixtures.refereeId, referees.id))
    .where(and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)))
    .orderBy(fixtures.kickoffAt);

  const teamIds = [
    ...new Set(
      rows.flatMap(({ fixture: f }) => [f.homeTeamId, f.awayTeamId]).filter((id): id is string => Boolean(id)),
    ),
  ];
  const teamRows = teamIds.length
    ? await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          imageUrl: teams.imageUrl,
        })
        .from(teams)
        .where(inArray(teams.id, teamIds))
    : [];
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  return rows
    .map(({ fixture: f, linkedRefereeName }) => ({
      ...f,
      // Prefer linked referee entity name when text column is empty/stale.
      refereeName: linkedRefereeName?.trim() || f.refereeName?.trim() || null,
      homeTeam: f.homeTeamId ? teamById[f.homeTeamId] : null,
      awayTeam: f.awayTeamId ? teamById[f.awayTeamId] : null,
    }))
    .filter((f) => {
      const mapped = mapDbFixture(f, timeZone);
      return fixtureOnCalendarDate(mapped, dateKey);
    });
}

export async function getScheduleForDate(
  dateKey: string,
  timeZone: string = DEFAULT_FIXTURES_TIMEZONE,
  options?: {
    competitionId?: string | null;
    /**
     * Fast DB-only path for Match Centre sidebar rails.
     * Skips SDMS/Rugby Data sync and public weather/win-prob enrichment.
     */
    lite?: boolean;
  },
): Promise<{
  fixtures: ScheduleFixture[];
  competitions: ScheduleCompetition[];
  liveCount: number;
  dbCount: number;
  datesWithMatches: string[];
  timeZone: string;
}> {
  const competitionIdFilter = options?.competitionId?.trim() || null;
  const lite = Boolean(options?.lite);
  const season = dateKey.slice(0, 4);
  const { start, end } = sdmsDatetimeRangeForDate(dateKey, timeZone);

  const month = monthBoundsFromDateKey(dateKey);
  const stripStart = addDaysToDateKey(dateKey, -14);
  const stripEnd = addDaysToDateKey(dateKey, 14);
  const datesRangeStart = month.start < stripStart ? month.start : stripStart;
  const datesRangeEnd = month.end > stripEnd ? month.end : stripEnd;

  if (lite) {
    const dbRows = await listDbFixturesForDate(dateKey, timeZone);
    const competitionIds = [
      ...new Set(dbRows.map((row) => row.competitionId).filter((id): id is string => Boolean(id))),
    ];
    const competitionList: ScheduleCompetition[] = competitionIds.length
      ? (
          await getDb()
            .select({
              id: competitions.id,
              name: competitions.name,
              slug: competitions.slug,
            })
            .from(competitions)
            .where(inArray(competitions.id, competitionIds))
        ).map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
      : [];
    let mappedFixtures = sanitizePublicScheduleFixtures(
      dbRows
        .map((row) => mapDbFixture(row, timeZone))
        .filter((f) => fixtureOnCalendarDate(f, dateKey)),
    );
    if (competitionIdFilter) {
      mappedFixtures = mappedFixtures.filter((f) => f.competitionId === competitionIdFilter);
    }
    mappedFixtures.sort((a, b) => {
      const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
      const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
      return ta - tb;
    });
    if (shouldKickLiteRugbyDataSync(dateKey, mappedFixtures)) {
      scheduleLiteRugbyDataSync(dateKey, timeZone);
    }
    return {
      fixtures: mappedFixtures,
      competitions: competitionList,
      liveCount: mappedFixtures.filter((f) => /live|half_time|half time/i.test(f.status)).length,
      dbCount: dbRows.length,
      datesWithMatches: [],
      timeZone,
    };
  }

  const [sdmsRaw, competitionsRows, datesWithMatches] = await Promise.all([
    fetchSdmsGlobalFixtures(season, start, end),
    listCompetitions(),
    getFixtureDatesInRange(season, datesRangeStart, datesRangeEnd, timeZone, {
      competitionId: competitionIdFilter,
    }),
  ]);

  const sdmsRows = filterSdmsRowsByCalendarDate(sdmsRaw ?? [], dateKey, timeZone);

  if (sdmsRows.length > 0) {
    await autoImportSdmsFixtureRows(sdmsRows);
  }

  // P1 (Rugby Data) owns scores/status when present; also fills events if no SDMS timeline.
  try {
    await syncRugbyDataFixturesForDate(dateKey, { timeZone, syncEvents: true });
  } catch (error) {
    console.warn(
      `[schedule] rugby_data day sync failed for ${dateKey}:`,
      error instanceof Error ? error.message : error,
    );
  }

  const dbRowsAfterImport = await listDbFixturesForDate(dateKey, timeZone);

  const competitionList: ScheduleCompetition[] = competitionsRows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const competitionBySdms = new Map<string, ScheduleCompetition>();
  for (const c of competitionsRows) {
    if (c.sdmsCompCode) competitionBySdms.set(c.sdmsCompCode, { id: c.id, name: c.name, slug: c.slug });
  }

  const dbByExternal = new Map<string, (typeof dbRowsAfterImport)[number]>();
  for (const row of dbRowsAfterImport) {
    if (row.externalMatchId) dbByExternal.set(row.externalMatchId, row);
  }

  const merged: ScheduleFixture[] = [];
  const seen = new Set<string>();

  function fixtureScheduleKey(fixture: ScheduleFixture): string | null {
    const home = fixture.homeTeam?.name?.trim().toLowerCase();
    const away = fixture.awayTeam?.name?.trim().toLowerCase();
    const date = fixture.matchDate ?? kickoffDateKey(fixture.kickoffAt, timeZone);
    if (!home || !away || !date) return null;
    return `${home}:${away}:${date}`;
  }

  function pushUnique(fixture: ScheduleFixture) {
    const identity = fixtureScheduleKey(fixture);
    if (identity && seen.has(identity)) {
      // Prefer richer CMS rows over sparse SDMS placeholders (e.g. missing referee).
      const idx = merged.findIndex((row) => fixtureScheduleKey(row) === identity);
      if (idx >= 0) {
        const existing = merged[idx]!;
        const preferIncoming =
          (fixture.source === "db" && existing.source !== "db") ||
          (Boolean(fixture.refereeName?.trim()) && !existing.refereeName?.trim()) ||
          (Boolean(fixture.venue?.trim()) && !existing.venue?.trim());
        if (preferIncoming) {
          merged[idx] = {
            ...existing,
            ...fixture,
            venue: fixture.venue?.trim() || existing.venue,
            refereeName: fixture.refereeName?.trim() || existing.refereeName,
            competitionName: fixture.competitionName ?? existing.competitionName,
            sdmsCompetitionId: fixture.sdmsCompetitionId ?? existing.sdmsCompetitionId,
            homeTeam: fixture.homeTeam ?? existing.homeTeam,
            awayTeam: fixture.awayTeam ?? existing.awayTeam,
          };
          if (fixture.source === "db") seen.add(fixture.id);
          if (fixture.externalMatchId) seen.add(`ext:${fixture.externalMatchId}`);
        }
      }
      return;
    }
    if (identity) seen.add(identity);
    if (fixture.source === "db") seen.add(fixture.id);
    if (fixture.externalMatchId) seen.add(`ext:${fixture.externalMatchId}`);
    merged.push(fixture);
  }

  for (const row of sdmsRows) {
    const dbMatch = dbByExternal.get(row.match_id);
    if (dbMatch) {
      const mapped = mapDbFixture(dbMatch, timeZone, {
        home: row.home_team_icon,
        away: row.away_team_icon,
      });
      mapped.sdmsCompetitionId = row.competition_id ?? mapped.sdmsCompetitionId;
      if (!mapped.competitionName && row.competition_name) {
        mapped.competitionName = row.competition_name;
      }
      if (!mapped.venue && row.venue?.trim()) {
        mapped.venue = row.venue.trim();
      }
      if (mapped.homeTeam && !mapped.homeTeam.slug && row.home_team_slug) {
        mapped.homeTeam = { ...mapped.homeTeam, slug: row.home_team_slug };
      }
      if (mapped.awayTeam && !mapped.awayTeam.slug && row.away_team_slug) {
        mapped.awayTeam = { ...mapped.awayTeam, slug: row.away_team_slug };
      }
      if (!mapped.externalMatchId) mapped.externalMatchId = row.match_id;
      // Prefer fresh SDMS scoreline/status for live matches (CMS can lag entity sync).
      const sdmsStatus = sdmsStatusToFixtureStatus(row.status);
      if (/live|half_time/i.test(sdmsStatus) || /live|half_time/i.test(mapped.status)) {
        mapped.status = sdmsStatus;
        if (typeof row.home_team_score === "number") mapped.homeScore = row.home_team_score;
        if (typeof row.away_team_score === "number") mapped.awayScore = row.away_team_score;
      }
      if (fixtureOnCalendarDate(mapped, dateKey)) {
        pushUnique(mapped);
      }
    } else {
      const mapped = mapSdmsRow(row, competitionBySdms, timeZone);
      const identity = fixtureScheduleKey(mapped);
      const alreadyListed =
        identity != null &&
        merged.some((fixture) => fixtureScheduleKey(fixture) === identity);
      if (!alreadyListed) {
        pushUnique(mapped);
      }
    }
  }

  for (const row of dbRowsAfterImport) {
    if (seen.has(row.id)) continue;
    const mapped = mapDbFixture(row, timeZone);
    if (!fixtureOnCalendarDate(mapped, dateKey)) continue;
    const identity = fixtureScheduleKey(mapped);
    if (identity && seen.has(identity)) continue;
    if (row.externalMatchId && seen.has(`ext:${row.externalMatchId}`)) continue;
    pushUnique(mapped);
  }

  merged.sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    return ta - tb;
  });

  const filtered = competitionIdFilter
    ? merged.filter((f) => f.competitionId === competitionIdFilter)
    : merged;

  let enriched = filtered;
  try {
    enriched = await enrichScheduleFixturesForPublic(filtered);
  } catch (error) {
    console.warn(
      `[schedule] public enrichment failed for ${dateKey}:`,
      error instanceof Error ? error.message : error,
    );
  }

  const publicFixtures = sanitizePublicScheduleFixtures(enriched);
  return {
    fixtures: publicFixtures,
    competitions: competitionList,
    // Count truly in-play fixtures only (not "all SDMS rows for the day").
    liveCount: publicFixtures.filter((f) => /live|half_time|half time/i.test(f.status)).length,
    dbCount: dbRowsAfterImport.length,
    datesWithMatches,
    timeZone,
  };
}

/** Dates (YYYY-MM-DD) that have at least one fixture in a range (display timezone). */
export async function getFixtureDatesInRange(
  season: string,
  startDateKey: string,
  endDateKey: string,
  timeZone: string = DEFAULT_FIXTURES_TIMEZONE,
  options?: { competitionId?: string | null },
): Promise<string[]> {
  const competitionId = options?.competitionId?.trim() || null;
  // Competition-scoped calendars are CMS/DB truth — skip expensive global SDMS fan-out.
  if (competitionId) {
    return (await getDbFixtureDatesInRange(startDateKey, endDateKey, timeZone, competitionId)).sort();
  }
  const [sdmsDates, dbDates] = await Promise.all([
    getSdmsDatesWithFixtures(season, startDateKey, endDateKey, timeZone),
    getDbFixtureDatesInRange(startDateKey, endDateKey, timeZone),
  ]);
  return [...new Set([...sdmsDates, ...dbDates])].sort();
}

async function getDbFixtureDatesInRange(
  startDateKey: string,
  endDateKey: string,
  timeZone: string,
  competitionId?: string | null,
): Promise<string[]> {
  const db = getDb();
  const start = utcInstantFromZonedWallClock(startDateKey, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(addDaysToDateKey(endDateKey, 1), "00:00:00", timeZone);
  const conditions = [gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)];
  if (competitionId) {
    conditions.push(eq(fixtures.competitionId, competitionId));
  }
  const rows = await db
    .select({ kickoffAt: fixtures.kickoffAt })
    .from(fixtures)
    .where(and(...conditions));

  const dates = new Set<string>();
  for (const row of rows) {
    if (!row.kickoffAt) continue;
    const dateKey = kickoffDateKey(row.kickoffAt.toISOString(), timeZone);
    if (dateKey && dateKey >= startDateKey && dateKey <= endDateKey) {
      dates.add(dateKey);
    }
  }
  return [...dates];
}

/**
 * Calendar years that have at least one kickoff in CMS.
 * Drives the Live Centre year picker (full history, not ±1).
 */
export async function listFixtureCalendarYears(): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({
      year: sql<number>`extract(year from ${fixtures.kickoffAt})::int`.mapWith(Number),
    })
    .from(fixtures)
    .where(isNotNull(fixtures.kickoffAt))
    .groupBy(sql`extract(year from ${fixtures.kickoffAt})`)
    .orderBy(desc(sql`extract(year from ${fixtures.kickoffAt})`));

  return rows.map((r) => r.year).filter((y) => Number.isFinite(y) && y >= 1860 && y <= 2100);
}

/**
 * Competitions that have at least one CMS fixture whose kickoff falls in `year`
 * (interpreted in the given display timezone).
 */
export async function listCompetitionsWithFixturesInYear(
  year: number,
  timeZone: string = DEFAULT_FIXTURES_TIMEZONE,
): Promise<ScheduleCompetition[]> {
  if (!Number.isFinite(year) || year < 1860 || year > 2100) return [];
  const db = getDb();
  const start = utcInstantFromZonedWallClock(`${year}-01-01`, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(`${year + 1}-01-01`, "00:00:00", timeZone);

  const rows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
    })
    .from(fixtures)
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)))
    .groupBy(competitions.id, competitions.name, competitions.slug)
    .orderBy(asc(competitions.name));

  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
}

/** Dates (YYYY-MM-DD) that have at least one SDMS fixture in a range (display timezone). */
export async function getSdmsDatesWithFixtures(
  season: string,
  startDateKey: string,
  endDateKey: string,
  timeZone: string = DEFAULT_FIXTURES_TIMEZONE,
): Promise<string[]> {
  const { start } = sdmsDatetimeRangeForDate(startDateKey, timeZone);
  const { end } = sdmsDatetimeRangeForDate(endDateKey, timeZone);
  const rows = await fetchSdmsGlobalFixtures(season, start, end);
  if (!rows?.length) return [];
  const dates = new Set<string>();
  for (const row of rows) {
    const displayDate = sdmsRowDisplayDate(row, timeZone);
    if (displayDate >= startDateKey && displayDate <= endDateKey) dates.add(displayDate);
  }
  return [...dates].sort();
}
