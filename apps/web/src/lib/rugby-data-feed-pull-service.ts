import {
  fetchRugbyDataCountries,
  fetchRugbyDataCountryLeagues,
  fetchRugbyDataLeague,
  fetchRugbyDataLeagueMatches,
  fetchRugbyDataLeagueNews,
  fetchRugbyDataLeagueTable,
  fetchRugbyDataLeagueTeams,
  fetchRugbyDataMatchDetail,
  fetchRugbyDataMatchInfo,
  fetchRugbyDataMatchLineup,
  fetchRugbyDataMatchPlayerStats,
  fetchRugbyDataMatchTable,
  fetchRugbyDataMatchTeamStats,
  fetchRugbyDataMatchesByDate,
  fetchRugbyDataMatchesCount,
  fetchRugbyDataNewsLeagues,
  fetchRugbyDataSearch,
  fetchRugbyDataTeamHeader,
  fetchRugbyDataTeamMatches,
  fetchRugbyDataTeamNews,
  fetchRugbyDataTeams,
} from "./rugby-data-api-client";
import {
  bumpIntegrationJobCounters,
  completeIntegrationJob,
  createIntegrationJob,
  failIntegrationJob,
  startIntegrationJob,
  updateIntegrationJobProgress,
} from "./data-integration-job-service";
import { discoverRugbyDataLeagues, getLatestLeagueCatalog } from "./rugby-data-discovery-service";
import { flattenRugbyDataLeagueMatches, flattenRugbyDataLeagueTeams, throttleRugbyDataImport } from "./rugby-data-import-utils";
import { addDaysToDateKey } from "./match-schedule-utils";

export type RugbyDataFeedPullOptions = {
  jobId?: string;
  startedBy?: string;
  /** Limit leagues for testing; default all discovered */
  leagueLimit?: number;
  /** Pull match detail feeds for finished matches per league */
  includeMatchFeeds?: boolean;
  matchLimitPerLeague?: number;
  /** Pull team header/matches/news for teams seen in league lists */
  includeTeamFeeds?: boolean;
  teamLimit?: number;
  /** Days before/after today for /matches and /matches/count */
  dateSweepDays?: number;
  /** Also run baseline capture endpoints (search, global teams) */
  includeGlobalFeeds?: boolean;
};

export type RugbyDataFeedPullResult = {
  jobId: string;
  requestsOk: number;
  requestsFailed: number;
  leaguesPulled: number;
  teamsPulled: number;
  matchesPulled: number;
  datesPulled: number;
  errors: string[];
  pulledAt: string;
};

type PullCounter = {
  ok: number;
  failed: number;
};

async function pullCall(
  counters: PullCounter,
  errors: string[],
  label: string,
  run: () => Promise<{ ok: boolean; errorMessage?: string }>,
): Promise<boolean> {
  await throttleRugbyDataImport();
  try {
    const result = await run();
    if (result.ok) {
      counters.ok += 1;
      return true;
    }
    counters.failed += 1;
    errors.push(`${label}: ${result.errorMessage ?? "failed"}`);
    return false;
  } catch (error) {
    counters.failed += 1;
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function collectMatchIdsFromLeague(data: unknown, limit: number): number[] {
  const matches = flattenRugbyDataLeagueMatches(data);
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const match of matches) {
    const id = Number(match.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    if (match.st !== "Finished" && match.cp !== "Finished") continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }
  return ids;
}

export async function pullAllRugbyDataFeeds(
  options: RugbyDataFeedPullOptions = {},
): Promise<RugbyDataFeedPullResult> {
  const job =
    options.jobId != null
      ? { id: options.jobId }
      : await createIntegrationJob({
          name: "Pull all Rugby Data feeds",
          jobType: "rugby_data_feed_pull",
          startedBy: options.startedBy ?? "system",
        });

  await startIntegrationJob(job.id);

  const counters: PullCounter = { ok: 0, failed: 0 };
  const errors: string[] = [];
  const result: RugbyDataFeedPullResult = {
    jobId: job.id,
    requestsOk: 0,
    requestsFailed: 0,
    leaguesPulled: 0,
    teamsPulled: 0,
    matchesPulled: 0,
    datesPulled: 0,
    errors: [],
    pulledAt: new Date().toISOString(),
  };

  const includeMatchFeeds = options.includeMatchFeeds !== false;
  const includeTeamFeeds = options.includeTeamFeeds !== false;
  const includeGlobalFeeds = options.includeGlobalFeeds !== false;
  const matchLimitPerLeague = options.matchLimitPerLeague ?? 200;
  const teamLimit = options.teamLimit ?? 500;
  const dateSweepDays = options.dateSweepDays ?? 365;

  try {
    // Discovery feeds
    await pullCall(counters, errors, "countries/list", () => fetchRugbyDataCountries());
    await pullCall(counters, errors, "country/leagues", () => fetchRugbyDataCountryLeagues(""));
    await pullCall(counters, errors, "news/leagues", () => fetchRugbyDataNewsLeagues());

    if (includeGlobalFeeds) {
      await pullCall(counters, errors, "search", () => fetchRugbyDataSearch("rugby"));
      await pullCall(counters, errors, "teams", () => fetchRugbyDataTeams());
    }

    let catalog = await getLatestLeagueCatalog();
    if (!catalog.length) {
      const discovered = await discoverRugbyDataLeagues({ startedBy: options.startedBy });
      catalog = discovered.leagues;
    }
    if (options.leagueLimit != null) {
      catalog = catalog.slice(0, options.leagueLimit);
    }

    const teamIds = new Set<number>();

    for (const league of catalog) {
      const leagueId = league.id;
      await pullCall(counters, errors, `league/${leagueId}/header`, () =>
        fetchRugbyDataLeague(leagueId),
      );

      const teamsRes = await (async () => {
        await throttleRugbyDataImport();
        return fetchRugbyDataLeagueTeams(leagueId);
      })();
      if (teamsRes.ok) {
        counters.ok += 1;
        for (const team of flattenRugbyDataLeagueTeams(teamsRes.data)) {
          teamIds.add(team.id);
        }
      } else {
        counters.failed += 1;
        errors.push(`league/${leagueId}/teams: ${teamsRes.errorMessage ?? "failed"}`);
      }

      await pullCall(counters, errors, `league/${leagueId}/matches finished`, () =>
        fetchRugbyDataLeagueMatches(leagueId, "finished"),
      );
      await pullCall(counters, errors, `league/${leagueId}/matches fixtures`, () =>
        fetchRugbyDataLeagueMatches(leagueId, "fixtures"),
      );
      await pullCall(counters, errors, `league/${leagueId}/table`, () =>
        fetchRugbyDataLeagueTable(leagueId),
      );
      await pullCall(counters, errors, `league/${leagueId}/news`, () =>
        fetchRugbyDataLeagueNews(leagueId),
      );

      if (includeMatchFeeds) {
        const finishedRes = await (async () => {
          await throttleRugbyDataImport();
          return fetchRugbyDataLeagueMatches(leagueId, "finished");
        })();
        if (finishedRes.ok) {
          counters.ok += 1;
          const matchIds = collectMatchIdsFromLeague(finishedRes.data, matchLimitPerLeague);
          for (const matchId of matchIds) {
            await pullCall(counters, errors, `match/${matchId}/detail`, () =>
              fetchRugbyDataMatchDetail(matchId),
            );
            await pullCall(counters, errors, `match/${matchId}/info`, () =>
              fetchRugbyDataMatchInfo(matchId),
            );
            await pullCall(counters, errors, `match/${matchId}/lineup`, () =>
              fetchRugbyDataMatchLineup(matchId),
            );
            await pullCall(counters, errors, `match/${matchId}/stat`, () =>
              fetchRugbyDataMatchTeamStats(matchId),
            );
            await pullCall(counters, errors, `match/${matchId}/player-stat`, () =>
              fetchRugbyDataMatchPlayerStats(matchId),
            );
            await pullCall(counters, errors, `match/${matchId}/table`, () =>
              fetchRugbyDataMatchTable(matchId),
            );
            result.matchesPulled += 1;
          }
        } else {
          counters.failed += 1;
          errors.push(
            `league/${leagueId}/matches (for match feeds): ${finishedRes.errorMessage ?? "failed"}`,
          );
        }
      }

      result.leaguesPulled += 1;
      await updateIntegrationJobProgress(job.id, {
        report: { lastLeagueId: leagueId, leaguesPulled: result.leaguesPulled },
      });
    }

    if (includeTeamFeeds) {
      let teamCount = 0;
      for (const teamId of teamIds) {
        if (teamCount >= teamLimit) break;
        await pullCall(counters, errors, `team/${teamId}/header`, () =>
          fetchRugbyDataTeamHeader(teamId),
        );
        await pullCall(counters, errors, `team/${teamId}/matches`, () =>
          fetchRugbyDataTeamMatches(teamId, "finished"),
        );
        await pullCall(counters, errors, `team/${teamId}/news`, () =>
          fetchRugbyDataTeamNews(teamId),
        );
        teamCount += 1;
        result.teamsPulled += 1;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    for (let offset = -dateSweepDays; offset <= dateSweepDays; offset += 1) {
      const dateKey = addDaysToDateKey(today, offset);
      await pullCall(counters, errors, `matches ${dateKey}`, () =>
        fetchRugbyDataMatchesByDate(dateKey, "all"),
      );
      await pullCall(counters, errors, `matches/count ${dateKey}`, () =>
        fetchRugbyDataMatchesCount(dateKey),
      );
      result.datesPulled += 1;
      if (result.datesPulled % 30 === 0) {
        await updateIntegrationJobProgress(job.id, {
          report: { lastDateKey: dateKey, datesPulled: result.datesPulled },
        });
      }
    }

    result.requestsOk = counters.ok;
    result.requestsFailed = counters.failed;
    result.errors = errors.slice(0, 500);

    await bumpIntegrationJobCounters(job.id, {
      recordsFound: counters.ok + counters.failed,
      recordsCreated: counters.ok,
      errors: counters.failed,
    });
    await completeIntegrationJob(job.id, result as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    result.requestsOk = counters.ok;
    result.requestsFailed = counters.failed;
    await failIntegrationJob(job.id, message, result as unknown as Record<string, unknown>);
    throw error;
  }

  return result;
}
