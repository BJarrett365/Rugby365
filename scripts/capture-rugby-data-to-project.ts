/**
 * Fetch every Rugby Union API endpoint and persist raw responses in the DB + docs samples.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/capture-rugby-data-to-project.ts
 */
import fs from "node:fs";
import path from "node:path";
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
} from "../apps/web/src/lib/rugby-data-api-client";

const SAMPLE_DATE = "2026-07-08";
const MATCH_ID = 7581;
const PLAYER_STAT_MATCH_ID = 7565;
const LEAGUE_ID = 193;
const TEAM_ID = 243;
const OUT_DIR = path.join(process.cwd(), "docs/rugby-data-api/samples");

type CaptureJob = {
  name: string;
  run: () => ReturnType<typeof fetchRugbyDataTeams>;
};

const jobs: CaptureJob[] = [
  { name: "countries_list", run: () => fetchRugbyDataCountries() },
  { name: "country_leagues", run: () => fetchRugbyDataCountryLeagues("") },
  { name: "news_leagues", run: () => fetchRugbyDataNewsLeagues() },
  { name: "search_bath", run: () => fetchRugbyDataSearch("bath") },
  { name: "teams", run: () => fetchRugbyDataTeams() },
  { name: `matches_${SAMPLE_DATE}`, run: () => fetchRugbyDataMatchesByDate(SAMPLE_DATE, "all") },
  {
    name: `matches_count_${SAMPLE_DATE}`,
    run: () => fetchRugbyDataMatchesCount(SAMPLE_DATE),
  },
  { name: `match_${MATCH_ID}_info`, run: () => fetchRugbyDataMatchInfo(MATCH_ID) },
  { name: `match_${MATCH_ID}_detail`, run: () => fetchRugbyDataMatchDetail(MATCH_ID) },
  { name: `match_${MATCH_ID}_stat`, run: () => fetchRugbyDataMatchTeamStats(MATCH_ID) },
  {
    name: `match_${PLAYER_STAT_MATCH_ID}_player_stat`,
    run: () => fetchRugbyDataMatchPlayerStats(PLAYER_STAT_MATCH_ID),
  },
  { name: `match_${MATCH_ID}_lineup`, run: () => fetchRugbyDataMatchLineup(MATCH_ID) },
  { name: `match_${MATCH_ID}_table`, run: () => fetchRugbyDataMatchTable(MATCH_ID) },
  {
    name: `league_${LEAGUE_ID}_matches`,
    run: () => fetchRugbyDataLeagueMatches(LEAGUE_ID, "finished"),
  },
  { name: `league_${LEAGUE_ID}_header`, run: () => fetchRugbyDataLeague(LEAGUE_ID) },
  { name: `league_${LEAGUE_ID}_table`, run: () => fetchRugbyDataLeagueTable(LEAGUE_ID) },
  { name: `league_${LEAGUE_ID}_teams`, run: () => fetchRugbyDataLeagueTeams(LEAGUE_ID) },
  { name: `league_${LEAGUE_ID}_news`, run: () => fetchRugbyDataLeagueNews(LEAGUE_ID) },
  {
    name: `team_${TEAM_ID}_matches`,
    run: () => fetchRugbyDataTeamMatches(TEAM_ID, "finished", "Europe/London"),
  },
  { name: `team_${TEAM_ID}_header`, run: () => fetchRugbyDataTeamHeader(TEAM_ID) },
  { name: `team_${TEAM_ID}_news`, run: () => fetchRugbyDataTeamNews(TEAM_ID) },
  { name: "league_104_prem_rugby_header", run: () => fetchRugbyDataLeague(104) },
  { name: "league_104_prem_rugby_table", run: () => fetchRugbyDataLeagueTable(104) },
  { name: "league_104_prem_rugby_teams", run: () => fetchRugbyDataLeagueTeams(104) },
  {
    name: "league_104_prem_rugby_matches",
    run: () => fetchRugbyDataLeagueMatches(104, "finished"),
  },
  { name: "prem_rugby_match_5370_info", run: () => fetchRugbyDataMatchInfo(5370) },
  { name: "prem_rugby_match_5370_detail", run: () => fetchRugbyDataMatchDetail(5370) },
  { name: "prem_rugby_match_5370_stat", run: () => fetchRugbyDataMatchTeamStats(5370) },
  {
    name: "prem_rugby_match_5370_player_stat",
    run: () => fetchRugbyDataMatchPlayerStats(5370),
  },
  { name: "prem_rugby_match_5370_lineup", run: () => fetchRugbyDataMatchLineup(5370) },
  { name: "prem_rugby_match_5370_table", run: () => fetchRugbyDataMatchTable(5370) },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const index: Array<Record<string, unknown>> = [];
  let ok = 0;

  for (const job of jobs) {
    const started = Date.now();
    const result = await job.run();
    const status = result.status || (result.ok ? 200 : 500);
    const payload = {
      _meta: {
        endpoint: job.name,
        path: result.endpoint,
        status,
        captured_at: new Date().toISOString(),
        response_time_ms: result.responseTimeMs,
        raw_response_id: result.rawResponseId ?? null,
      },
      response: result.ok
        ? { status, message: result.message, data: result.data }
        : { status, message: result.errorMessage ?? result.message ?? "Request failed" },
    };

    fs.writeFileSync(
      path.join(OUT_DIR, `${job.name}.json`),
      JSON.stringify(payload, null, 2).slice(0, 5_000_000),
    );

    index.push({
      name: job.name,
      status,
      file: `${job.name}.json`,
      endpoint: result.endpoint,
      ok: result.ok,
      ms: Date.now() - started,
      raw_response_id: result.rawResponseId ?? null,
    });

    if (result.ok) ok++;
    console.log(`${result.ok ? "✓" : "✗"} ${job.name} (${status}, ${result.responseTimeMs}ms)`);
  }

  fs.writeFileSync(path.join(OUT_DIR, "_index.json"), JSON.stringify(index, null, 2));
  console.log(`\nCaptured ${ok}/${jobs.length} Rugby Data API samples to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
