/**
 * Rugby Data API (Rugby Union) endpoint catalog — mirrors the Postman collection
 * at docs/rugby-data-api/Rugby.Union.Apis.postman_collection.json.
 */
export type RugbyDataApiHttpMethod = "GET" | "POST";

export type RugbyDataApiEndpoint = {
  id: string;
  name: string;
  group: string;
  method: RugbyDataApiHttpMethod;
  /** Path relative to base URL, e.g. /api/v1/rugby-union/teams */
  path: string;
  /** Example path with sample IDs for docs / admin proxy links */
  samplePath: string;
  sampleQuery?: Record<string, string>;
  optionalHeaders?: string[];
  notes?: string;
};

export const RUGBY_DATA_API_BASE_PATH = "/api/v1/rugby-union";

export function buildRugbyUnionPath(segments: string[]): string {
  const suffix = segments.filter(Boolean).join("/");
  return suffix ? `${RUGBY_DATA_API_BASE_PATH}/${suffix}` : RUGBY_DATA_API_BASE_PATH;
}

export function isValidRugbyUnionPath(path: string): boolean {
  if (!path.startsWith(`${RUGBY_DATA_API_BASE_PATH}/`) && path !== RUGBY_DATA_API_BASE_PATH) {
    return false;
  }
  return !path.includes("..");
}

export const RUGBY_DATA_API_ENDPOINTS: RugbyDataApiEndpoint[] = [
  // Match detail
  {
    id: "match-info",
    name: "Match info",
    group: "Match Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/match/:matchId/info`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/match/7581/info`,
  },
  {
    id: "match-detail",
    name: "Match Detail",
    group: "Match Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/match/:matchId/detail`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/match/7581/detail`,
  },
  {
    id: "match-stat",
    name: "Match Stats",
    group: "Match Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/match/:matchId/stat`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/match/7581/stat`,
  },
  {
    id: "match-player-stat",
    name: "Match player Stats",
    group: "Match Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/match/:matchId/player-stat`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/match/7565/player-stat`,
  },
  {
    id: "match-lineup",
    name: "Match Lineup",
    group: "Match Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/match/:matchId/lineup`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/match/7581/lineup`,
  },
  {
    id: "match-table",
    name: "Standings",
    group: "Match Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/match/:matchId/table`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/match/7581/table`,
    sampleQuery: { type: "all" },
  },
  // Match listing
  {
    id: "matches",
    name: "Match Listing",
    group: "Match Listing",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/matches`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/matches`,
    sampleQuery: { type: "all", date: "2026-07-08" },
    optionalHeaders: ["difference", "timezone"],
    notes: "type: all | live | finished",
  },
  {
    id: "matches-count",
    name: "Match Counter",
    group: "Match Listing",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/matches/count`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/matches/count`,
    sampleQuery: { date: "2026-07-08" },
  },
  {
    id: "favourite",
    name: "Favourites (Add or Remove)",
    group: "Match Listing",
    method: "POST",
    path: `${RUGBY_DATA_API_BASE_PATH}/favourite`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/favourite`,
    optionalHeaders: ["timezone"],
    notes: "Form body: fcm_token, id, type (match|team|league), is_save (1|0)",
  },
  {
    id: "get-favourites",
    name: "Get Favourites",
    group: "Match Listing",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/get-favourites`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/get-favourites`,
    sampleQuery: { fcm_token: "example-fcm-token" },
    optionalHeaders: ["timezone"],
  },
  {
    id: "favourite-count",
    name: "Favourites counter",
    group: "Match Listing",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/favourite/count`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/favourite/count`,
    sampleQuery: { fcm_token: "example-fcm-token" },
    optionalHeaders: ["timezone"],
  },
  {
    id: "my-matches",
    name: "Get My Matches",
    group: "Match Listing",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/my-matches`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/my-matches`,
    sampleQuery: { fcm_token: "example-fcm-token" },
    optionalHeaders: ["timezone"],
    notes: "Optional matches[] query for specific match ids",
  },
  {
    id: "teams",
    name: "Teams Listing",
    group: "Match Listing",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/teams`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/teams`,
  },
  // League detail
  {
    id: "league-matches",
    name: "League Matches",
    group: "League Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/league/:leagueId/matches`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/league/193/matches`,
    sampleQuery: { match_type: "finished" },
    optionalHeaders: ["timezone"],
    notes: "match_type: finished | fixtures",
  },
  {
    id: "league-header",
    name: "League Header",
    group: "League Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/league/:leagueId/header`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/league/193/header`,
  },
  {
    id: "league-table",
    name: "League Standing",
    group: "League Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/league/:leagueId/table`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/league/193/table`,
  },
  {
    id: "league-teams",
    name: "team",
    group: "League Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/league/:leagueId/teams`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/league/193/teams`,
  },
  {
    id: "league-news",
    name: "news",
    group: "League Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/league/:leagueId/news`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/league/193/news`,
  },
  // Team detail
  {
    id: "team-matches",
    name: "Team Matches",
    group: "Team Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/team/:teamId/matches`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/team/243/matches`,
    sampleQuery: { type: "finished" },
    optionalHeaders: ["timezone"],
  },
  {
    id: "team-header",
    name: "Team Header",
    group: "Team Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/team/:teamId/header`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/team/243/header`,
  },
  {
    id: "team-news",
    name: "Team news",
    group: "Team Detail",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/team/:teamId/news`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/team/243/news`,
  },
  // Top-level
  {
    id: "countries-list",
    name: "countries Listing",
    group: "Discovery",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/countries/list`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/countries/list`,
  },
  {
    id: "country-leagues",
    name: "country leagues",
    group: "Discovery",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/country/leagues`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/country/leagues`,
    sampleQuery: { q: "" },
  },
  {
    id: "news-leagues",
    name: "news leagues",
    group: "Discovery",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/news/leagues`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/news/leagues`,
  },
  {
    id: "search",
    name: "Search",
    group: "Discovery",
    method: "GET",
    path: `${RUGBY_DATA_API_BASE_PATH}/search`,
    samplePath: `${RUGBY_DATA_API_BASE_PATH}/search`,
    sampleQuery: { q: "bath" },
  },
];

export function buildRugbyDataApiProxyUrl(
  samplePath: string,
  query?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== "") params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${samplePath}?${qs}` : samplePath;
}
