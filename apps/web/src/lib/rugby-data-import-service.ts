import { and, eq } from "drizzle-orm";
import { fixtures, standingRows, teams } from "@rugby365/db";
import { upsertSeason } from "./competition-admin-service";
import {
  allocateUniqueFixtureSlug,
  buildFixtureSlug,
  createFixture,
  findFixtureByExternalMatchId,
  updateFixture,
} from "./fixture-admin-service";
import { getDb } from "./db";
import { mergeProviderSnapshot } from "./head-to-head-shared";
import {
  bumpIntegrationJobCounters,
  completeIntegrationJob,
  createIntegrationJob,
  failIntegrationJob,
  startIntegrationJob,
  updateIntegrationJobProgress,
} from "./data-integration-job-service";
import {
  discoverRugbyDataLeagues,
  getLatestLeagueCatalog,
  type RugbyDataLeagueCatalogEntry,
} from "./rugby-data-discovery-service";
import {
  findCompetitionForLeague,
  findTeamForRugbyDataId,
  linkRugbyDataMatchMapping,
  mapRugbyDataCompetition,
  mapRugbyDataTeam,
} from "./rugby-data-mapping-service";
import { resolveSeasonLabelFromApi } from "./provider-mapping-service";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";
import {
  fetchRugbyDataLeague,
  fetchRugbyDataLeagueMatches,
  fetchRugbyDataLeagueTable,
  fetchRugbyDataLeagueTeams,
  fetchRugbyDataMatchesByDate,
} from "./rugby-data-api-client";
import {
  filterRugbyDataMatchesOnDate,
  flattenRugbyDataDayMatches,
  parseRugbyDataScore,
  rugbyDataStatusToFixtureStatus,
  type RugbyDataListedMatch,
} from "./rugby-data-day-sync";
import {
  flattenRugbyDataLeagueMatches,
  flattenRugbyDataLeagueTable,
  flattenRugbyDataLeagueTeams,
  parseRugbyDataKickoffIso,
  rugbyDataImportConcurrency,
  throttleRugbyDataImport,
} from "./rugby-data-import-utils";
import { addDaysToDateKey } from "./match-schedule-utils";
import { normalizeFormSequence } from "./standing-form";

export type RugbyDataImportResult = {
  jobId: string;
  leaguesProcessed: number;
  competitionsCreated: number;
  teamsMapped: number;
  fixturesCreated: number;
  fixturesUpdated: number;
  standingsUpserted: number;
  errors: string[];
};

export type RugbyDataLeagueImportResult = {
  leagueId: number;
  competitionId: string | null;
  seasonId: string | null;
  teams: number;
  fixturesCreated: number;
  fixturesUpdated: number;
  standings: number;
  errors: string[];
};

type LeagueContext = {
  leagueId: number;
  competitionId: string;
  seasonId: string | null;
  competitionName: string;
  seasonLabel: string | null;
};

async function ensureLeagueContext(
  leagueId: number,
  jobId?: string,
): Promise<LeagueContext | null> {
  await throttleRugbyDataImport();
  const headerRes = await fetchRugbyDataLeague(leagueId);
  if (!headerRes.ok || !headerRes.data || typeof headerRes.data !== "object") {
    return null;
  }
  const header = headerRes.data as {
    id?: number;
    nm?: string;
    sea?: string;
    sg?: string;
    rugbyCategory?: { nm?: string };
    tournament?: { sea?: string; nm?: string };
  };

  const name = header.nm ?? header.tournament?.nm ?? `League ${leagueId}`;
  const seasonRaw = header.sea ?? header.tournament?.sea ?? null;
  const seasonLabel = seasonRaw ? resolveSeasonLabelFromApi(seasonRaw) : null;

  const mapped = await mapRugbyDataCompetition({
    leagueId,
    name,
    seasonLabel,
    country: header.rugbyCategory?.nm ?? null,
    allowCreate: true,
    jobId,
  });
  if (!mapped.competitionId) return null;

  let seasonId: string | null = null;
  if (seasonLabel) {
    const season = await upsertSeason({
      competitionId: mapped.competitionId,
      label: seasonLabel,
      isActive: true,
    });
    seasonId = season.id;
  }

  return {
    leagueId,
    competitionId: mapped.competitionId,
    seasonId,
    competitionName: name,
    seasonLabel,
  };
}

async function importLeagueTeams(ctx: LeagueContext, jobId?: string): Promise<number> {
  await throttleRugbyDataImport();
  const res = await fetchRugbyDataLeagueTeams(ctx.leagueId);
  if (!res.ok) return 0;
  const teams = flattenRugbyDataLeagueTeams(res.data);
  let mapped = 0;
  for (const team of teams) {
    const result = await mapRugbyDataTeam({
      externalTeamId: team.id,
      name: team.name,
      competitionId: ctx.competitionId,
      jobId,
    });
    if (result.teamId) mapped += 1;
  }
  return mapped;
}

async function upsertFixtureFromListedMatch(
  match: RugbyDataListedMatch,
  ctx: LeagueContext,
): Promise<"created" | "updated" | "skipped"> {
  const externalMatchId = String(match.id);
  const homeExternalId = match.competitors?.htid;
  const awayExternalId = match.competitors?.atid;
  const homeName = match.competitors?.htn ?? "Home";
  const awayName = match.competitors?.atn ?? "Away";
  if (!homeExternalId || !awayExternalId) return "skipped";

  const homeTeamId =
    (await findTeamForRugbyDataId(homeExternalId)) ??
    (
      await mapRugbyDataTeam({
        externalTeamId: homeExternalId,
        name: homeName,
        competitionId: ctx.competitionId,
      })
    ).teamId;
  const awayTeamId =
    (await findTeamForRugbyDataId(awayExternalId)) ??
    (
      await mapRugbyDataTeam({
        externalTeamId: awayExternalId,
        name: awayName,
        competitionId: ctx.competitionId,
      })
    ).teamId;
  if (!homeTeamId || !awayTeamId) return "skipped";

  const kickoffAt = parseRugbyDataKickoffIso(match.dt);
  const status = rugbyDataStatusToFixtureStatus(match.st ?? match.cp);
  const score = parseRugbyDataScore(match.ft) ?? parseRugbyDataScore(match.cfs);

  const db = getDb();
  const [homeRow] = await db.select().from(teams).where(eq(teams.id, homeTeamId)).limit(1);
  const [awayRow] = await db.select().from(teams).where(eq(teams.id, awayTeamId)).limit(1);
  if (!homeRow || !awayRow) return "skipped";

  const baseSlug = buildFixtureSlug({
    homeSlug: homeRow.slug,
    awaySlug: awayRow.slug,
    kickoffAt: kickoffAt ?? match.dt ?? undefined,
    competitionName: ctx.competitionName,
    format: "teams-date",
  });

  let existing = await findFixtureByExternalMatchId(externalMatchId);
  if (!existing) {
    const slug = await allocateUniqueFixtureSlug(baseSlug);
    existing = await createFixture({
      slug,
      homeTeamId,
      awayTeamId,
      competitionId: ctx.competitionId,
      seasonId: ctx.seasonId,
      competitionName: ctx.competitionName,
      kickoffAt,
      status,
      externalMatchId,
      round: (match as { ro?: string }).ro ?? null,
    });
    await linkRugbyDataMatchMapping({
      externalMatchId,
      fixtureId: existing.id,
      fixtureName: `${homeName} v ${awayName}`,
    });

    const providerSnapshot = mergeProviderSnapshot(null, {
      rugby_data: {
        matchId: externalMatchId,
        tournamentId: match.tournament_id ?? ctx.leagueId,
        league: ctx.competitionName,
        importedAt: new Date().toISOString(),
      },
    });
    await db
      .update(fixtures)
      .set({
        ...(score
          ? { homeScore: score.homeScore, awayScore: score.awayScore }
          : {}),
        providerSnapshot,
      })
      .where(eq(fixtures.id, existing.id));
    return "created";
  }

  await updateFixture(existing.id, {
    kickoffAt,
    status,
    // Rugby Data can previously mis-map competitions (e.g. Autumn Nations Cup vs Nations Cup).
    // External match IDs are unique, so it's safe to correct fixture scope when it doesn't match
    // the current import context.
    competitionId: existing.competitionId !== ctx.competitionId ? ctx.competitionId : undefined,
    seasonId: existing.seasonId !== ctx.seasonId ? ctx.seasonId ?? undefined : undefined,
    round: (match as { ro?: string }).ro ?? undefined,
  });

  const providerSnapshot = mergeProviderSnapshot(existing.providerSnapshot, {
    rugby_data: {
      matchId: externalMatchId,
      tournamentId: match.tournament_id ?? ctx.leagueId,
      league: ctx.competitionName,
      importedAt: new Date().toISOString(),
    },
  });
  await db
    .update(fixtures)
    .set({
      ...(score ? { homeScore: score.homeScore, awayScore: score.awayScore } : {}),
      providerSnapshot,
    })
    .where(eq(fixtures.id, existing.id));
  await linkRugbyDataMatchMapping({
    externalMatchId,
    fixtureId: existing.id,
    fixtureName: `${homeName} v ${awayName}`,
  });
  return "updated";
}

async function importLeagueMatches(
  ctx: LeagueContext,
  matchType: "finished" | "fixtures",
): Promise<{ created: number; updated: number }> {
  await throttleRugbyDataImport();
  const res = await fetchRugbyDataLeagueMatches(ctx.leagueId, matchType);
  if (!res.ok) return { created: 0, updated: 0 };

  const matches = flattenRugbyDataLeagueMatches(res.data, {
    id: ctx.leagueId,
    name: ctx.competitionName,
    season: ctx.seasonLabel ?? undefined,
  });

  let created = 0;
  let updated = 0;
  for (const match of matches) {
    const outcome = await upsertFixtureFromListedMatch(match, ctx);
    if (outcome === "created") created += 1;
    if (outcome === "updated") updated += 1;
  }
  return { created, updated };
}

async function importLeagueStandings(ctx: LeagueContext): Promise<number> {
  if (!ctx.seasonId) return 0;
  await throttleRugbyDataImport();
  const res = await fetchRugbyDataLeagueTable(ctx.leagueId);
  if (!res.ok) return 0;

  const rows = flattenRugbyDataLeagueTable(res.data);
  if (!rows.length) return 0;

  const db = getDb();
  await db
    .delete(standingRows)
    .where(and(eq(standingRows.seasonId, ctx.seasonId), eq(standingRows.view, "overall")));

  const syncedAt = new Date();
  let upserted = 0;
  for (const row of rows) {
    const teamId =
      (await findTeamForRugbyDataId(row.teamId)) ??
      (await mapRugbyDataTeam({ externalTeamId: row.teamId, name: row.teamName })).teamId;
    if (!teamId) continue;

    await db.insert(standingRows).values({
      seasonId: ctx.seasonId,
      teamId,
      view: "overall",
      rank: row.rank,
      played: row.played,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      points: row.points,
      form: normalizeFormSequence(row.form),
      syncedAt,
    });
    upserted += 1;
  }
  return upserted;
}

export async function importRugbyDataLeague(
  leagueId: number,
  options: { jobId?: string } = {},
): Promise<RugbyDataLeagueImportResult> {
  const result: RugbyDataLeagueImportResult = {
    leagueId,
    competitionId: null,
    seasonId: null,
    teams: 0,
    fixturesCreated: 0,
    fixturesUpdated: 0,
    standings: 0,
    errors: [],
  };

  try {
    const ctx = await ensureLeagueContext(leagueId, options.jobId);
    if (!ctx) {
      result.errors.push(`Could not resolve competition for league ${leagueId}`);
      return result;
    }
    result.competitionId = ctx.competitionId;
    result.seasonId = ctx.seasonId;

    result.teams = await importLeagueTeams(ctx, options.jobId);

    const finished = await importLeagueMatches(ctx, "finished");
    result.fixturesCreated += finished.created;
    result.fixturesUpdated += finished.updated;

    const upcoming = await importLeagueMatches(ctx, "fixtures");
    result.fixturesCreated += upcoming.created;
    result.fixturesUpdated += upcoming.updated;

    result.standings = await importLeagueStandings(ctx);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

export async function importRugbyDataDateRange(
  fromDate: string,
  toDate: string,
  options: { jobId?: string } = {},
): Promise<{ dates: number; fixturesCreated: number; fixturesUpdated: number; errors: string[] }> {
  const errors: string[] = [];
  let fixturesCreated = 0;
  let fixturesUpdated = 0;
  let dates = 0;

  let cursor = fromDate;
  while (cursor <= toDate) {
    dates += 1;
    await throttleRugbyDataImport();
    const listedRes = await fetchRugbyDataMatchesByDate(cursor, "all");
    if (!listedRes.ok) {
      errors.push(`${cursor}: ${listedRes.errorMessage ?? "list failed"}`);
      cursor = addDaysToDateKey(cursor, 1);
      continue;
    }

    const onDay = filterRugbyDataMatchesOnDate(flattenRugbyDataDayMatches(listedRes.data), cursor);
    for (const match of onDay) {
      const leagueId = Number(match.tournament_id ?? match.leagueId);
      if (!Number.isFinite(leagueId)) continue;

      let competitionId = await findCompetitionForLeague(leagueId);
      if (!competitionId) {
        const ctx = await ensureLeagueContext(leagueId, options.jobId);
        competitionId = ctx?.competitionId ?? null;
      }
      if (!competitionId) continue;

      const ctx: LeagueContext = {
        leagueId,
        competitionId,
        seasonId: null,
        competitionName: match.league ?? `League ${leagueId}`,
        seasonLabel: match.sea ?? null,
      };
      if (ctx.seasonLabel) {
        const season = await upsertSeason({
          competitionId,
          label: resolveSeasonLabelFromApi(ctx.seasonLabel) ?? ctx.seasonLabel,
        });
        ctx.seasonId = season.id;
      }

      const outcome = await upsertFixtureFromListedMatch(match, ctx);
      if (outcome === "created") fixturesCreated += 1;
      if (outcome === "updated") fixturesUpdated += 1;
    }

    cursor = addDaysToDateKey(cursor, 1);
  }

  return { dates, fixturesCreated, fixturesUpdated, errors };
}

export async function importAllRugbyDataLeagues(options: {
  jobId?: string;
  startedBy?: string;
  leagueIds?: number[];
  includeDateSweep?: boolean;
  dateSweepDays?: number;
} = {}): Promise<RugbyDataImportResult> {
  const job =
    options.jobId != null
      ? { id: options.jobId }
      : await createIntegrationJob({
          name: "Import all Rugby Data leagues",
          jobType: "rugby_data_import_all",
          startedBy: options.startedBy ?? "system",
        });

  await startIntegrationJob(job.id);

  const result: RugbyDataImportResult = {
    jobId: job.id,
    leaguesProcessed: 0,
    competitionsCreated: 0,
    teamsMapped: 0,
    fixturesCreated: 0,
    fixturesUpdated: 0,
    standingsUpserted: 0,
    errors: [],
  };

  try {
    let leagueIds = options.leagueIds;
    if (!leagueIds?.length) {
      const catalog = await getLatestLeagueCatalog();
      if (!catalog.length) {
        const discovered = await discoverRugbyDataLeagues({ startedBy: options.startedBy });
        leagueIds = discovered.leagues.map((row) => row.id);
      } else {
        leagueIds = catalog.map((row) => row.id);
      }
    }

    await updateIntegrationJobProgress(job.id, {
      recordsFound: leagueIds.length,
      report: { lastLeagueId: null, leagueIds },
    });

    for (const leagueId of leagueIds) {
      const leagueResult = await importRugbyDataLeague(leagueId, { jobId: job.id });
      result.leaguesProcessed += 1;
      result.teamsMapped += leagueResult.teams;
      result.fixturesCreated += leagueResult.fixturesCreated;
      result.fixturesUpdated += leagueResult.fixturesUpdated;
      result.standingsUpserted += leagueResult.standings;
      result.errors.push(...leagueResult.errors);

      await updateIntegrationJobProgress(job.id, {
        report: { lastLeagueId: leagueId },
      });
      await bumpIntegrationJobCounters(job.id, {
        recordsUpdated: leagueResult.fixturesUpdated,
        recordsCreated: leagueResult.fixturesCreated,
        errors: leagueResult.errors.length,
      });
    }

    if (options.includeDateSweep !== false) {
      const days = options.dateSweepDays ?? 365;
      const today = new Date().toISOString().slice(0, 10);
      const from = addDaysToDateKey(today, -days);
      const to = addDaysToDateKey(today, days);
      const sweep = await importRugbyDataDateRange(from, to, { jobId: job.id });
      result.fixturesCreated += sweep.fixturesCreated;
      result.fixturesUpdated += sweep.fixturesUpdated;
      result.errors.push(...sweep.errors);
    }

    await completeIntegrationJob(job.id, result as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    await failIntegrationJob(job.id, message, result as unknown as Record<string, unknown>);
    throw error;
  }

  return result;
}

export function filterLeagueCatalog(
  catalog: RugbyDataLeagueCatalogEntry[],
  leagueId?: number,
): RugbyDataLeagueCatalogEntry[] {
  if (!leagueId) return catalog;
  return catalog.filter((row) => row.id === leagueId);
}

export { rugbyDataImportConcurrency };
