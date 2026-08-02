/**
 * Canonical catalog of Rugby Data API feeds/fields and their CMS ingest disposition.
 * Used by pull + gap-report tooling.
 */

export type IngestDisposition =
  | "ingested"
  | "partial"
  | "raw_only"
  | "not_pulled"
  | "not_in_feed"
  | "out_of_scope"
  | "blocked_by_policy";

export type FeedEndpointSpec = {
  id: string;
  method: "GET" | "POST";
  path: string;
  pullPhase: "discovery" | "global" | "league" | "team" | "match" | "date" | "fcm";
  disposition: IngestDisposition;
  targetTables: string[];
  reason: string;
};

export type FeedFieldSpec = {
  feedId: string;
  field: string;
  disposition: IngestDisposition;
  targetTable?: string;
  targetColumn?: string;
  reason: string;
};

export const RUGBY_DATA_FEED_ENDPOINTS: FeedEndpointSpec[] = [
  {
    id: "countries-list",
    method: "GET",
    path: "/countries/list",
    pullPhase: "discovery",
    disposition: "raw_only",
    targetTables: [],
    reason: "Discovery reference only; countries are not CMS entities. Stored in provider_raw_responses for audit.",
  },
  {
    id: "country-leagues",
    method: "GET",
    path: "/country/leagues",
    pullPhase: "discovery",
    disposition: "partial",
    targetTables: ["data_integration_jobs"],
    reason: "League catalog extracted to job preview; individual country rows are not persisted as entities.",
  },
  {
    id: "news-leagues",
    method: "GET",
    path: "/news/leagues",
    pullPhase: "discovery",
    disposition: "partial",
    targetTables: ["data_integration_jobs"],
    reason: "League ids merged into discovery catalog only.",
  },
  {
    id: "search",
    method: "GET",
    path: "/search",
    pullPhase: "global",
    disposition: "raw_only",
    targetTables: [],
    reason: "Lookup helper; entity resolution uses league/team lists instead.",
  },
  {
    id: "teams-global",
    method: "GET",
    path: "/teams",
    pullPhase: "global",
    disposition: "raw_only",
    targetTables: [],
    reason: "Global team directory is captured raw; structured import uses per-league /teams only.",
  },
  {
    id: "matches-by-date",
    method: "GET",
    path: "/matches",
    pullPhase: "date",
    disposition: "partial",
    targetTables: ["fixtures", "provider_entity_mappings"],
    reason: "Fixture rows created on date sweep; league metadata on each group is snapshot-only.",
  },
  {
    id: "matches-count",
    method: "GET",
    path: "/matches/count",
    pullPhase: "date",
    disposition: "raw_only",
    targetTables: [],
    reason: "Operational counter; no CMS table for match counts by date.",
  },
  {
    id: "league-header",
    method: "GET",
    path: "/league/:id/header",
    pullPhase: "league",
    disposition: "partial",
    targetTables: ["competitions", "competition_seasons", "provider_entity_mappings"],
    reason: "Name and season label ingested; lid/category_id/slug/tabs stored only in raw payload.",
  },
  {
    id: "league-teams",
    method: "GET",
    path: "/league/:id/teams",
    pullPhase: "league",
    disposition: "partial",
    targetTables: ["teams", "provider_entity_mappings"],
    reason: "Team id and name ingested; slug and group label are raw-only.",
  },
  {
    id: "league-matches-finished",
    method: "GET",
    path: "/league/:id/matches?match_type=finished",
    pullPhase: "league",
    disposition: "partial",
    targetTables: ["fixtures", "provider_entity_mappings"],
    reason: "Core fixture fields ingested; period scores and competitor form arrays are not.",
  },
  {
    id: "league-matches-fixtures",
    method: "GET",
    path: "/league/:id/matches?match_type=fixtures",
    pullPhase: "league",
    disposition: "partial",
    targetTables: ["fixtures", "provider_entity_mappings"],
    reason: "Upcoming fixtures ingested; live minute/score refresh relies on day sync.",
  },
  {
    id: "league-table",
    method: "GET",
    path: "/league/:id/table",
    pullPhase: "league",
    disposition: "partial",
    targetTables: ["standing_rows"],
    reason: "Overall view only; PF/PA/bonus/home-away splits and pool groups are not ingested.",
  },
  {
    id: "league-news",
    method: "GET",
    path: "/league/:id/news",
    pullPhase: "league",
    disposition: "raw_only",
    targetTables: [],
    reason: "News/articles are editorial content; no CMS news ingest pipeline for Rugby Data.",
  },
  {
    id: "team-header",
    method: "GET",
    path: "/team/:id/header",
    pullPhase: "team",
    disposition: "raw_only",
    targetTables: [],
    reason: "Team cn/gender/fid metadata captured raw; teams table filled from league lists.",
  },
  {
    id: "team-matches",
    method: "GET",
    path: "/team/:id/matches",
    pullPhase: "team",
    disposition: "raw_only",
    targetTables: [],
    reason: "Redundant with league/date fixture sources; captured for audit only.",
  },
  {
    id: "team-news",
    method: "GET",
    path: "/team/:id/news",
    pullPhase: "team",
    disposition: "raw_only",
    targetTables: [],
    reason: "No CMS news ingest from Rugby Data.",
  },
  {
    id: "match-detail",
    method: "GET",
    path: "/match/:id/detail",
    pullPhase: "match",
    disposition: "partial",
    targetTables: ["fixtures"],
    reason: "FT score/status/kickoff ingested; HT/ET/PS period scores not stored in dedicated columns.",
  },
  {
    id: "match-info",
    method: "GET",
    path: "/match/:id/info",
    pullPhase: "match",
    disposition: "partial",
    targetTables: ["match_events"],
    reason: "Scoring events ingested; SUB in/out player ids not linked; skipped when SDMS timeline exists.",
  },
  {
    id: "match-lineup",
    method: "GET",
    path: "/match/:id/lineup",
    pullPhase: "match",
    disposition: "partial",
    targetTables: ["fixture_players", "players", "provider_entity_mappings"],
    reason: "Squad list ingested; substitutions array and rugby_goals on lineup rows are not.",
  },
  {
    id: "match-stat",
    method: "GET",
    path: "/match/:id/stat",
    pullPhase: "match",
    disposition: "partial",
    targetTables: ["team_match_stats"],
    reason: "Summary + sections jsonb ingested; turnovers_won not mapped from API.",
  },
  {
    id: "match-player-stat",
    method: "GET",
    path: "/match/:id/player-stat",
    pullPhase: "match",
    disposition: "partial",
    targetTables: ["player_match_performance_stats", "players"],
    reason: "Core columns + extras jsonb; several stat types remain in extras only.",
  },
  {
    id: "match-table",
    method: "GET",
    path: "/match/:id/table",
    pullPhase: "match",
    disposition: "raw_only",
    targetTables: [],
    reason: "Pool standings in match context not wired to standing_rows (league table used instead).",
  },
  {
    id: "favourite",
    method: "POST",
    path: "/favourite",
    pullPhase: "fcm",
    disposition: "out_of_scope",
    targetTables: [],
    reason: "FCM favourites are out of project scope.",
  },
  {
    id: "get-favourites",
    method: "GET",
    path: "/get-favourites",
    pullPhase: "fcm",
    disposition: "out_of_scope",
    targetTables: [],
    reason: "FCM favourites are out of project scope.",
  },
  {
    id: "favourite-count",
    method: "GET",
    path: "/favourite/count",
    pullPhase: "fcm",
    disposition: "out_of_scope",
    targetTables: [],
    reason: "FCM favourites are out of project scope.",
  },
  {
    id: "my-matches",
    method: "GET",
    path: "/my-matches",
    pullPhase: "fcm",
    disposition: "out_of_scope",
    targetTables: [],
    reason: "Personal match lists require FCM token; out of scope.",
  },
];

/** Fields that appear in feeds but are not structured into CMS (or only partially). */
export const RUGBY_DATA_FEED_FIELDS: FeedFieldSpec[] = [
  {
    feedId: "league-header",
    field: "lid, category_id, fid, lso, sg, tabs",
    disposition: "raw_only",
    reason: "No competition columns for provider secondary ids/slugs; kept in raw payload only.",
  },
  {
    feedId: "league-teams",
    field: "teams[].sg, group label",
    disposition: "raw_only",
    targetTable: "teams",
    reason: "Import uses name + external id; slug from API not written to teams.slug.",
  },
  {
    feedId: "league-matches-finished",
    field: "ht, et, ps, aimId, competitors.htf/atf",
    disposition: "raw_only",
    targetTable: "fixtures",
    reason: "No period-score columns on fixtures; form arrays have no target table.",
  },
  {
    feedId: "league-table",
    field: "nrr, prem[], bonus points, home/away views",
    disposition: "raw_only",
    targetTable: "standing_rows",
    reason: "Importer writes overall view only; bonus columns often absent in API.",
  },
  {
    feedId: "match-detail",
    field: "ht, et, ps",
    disposition: "raw_only",
    targetTable: "fixtures",
    reason: "Period scores not modelled on fixtures table.",
  },
  {
    feedId: "match-info",
    field: "SUB piId/poId/piNm/poNm",
    disposition: "partial",
    targetTable: "match_events",
    reason: "Substitution events created but in/out players not stored in payload or player_id FK.",
  },
  {
    feedId: "match-info",
    field: "events[].sc",
    disposition: "partial",
    targetTable: "match_events",
    reason: "Score string stored in payload only, not parsed into fixture state.",
  },
  {
    feedId: "match-lineup",
    field: "substitutions[], rugby_goals[], cards[]",
    disposition: "raw_only",
    targetTable: "fixture_players",
    reason: "Lineup importer reads lineup[] only; scoring on lineup rows not copied to fixture_players stats.",
  },
  {
    feedId: "match-lineup",
    field: "pos",
    disposition: "partial",
    targetTable: "fixture_players",
    reason: "Often blank in API; position_name not derived from shirt number.",
  },
  {
    feedId: "match-stat",
    field: "turnovers_won",
    disposition: "partial",
    targetTable: "team_match_stats",
    reason: "Mapper hardcodes turnoversWon to 0.",
  },
  {
    feedId: "match-player-stat",
    field: "Penalty goals, Missed goals, Passes, Offloads, Missed tackles, Kick fromhand metres, cards",
    disposition: "partial",
    targetTable: "player_match_performance_stats",
    reason: "Stored in extras jsonb; not all map to typed performance columns.",
  },
  {
    feedId: "match-table",
    field: "pool table sc/cc/df/ded/wo_aet",
    disposition: "raw_only",
    targetTable: "standing_rows",
    reason: "Match-level pool tables not imported (league /table used instead).",
  },
  {
    feedId: "any",
    field: "venue, referee, coaches, attendance",
    disposition: "not_in_feed",
    reason: "Not present in Rugby Data API payloads; requires SDMS/Wikipedia/CMS.",
  },
  {
    feedId: "any",
    field: "player DOB, nationality, height, weight, image, bio",
    disposition: "not_in_feed",
    targetTable: "players",
    reason: "Not in Rugby Data API; requires Wikipedia/RugbyPass/CMS.",
  },
  {
    feedId: "any",
    field: "commentary, transfers, rankings, youtube",
    disposition: "not_in_feed",
    reason: "Outside Rugby Data API scope entirely.",
  },
];

export function summarizeFeedCatalog() {
  const byDisposition: Record<IngestDisposition, number> = {
    ingested: 0,
    partial: 0,
    raw_only: 0,
    not_pulled: 0,
    not_in_feed: 0,
    out_of_scope: 0,
    blocked_by_policy: 0,
  };
  for (const row of RUGBY_DATA_FEED_ENDPOINTS) {
    byDisposition[row.disposition] += 1;
  }
  for (const row of RUGBY_DATA_FEED_FIELDS) {
    byDisposition[row.disposition] += 1;
  }
  return {
    endpoints: RUGBY_DATA_FEED_ENDPOINTS.length,
    fieldGaps: RUGBY_DATA_FEED_FIELDS.length,
    byDisposition,
  };
}
