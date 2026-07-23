/** Pure helpers for Matches CMS list (Phase A). */

export const MATCH_CMS_PAGE_SIZE_DEFAULT = 20;

export const MATCH_CMS_INCOMPLETE_FILTERS_MESSAGE =
  "Select a date range to load fixtures. Competition can be All competitions or a specific league.";

export const MATCH_CMS_SORT_OPTIONS = [
  "kickoff",
  "competition",
  "home",
  "away",
  "status",
  "provider",
  "id",
] as const;

export type MatchCmsSort = (typeof MATCH_CMS_SORT_OPTIONS)[number];

export const MATCH_CMS_PROVIDERS = [
  "rugby_data",
  "planet_rugby",
  "sport365",
  "livesport",
  "wikipedia",
  "manual",
] as const;

export type MatchCmsProvider = (typeof MATCH_CMS_PROVIDERS)[number];

export type MatchCmsListFilters = {
  fromDate?: string | null;
  toDate?: string | null;
  competitionId?: string | null;
  seasonId?: string | null;
  status?: string | null;
  provider?: MatchCmsProvider | string | null;
  teamQuery?: string | null;
  sort?: MatchCmsSort | string | null;
  sortDir?: "asc" | "desc" | string | null;
  page?: number | null;
  pageSize?: number | null;
  /** Today's Matches ops mode */
  ops?: "today" | string | null;
  opsBucket?: string | null;
};

export type InferProviderInput = {
  externalMatchId?: string | null;
  sport365Url?: string | null;
  planetRugbyUrl?: string | null;
  /** Confirmed rugby_data mapping external id, if any */
  rugbyDataExternalId?: string | null;
  /**
   * Explicit operator choice stored on provider_snapshot.primarySource.
   * When set to a known provider, it wins over inference.
   */
  primarySource?: string | null;
};

export function isMatchCmsProvider(value: string | null | undefined): value is MatchCmsProvider {
  return Boolean(value && (MATCH_CMS_PROVIDERS as readonly string[]).includes(value));
}

export function inferMatchProvider(input: InferProviderInput): MatchCmsProvider {
  if (isMatchCmsProvider(input.primarySource?.trim())) {
    return input.primarySource.trim() as MatchCmsProvider;
  }
  if (input.rugbyDataExternalId?.trim()) return "rugby_data";
  const ext = input.externalMatchId?.trim() ?? "";
  if (ext.startsWith("livesport:")) return "livesport";
  if (ext.startsWith("wikipedia:")) return "wikipedia";
  if (input.sport365Url?.trim()) return "sport365";
  if (input.planetRugbyUrl?.trim() || ext) return "planet_rugby";
  return "manual";
}

/** Descriptions for the Match Sources CMS template. */
export function matchProviderBlurb(provider: MatchCmsProvider | string): string {
  switch (provider) {
    case "rugby_data":
      return "Sport CC / Rugby Data API — primary structured feed for scores, lineups, and stats.";
    case "planet_rugby":
      return "Planet Rugby match pages — enrich venue, lineups, events, and head-to-head.";
    case "sport365":
      return "Sport365 match URL — sync live scores, events, and match clock.";
    case "livesport":
      return "LiveSport external id — link when the fixture is keyed from LiveSport.";
    case "wikipedia":
      return "Wikipedia-sourced fixture — used for historical or manually curated imports.";
    case "manual":
      return "Operator-entered data only — no external provider powers this match.";
    default:
      return "External data provider for this match.";
  }
}

export function matchProviderLabel(provider: MatchCmsProvider | string): string {
  switch (provider) {
    case "rugby_data":
      return "Sport CC Data";
    case "planet_rugby":
      return "Planet Rugby";
    case "sport365":
      return "Sport365";
    case "livesport":
      return "LiveSport";
    case "wikipedia":
      return "Wiki";
    case "manual":
      return "Manual";
    case "ai":
      return "AI";
    case "rugbypass":
      return "RugbyPass";
    case "world_rugby":
      return "World Rugby";
    case "club_website":
      return "Club Source";
    default:
      return provider;
  }
}

/** Compact pill class names using existing CMS status colours. */
export function matchProviderPillClass(provider: MatchCmsProvider | string): string {
  switch (provider) {
    case "rugby_data":
      return "cms-status cms-status--success";
    case "planet_rugby":
      return "cms-status cms-status--neutral";
    case "sport365":
      return "cms-status cms-status--warning";
    case "livesport":
      return "cms-status cms-status--neutral";
    case "wikipedia":
      return "cms-status cms-status--neutral";
    case "manual":
      return "cms-status cms-status--neutral";
    default:
      return "cms-status cms-status--neutral";
  }
}

export function parseMatchCmsFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): MatchCmsListFilters {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      const v = params.get(key);
      return v?.trim() ? v.trim() : null;
    }
    const raw = params[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v?.trim() ? v.trim() : null;
  };

  const pageRaw = Number(get("page") ?? "1");
  const pageSizeRaw = Number(get("pageSize") ?? String(MATCH_CMS_PAGE_SIZE_DEFAULT));

  return {
    fromDate: get("from"),
    toDate: get("to"),
    competitionId: get("competitionId"),
    seasonId: get("seasonId"),
    status: get("status"),
    provider: get("provider"),
    teamQuery: get("q") ?? get("team"),
    sort: get("sort") ?? "kickoff",
    sortDir: get("sortDir") ?? "desc",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    pageSize:
      Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
        ? Math.min(200, Math.floor(pageSizeRaw))
        : MATCH_CMS_PAGE_SIZE_DEFAULT,
    ops: get("ops"),
    opsBucket: get("opsBucket"),
  };
}

export function matchCmsFiltersToSearchParams(filters: MatchCmsListFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.fromDate) sp.set("from", filters.fromDate);
  if (filters.toDate) sp.set("to", filters.toDate);
  if (filters.competitionId) sp.set("competitionId", filters.competitionId);
  if (filters.seasonId) sp.set("seasonId", filters.seasonId);
  if (filters.status) sp.set("status", filters.status);
  if (filters.provider) sp.set("provider", filters.provider);
  if (filters.teamQuery) sp.set("q", filters.teamQuery);
  if (filters.sort && filters.sort !== "kickoff") sp.set("sort", filters.sort);
  if (filters.sortDir && filters.sortDir !== "desc") sp.set("sortDir", filters.sortDir);
  if (filters.page && filters.page > 1) sp.set("page", String(filters.page));
  if (filters.pageSize && filters.pageSize !== MATCH_CMS_PAGE_SIZE_DEFAULT) {
    sp.set("pageSize", String(filters.pageSize));
  }
  if (filters.ops) sp.set("ops", filters.ops);
  if (filters.opsBucket && filters.opsBucket !== "all") sp.set("opsBucket", filters.opsBucket);
  return sp;
}

export type MatchCmsListRow = {
  id: string;
  kickoffAt: string | null;
  status: string;
  homeScore: number;
  awayScore: number;
  externalMatchId: string | null;
  primaryApiMatchId: string | null;
  provider: MatchCmsProvider;
  competitionId: string | null;
  competitionName: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  venueId: string | null;
  refereeId: string | null;
  hasLineups: boolean;
  hasTeamStats: boolean;
  hasPlayerStats: boolean;
  scoreLocked: boolean;
  statusLocked: boolean;
  warningCount: number;
  slug: string | null;
};

export type MatchCmsGroup = {
  key: string;
  competitionId: string | null;
  competitionName: string;
  seasonId: string | null;
  seasonLabel: string | null;
  matchCount: number;
  mainProvider: MatchCmsProvider | "mixed";
  matches: MatchCmsListRow[];
};

export function groupMatchesByCompetitionSeason(rows: MatchCmsListRow[]): MatchCmsGroup[] {
  const map = new Map<string, MatchCmsGroup>();

  for (const row of rows) {
    const competitionName = row.competitionName?.trim() || "Unassigned";
    const seasonLabel = row.seasonLabel?.trim() || "No season";
    const key = `${row.competitionId ?? "none"}::${row.seasonId ?? seasonLabel}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        competitionId: row.competitionId,
        competitionName,
        seasonId: row.seasonId,
        seasonLabel: row.seasonLabel,
        matchCount: 0,
        mainProvider: row.provider,
        matches: [],
      };
      map.set(key, group);
    }
    group.matches.push(row);
    group.matchCount = group.matches.length;
    if (group.mainProvider !== "mixed" && group.mainProvider !== row.provider) {
      group.mainProvider = "mixed";
    }
  }

  return Array.from(map.values());
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + deltaDays);
  return localDateKey(dt);
}
