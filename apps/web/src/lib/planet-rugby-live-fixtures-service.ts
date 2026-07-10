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
import { and, gte, lt } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import {
  addDaysToDateKey,
  monthBoundsFromDateKey,
  fixtureCalendarDate,
  kickoffDateKey,
  seasonFromDateKey,
  type ScheduleCompetition,
  type ScheduleFixture,
} from "@/lib/match-schedule-utils";
import { listCompetitions } from "./competition-admin-service";
import { getDb } from "./db";
import { listTeams, buildFixtureSlug } from "./fixture-admin-service";
import { autoImportSdmsFixtureRows } from "./sdms-auto-import-service";

function sdmsStatusToFixtureStatus(status: string): string {
  if (status === "Result") return "full_time";
  if (status === "Fixture") return "scheduled";
  if (/half|live|first|second/i.test(status)) return "live";
  return "scheduled";
}

function dayBoundsInTimezone(dateKey: string, timeZone: string): { start: Date; end: Date } {
  const start = utcInstantFromZonedWallClock(dateKey, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(addDaysToDateKey(dateKey, 1), "00:00:00", timeZone);
  return { start, end };
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
    homeScore: number;
    awayScore: number;
    externalMatchId: string | null;
    planetRugbyUrl: string | null;
    homeTeam: { name: string } | null;
    awayTeam: { name: string } | null;
  },
  timeZone: string,
): ScheduleFixture {
  const kickoffIso = row.kickoffAt?.toISOString() ?? null;
  const matchDate = kickoffDateKey(kickoffIso, timeZone);
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
    round: row.round,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
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
    round: row.round ?? null,
    homeScore: row.home_team_score ?? 0,
    awayScore: row.away_team_score ?? 0,
    homeTeam: row.home_team_name ? { name: row.home_team_name, slug: row.home_team_slug } : null,
    awayTeam: row.away_team_name ? { name: row.away_team_name, slug: row.away_team_slug } : null,
    externalMatchId: row.match_id,
    planetRugbyUrl: null,
    source: "sdms",
  };
}

function fixtureOnCalendarDate(f: ScheduleFixture, dateKey: string): boolean {
  return fixtureCalendarDate(f) === dateKey;
}

async function listDbFixturesForDate(dateKey: string, timeZone: string) {
  const db = getDb();
  const { start, end } = dayBoundsInTimezone(dateKey, timeZone);

  const rows = await db
    .select()
    .from(fixtures)
    .where(and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)))
    .orderBy(fixtures.kickoffAt);

  const teamRows = await listTeams();
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  return rows
    .map((f) => ({
      ...f,
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
): Promise<{
  fixtures: ScheduleFixture[];
  competitions: ScheduleCompetition[];
  liveCount: number;
  dbCount: number;
  datesWithMatches: string[];
  timeZone: string;
}> {
  const season = dateKey.slice(0, 4);
  const { start, end } = sdmsDatetimeRangeForDate(dateKey, timeZone);

  const month = monthBoundsFromDateKey(dateKey);
  const stripStart = addDaysToDateKey(dateKey, -14);
  const stripEnd = addDaysToDateKey(dateKey, 14);
  const datesRangeStart = month.start < stripStart ? month.start : stripStart;
  const datesRangeEnd = month.end > stripEnd ? month.end : stripEnd;

  const [sdmsRaw, competitions, datesWithMatches] = await Promise.all([
    fetchSdmsGlobalFixtures(season, start, end),
    listCompetitions(),
    getFixtureDatesInRange(season, datesRangeStart, datesRangeEnd, timeZone),
  ]);

  const sdmsRows = filterSdmsRowsByCalendarDate(sdmsRaw ?? [], dateKey, timeZone);

  if (sdmsRows.length > 0) {
    await autoImportSdmsFixtureRows(sdmsRows);
  }

  const dbRowsAfterImport = await listDbFixturesForDate(dateKey, timeZone);

  const competitionList: ScheduleCompetition[] = competitions.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const competitionBySdms = new Map<string, ScheduleCompetition>();
  for (const c of competitions) {
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
    if (identity && seen.has(identity)) return;
    if (identity) seen.add(identity);
    if (fixture.source === "db") seen.add(fixture.id);
    if (fixture.externalMatchId) seen.add(`ext:${fixture.externalMatchId}`);
    merged.push(fixture);
  }

  for (const row of sdmsRows) {
    const dbMatch = dbByExternal.get(row.match_id);
    if (dbMatch) {
      const mapped = mapDbFixture(dbMatch, timeZone);
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

  return {
    fixtures: merged,
    competitions: competitionList,
    liveCount: sdmsRows.length,
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
): Promise<string[]> {
  const sdmsDates = await getSdmsDatesWithFixtures(season, startDateKey, endDateKey, timeZone);
  return sdmsDates;
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
