import "server-only";
import { and, desc, eq } from "drizzle-orm";
import {
  playerMatchPerformanceStats,
  playerSeasonStats,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  isRugbyChampionshipLineageSlug,
  isRugbyChampionshipPickerYear,
  rugbyChampionshipEraForYear,
  rugbyChampionshipEraLabel,
  rugbyChampionshipPickerDisplayLabel,
  RUGBY_CHAMPIONSHIP_FIRST_YEAR,
  TRI_NATIONS_FIRST_YEAR,
} from "./rugby-championship-lineage";
import { pickDefaultSeasonForPicker } from "./season-list-utils";
import {
  currentDomesticSeasonStartYear,
  formatSeasonRangeLabel,
  parseSeasonStartYear,
  usesDomesticSeasonCatalog,
} from "./season-label-utils";
import {
  getCompetitionBySlug,
  listSeasonsForPicker,
  syncDomesticSeasonCatalog,
  upsertSeason,
} from "./competition-admin-service";
import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "./nations-championship-hemisphere";
import {
  LEADERBOARD_VALUE_LABELS,
  teamCodeForLeaderboard,
} from "./competition-player-stat-display";

export type LeaderboardMetric =
  | "points"
  | "tries"
  | "tacklesCompleted"
  | "metresCarried"
  | "carries"
  | "tryAssists"
  | "defendersBeaten"
  | "lineBreaks"
  | "turnoversWon"
  | "dominantTackles"
  | "postContactMetres";

export type HemisphereFilter = "all" | "northern" | "southern";

export type CompetitionLeaderboardEntry = {
  rank: number;
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerImageUrl: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamShortName: string | null;
  teamCode: string;
  teamImageUrl: string | null;
  value: number;
  appearances: number;
  minutesPlayed: number;
  hemisphere: "northern" | "southern" | null;
};

export type CompetitionLeaderboardBoard = {
  metric: LeaderboardMetric;
  label: string;
  valueLabel: string;
  /** True when at least one player has a non-zero value for this metric in-season. */
  hasTrackedData: boolean;
  emptyMessage: string;
  entries: CompetitionLeaderboardEntry[];
};

export type CompetitionPlayerStatsPayload = {
  competition: { id: string; slug: string; name: string };
  seasons: Array<{
    id: string;
    label: string;
    year: number;
    isActive: boolean;
    displayLabel?: string;
    era?: string | null;
    eraGroup?: string | null;
  }>;
  season: {
    id: string;
    label: string;
    year: number;
    isActive: boolean;
    era?: string | null;
  } | null;
  hemisphereFilter: HemisphereFilter;
  supportsHemisphereFilter: boolean;
  boards: CompetitionLeaderboardBoard[];
  additionalBoards: CompetitionLeaderboardBoard[];
  coverage: {
    playerCount: number;
    rowCount: number;
    source: "season_stats" | "match_stats" | "none";
  };
};

const PRIMARY_BOARDS: Array<{ metric: LeaderboardMetric; label: string }> = [
  { metric: "points", label: "Top Points Scorers" },
  { metric: "tries", label: "Top Try Scorers" },
  { metric: "tacklesCompleted", label: "Top Tackles" },
  { metric: "metresCarried", label: "Most Metres" },
  { metric: "carries", label: "Most Carries" },
  { metric: "tryAssists", label: "Top Assists" },
];

const ADDITIONAL_BOARDS: Array<{ metric: LeaderboardMetric; label: string }> = [
  { metric: "defendersBeaten", label: "Most Defenders Beaten" },
  { metric: "lineBreaks", label: "Most Clean Breaks" },
  { metric: "turnoversWon", label: "Most Turnovers Won" },
  { metric: "dominantTackles", label: "Most Dominant Tackles" },
  { metric: "postContactMetres", label: "Most Post-Contact Metres" },
];

type AggregatedPlayer = {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerImageUrl: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamShortName: string | null;
  teamImageUrl: string | null;
  appearances: number;
  minutesPlayed: number;
  points: number;
  tries: number;
  tacklesCompleted: number;
  metresCarried: number;
  carries: number;
  tryAssists: number;
  defendersBeaten: number;
  lineBreaks: number;
  turnoversWon: number;
  dominantTackles: number;
  postContactMetres: number;
  hemisphere: "northern" | "southern" | null;
};

function emptyAgg(
  base: Omit<
    AggregatedPlayer,
    | "appearances"
    | "minutesPlayed"
    | "points"
    | "tries"
    | "tacklesCompleted"
    | "metresCarried"
    | "carries"
    | "tryAssists"
    | "defendersBeaten"
    | "lineBreaks"
    | "turnoversWon"
    | "dominantTackles"
    | "postContactMetres"
  >,
): AggregatedPlayer {
  return {
    ...base,
    appearances: 0,
    minutesPlayed: 0,
    points: 0,
    tries: 0,
    tacklesCompleted: 0,
    metresCarried: 0,
    carries: 0,
    tryAssists: 0,
    defendersBeaten: 0,
    lineBreaks: 0,
    turnoversWon: 0,
    dominantTackles: 0,
    postContactMetres: 0,
  };
}

function metricValue(row: AggregatedPlayer, metric: LeaderboardMetric): number {
  return row[metric] ?? 0;
}

function emptyMessageForBoard(hasTrackedData: boolean, playerCount: number): string {
  if (playerCount === 0) {
    return "No player statistics available for this season.";
  }
  if (!hasTrackedData) {
    return "No data available for this season.";
  }
  return "No data available for this season.";
}

function rankBoard(
  rows: AggregatedPlayer[],
  metric: LeaderboardMetric,
  label: string,
  limit: number,
): CompetitionLeaderboardBoard {
  const hasTrackedData = rows.some((row) => metricValue(row, metric) > 0);
  const ranked = [...rows]
    .map((row) => ({ row, value: metricValue(row, metric) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.row.appearances !== a.row.appearances) return b.row.appearances - a.row.appearances;
      return a.row.playerName.localeCompare(b.row.playerName);
    })
    .slice(0, limit);

  return {
    metric,
    label,
    valueLabel: LEADERBOARD_VALUE_LABELS[metric] ?? "VAL",
    hasTrackedData,
    emptyMessage: emptyMessageForBoard(hasTrackedData, rows.length),
    entries: ranked.map((entry, index) => ({
      rank: index + 1,
      playerId: entry.row.playerId,
      playerName: entry.row.playerName,
      playerSlug: entry.row.playerSlug,
      playerImageUrl: entry.row.playerImageUrl,
      teamId: entry.row.teamId,
      teamName: entry.row.teamName,
      teamSlug: entry.row.teamSlug,
      teamShortName: entry.row.teamShortName,
      teamCode: teamCodeForLeaderboard({
        teamName: entry.row.teamName,
        teamShortName: entry.row.teamShortName,
      }),
      teamImageUrl: entry.row.teamImageUrl,
      value: entry.value,
      appearances: entry.row.appearances,
      minutesPlayed: entry.row.minutesPlayed,
      hemisphere: entry.row.hemisphere,
    })),
  };
}

function decorateSeasonsForCompetition(
  slug: string,
  seasons: Awaited<ReturnType<typeof listSeasonsForPicker>>,
) {
  if (!isRugbyChampionshipLineageSlug(slug)) {
    return seasons.map((season) => ({
      ...season,
      era: null as string | null,
      eraGroup: null as string | null,
    }));
  }

  return seasons
    .filter((season) => isRugbyChampionshipPickerYear(season.year))
    .map((season) => {
      const era = rugbyChampionshipEraForYear(season.year);
      const eraLabel = rugbyChampionshipEraLabel(era);
      // Preserve " — just finished" (and similar) suffixes from decorateSeasonPickerRows.
      const statusSuffix =
        typeof season.displayLabel === "string" && season.displayLabel.includes(" — ")
          ? season.displayLabel.slice(season.displayLabel.indexOf(" — "))
          : "";
      return {
        ...season,
        era: eraLabel,
        eraGroup: eraLabel,
        displayLabel: rugbyChampionshipPickerDisplayLabel(season.year, statusSuffix),
      };
    });
}

/** Guarantee Tri Nations + Rugby Championship season rows exist for the picker. */
async function ensureRugbyChampionshipSeasonCatalog(competitionId: string) {
  const existing = await listSeasonsForPicker(competitionId);
  const years = new Set(existing.map((season) => season.year));
  const lastYear = Math.max(currentDomesticSeasonStartYear(), RUGBY_CHAMPIONSHIP_FIRST_YEAR);
  for (let year = lastYear; year >= TRI_NATIONS_FIRST_YEAR; year -= 1) {
    if (years.has(year)) continue;
    await upsertSeason({
      competitionId,
      label: formatSeasonRangeLabel(year),
      seasonKind: "club",
    });
  }
}

async function seasonIdsWithPlayerStats(competitionId: string): Promise<Set<string>> {
  const db = getDb();
  const [seasonRows, matchRows] = await Promise.all([
    db
      .selectDistinct({ seasonId: playerSeasonStats.seasonId })
      .from(playerSeasonStats)
      .where(eq(playerSeasonStats.competitionId, competitionId)),
    db
      .selectDistinct({ seasonId: playerMatchPerformanceStats.seasonId })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.competitionId, competitionId)),
  ]);

  const ids = new Set<string>();
  for (const row of seasonRows) {
    if (row.seasonId) ids.add(row.seasonId);
  }
  for (const row of matchRows) {
    if (row.seasonId) ids.add(row.seasonId);
  }
  return ids;
}

async function resolveSeasonForCompetition(
  competitionId: string,
  competitionSlug: string,
  seasonLabel?: string,
) {
  if (isRugbyChampionshipLineageSlug(competitionSlug)) {
    await ensureRugbyChampionshipSeasonCatalog(competitionId);
  }

  const seasons = decorateSeasonsForCompetition(
    competitionSlug,
    await listSeasonsForPicker(competitionId),
  );

  if (!seasonLabel?.trim()) {
    const withStats = await seasonIdsWithPlayerStats(competitionId);
    const latestWithStats =
      seasons.find((season) => withStats.has(season.id)) ?? null;
    const fallback = pickDefaultSeasonForPicker(seasons) ?? seasons[0] ?? null;
    return { seasons, season: latestWithStats ?? fallback };
  }

  const requested = seasonLabel.trim();
  const requestedYear = parseSeasonStartYear(requested);
  const match =
    seasons.find((s) => s.label === requested) ??
    seasons.find((s) => s.label.replace(/–/g, "-") === requested.replace(/–/g, "-")) ??
    seasons.find((s) => (s.displayLabel ?? "") === requested) ??
    seasons.find((s) => (s.displayLabel ?? "").replace(/–/g, "-") === requested.replace(/–/g, "-")) ??
    (requestedYear != null ? seasons.find((s) => s.year === requestedYear) : null) ??
    null;
  return { seasons, season: match };
}

async function loadSeasonStatAggregates(
  competitionId: string,
  seasonId: string,
): Promise<AggregatedPlayer[]> {
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerSeasonStats.playerId,
      playerName: players.name,
      playerSlug: players.slug,
      playerImageUrl: players.imageUrl,
      teamId: playerSeasonStats.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      teamImageUrl: teams.imageUrl,
      appearances: playerSeasonStats.appearances,
      minutesPlayed: playerSeasonStats.minutesPlayed,
      points: playerSeasonStats.points,
      tries: playerSeasonStats.tries,
      tacklesCompleted: playerSeasonStats.tacklesCompleted,
      metresCarried: playerSeasonStats.metresCarried,
      carries: playerSeasonStats.carries,
      tryAssists: playerSeasonStats.tryAssists,
      defendersBeaten: playerSeasonStats.defendersBeaten,
      lineBreaks: playerSeasonStats.lineBreaks,
      turnoversWon: playerSeasonStats.turnoversWon,
      dominantTackles: playerSeasonStats.dominantTackles,
      postContactMetres: playerSeasonStats.postContactMetres,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(
      and(
        eq(playerSeasonStats.competitionId, competitionId),
        eq(playerSeasonStats.seasonId, seasonId),
      ),
    )
    .orderBy(desc(playerSeasonStats.points));

  return rows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    playerSlug: row.playerSlug,
    playerImageUrl: row.playerImageUrl,
    teamId: row.teamId,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    teamShortName: row.teamShortName,
    teamImageUrl: row.teamImageUrl,
    appearances: row.appearances ?? 0,
    minutesPlayed: row.minutesPlayed ?? 0,
    points: row.points ?? 0,
    tries: row.tries ?? 0,
    tacklesCompleted: row.tacklesCompleted ?? 0,
    metresCarried: row.metresCarried ?? 0,
    carries: row.carries ?? 0,
    tryAssists: row.tryAssists ?? 0,
    defendersBeaten: row.defendersBeaten ?? 0,
    lineBreaks: row.lineBreaks ?? 0,
    turnoversWon: row.turnoversWon ?? 0,
    dominantTackles: row.dominantTackles ?? 0,
    postContactMetres: row.postContactMetres ?? 0,
    hemisphere: nationsChampionshipHemisphereForTeam(row.teamName),
  }));
}

async function loadMatchStatAggregates(
  competitionId: string,
  seasonId: string,
): Promise<{ players: AggregatedPlayer[]; rowCount: number }> {
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerMatchPerformanceStats.playerId,
      playerName: players.name,
      playerSlug: players.slug,
      playerImageUrl: players.imageUrl,
      teamId: playerMatchPerformanceStats.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      teamImageUrl: teams.imageUrl,
      minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
      points: playerMatchPerformanceStats.points,
      tries: playerMatchPerformanceStats.tries,
      tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      carries: playerMatchPerformanceStats.carries,
      tryAssists: playerMatchPerformanceStats.tryAssists,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
      dominantTackles: playerMatchPerformanceStats.dominantTackles,
      postContactMetres: playerMatchPerformanceStats.postContactMetres,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .innerJoin(teams, eq(playerMatchPerformanceStats.teamId, teams.id))
    .where(
      and(
        eq(playerMatchPerformanceStats.competitionId, competitionId),
        eq(playerMatchPerformanceStats.seasonId, seasonId),
      ),
    )
    .orderBy(desc(playerMatchPerformanceStats.syncedAt));

  const buckets = new Map<string, AggregatedPlayer>();
  for (const row of rows) {
    const key = `${row.playerId}:${row.teamId}`;
    const existing =
      buckets.get(key) ??
      emptyAgg({
        playerId: row.playerId,
        playerName: row.playerName,
        playerSlug: row.playerSlug,
        playerImageUrl: row.playerImageUrl,
        teamId: row.teamId,
        teamName: row.teamName,
        teamSlug: row.teamSlug,
        teamShortName: row.teamShortName,
        teamImageUrl: row.teamImageUrl,
        hemisphere: nationsChampionshipHemisphereForTeam(row.teamName),
      });

    existing.appearances += 1;
    existing.minutesPlayed += row.minutesPlayed ?? 0;
    existing.points += row.points ?? 0;
    existing.tries += row.tries ?? 0;
    existing.tacklesCompleted += row.tacklesCompleted ?? 0;
    existing.metresCarried += row.metresCarried ?? 0;
    existing.carries += row.carries ?? 0;
    existing.tryAssists += row.tryAssists ?? 0;
    existing.defendersBeaten += row.defendersBeaten ?? 0;
    existing.lineBreaks += row.lineBreaks ?? 0;
    existing.turnoversWon += row.turnoversWon ?? 0;
    existing.dominantTackles += row.dominantTackles ?? 0;
    existing.postContactMetres += row.postContactMetres ?? 0;
    buckets.set(key, existing);
  }

  return { players: [...buckets.values()], rowCount: rows.length };
}

function emptyBoards(): {
  boards: CompetitionLeaderboardBoard[];
  additionalBoards: CompetitionLeaderboardBoard[];
} {
  return {
    boards: PRIMARY_BOARDS.map((b) => ({
      ...b,
      valueLabel: LEADERBOARD_VALUE_LABELS[b.metric] ?? "VAL",
      hasTrackedData: false,
      emptyMessage: "No player statistics available for this season.",
      entries: [],
    })),
    additionalBoards: ADDITIONAL_BOARDS.map((b) => ({
      ...b,
      valueLabel: LEADERBOARD_VALUE_LABELS[b.metric] ?? "VAL",
      hasTrackedData: false,
      emptyMessage: "No player statistics available for this season.",
      entries: [],
    })),
  };
}

/** Exported for unit tests — metrics with all zeros are treated as untracked. */
export function metricHasTrackedData(
  rows: Array<Partial<Record<LeaderboardMetric, number>>>,
  metric: LeaderboardMetric,
): boolean {
  return rows.some((row) => (row[metric] ?? 0) > 0);
}

export async function getCompetitionPlayerStatsBySlug(
  slug: string,
  options: {
    seasonLabel?: string;
    hemisphere?: HemisphereFilter;
    limit?: number;
  } = {},
): Promise<CompetitionPlayerStatsPayload | null> {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  // Avoid re-expanding the domestic 1987→current catalog over RC / Tri Nations lineage.
  if (
    usesDomesticSeasonCatalog(competition.competitionType) &&
    !isRugbyChampionshipLineageSlug(competition.slug)
  ) {
    await syncDomesticSeasonCatalog(competition.id);
  }

  let { seasons, season } = await resolveSeasonForCompetition(
    competition.id,
    competition.slug,
    options.seasonLabel,
  );

  // Future "active" RWC seasons (e.g. 2027) have empty boards and wipe the UI after load.
  // Prefer a completed tournament unless the caller asked for a specific season.
  if (!options.seasonLabel?.trim() && competition.slug === "rugby-world-cup") {
    const nowYear = new Date().getFullYear();
    season =
      seasons.find((s) => s.year === 1987) ??
      seasons.find((s) => s.isActive && (s.year ?? 0) <= nowYear) ??
      [...seasons]
        .filter((s) => (s.year ?? 0) > 0 && (s.year ?? 0) <= nowYear)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ??
      season;
  }

  const supportsHemisphereFilter = isNationsChampionshipSlug(competition.slug);
  const hemisphereFilter: HemisphereFilter =
    supportsHemisphereFilter && options.hemisphere
      ? options.hemisphere
      : "all";
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);

  if (!season) {
    const empty = emptyBoards();
    return {
      competition: {
        id: competition.id,
        slug: competition.slug,
        name: competition.name,
      },
      seasons,
      season: null,
      hemisphereFilter,
      supportsHemisphereFilter,
      ...empty,
      coverage: { playerCount: 0, rowCount: 0, source: "none" },
    };
  }

  const seasonEra = isRugbyChampionshipLineageSlug(competition.slug)
    ? rugbyChampionshipEraLabel(rugbyChampionshipEraForYear(season.year))
    : null;

  // Prefer season aggregates (full squad coverage) when present for this season only.
  let aggregated = await loadSeasonStatAggregates(competition.id, season.id);
  let rowCount = aggregated.length;
  let source: CompetitionPlayerStatsPayload["coverage"]["source"] =
    aggregated.length > 0 ? "season_stats" : "none";

  if (aggregated.length === 0) {
    const matchAgg = await loadMatchStatAggregates(competition.id, season.id);
    aggregated = matchAgg.players;
    rowCount = matchAgg.rowCount;
    source = matchAgg.rowCount > 0 ? "match_stats" : "none";
  }

  // Never fall back to another season's rows.
  if (supportsHemisphereFilter && hemisphereFilter !== "all") {
    aggregated = aggregated.filter((row) => row.hemisphere === hemisphereFilter);
  }

  // Drop unknown placeholders from public boards.
  aggregated = aggregated.filter(
    (row) =>
      row.playerName.trim().length > 0 &&
      !/^unknown\b/i.test(row.playerName) &&
      !/^unknown\b/i.test(row.teamName),
  );

  return {
    competition: {
      id: competition.id,
      slug: competition.slug,
      name: competition.name,
    },
    seasons,
    season: {
      id: season.id,
      label: season.label,
      year: season.year,
      isActive: Boolean(season.isActive),
      era: seasonEra,
    },
    hemisphereFilter,
    supportsHemisphereFilter,
    boards: PRIMARY_BOARDS.map((board) =>
      rankBoard(aggregated, board.metric, board.label, limit),
    ),
    additionalBoards: ADDITIONAL_BOARDS.map((board) =>
      rankBoard(aggregated, board.metric, board.label, limit),
    ),
    coverage: {
      playerCount: aggregated.length,
      rowCount,
      source,
    },
  };
}
