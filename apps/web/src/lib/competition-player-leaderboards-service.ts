import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { playerMatchPerformanceStats, players, teams } from "@rugby365/db";
import { getDb } from "./db";
import {
  getCompetitionBySlug,
  listSeasonsForPicker,
  syncDomesticSeasonCatalog,
} from "./competition-admin-service";
import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "./nations-championship-hemisphere";
import { parseSeasonStartYear, usesDomesticSeasonCatalog } from "./season-label-utils";
import {
  LEADERBOARD_VALUE_LABELS,
  teamCodeForLeaderboard,
} from "./competition-player-stat-display";
import { isJunkPlayerName, normalizePlayerName } from "./entity-normalize";
import {
  ESTIMATOR_PROVIDER,
  RWC_ESTIMATION_SEASON_NOTE,
} from "./rwc-historical-stat-estimator";

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
  }>;
  season: { id: string; label: string; year: number; isActive: boolean } | null;
  hemisphereFilter: HemisphereFilter;
  supportsHemisphereFilter: boolean;
  boards: CompetitionLeaderboardBoard[];
  additionalBoards: CompetitionLeaderboardBoard[];
  coverage: {
    playerCount: number;
    rowCount: number;
  };
  /** Present when advanced boards include AI algorithm estimates for this season. */
  estimationNote: string | null;
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
  /** Internal merge state — stripped before boards are built. */
  _scoring?: {
    wikiPoints: number;
    wikiTries: number;
    sdmsPoints: number;
    sdmsTries: number;
    matchPoints: number;
    matchTries: number;
  };
  _advanced?: {
    confirmed: Partial<Record<LeaderboardMetric, number>>;
    estimated: Partial<Record<LeaderboardMetric, number>>;
  };
};

const AUTHORITATIVE_PROVIDERS = new Set([
  "sdms",
  "opta_published_leaderboard",
  "wikipedia_statistics",
]);

const ADVANCED_METRICS = [
  "tacklesCompleted",
  "metresCarried",
  "carries",
  "tryAssists",
  "defendersBeaten",
  "lineBreaks",
  "turnoversWon",
  "dominantTackles",
  "postContactMetres",
] as const satisfies readonly LeaderboardMetric[];

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
    | "hemisphere"
    | "_scoring"
    | "_advanced"
  > & { hemisphere: "northern" | "southern" | null },
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
    _scoring: {
      wikiPoints: 0,
      wikiTries: 0,
      sdmsPoints: 0,
      sdmsTries: 0,
      matchPoints: 0,
      matchTries: 0,
    },
    _advanced: { confirmed: {}, estimated: {} },
  };
}

function advancedMetricValue(row: {
  tacklesCompleted: number | null;
  metresCarried: number | null;
  carries: number | null;
  tryAssists: number | null;
  defendersBeaten: number | null;
  lineBreaks: number | null;
  turnoversWon: number | null;
  dominantTackles: number | null;
  postContactMetres: number | null;
}, metric: (typeof ADVANCED_METRICS)[number]): number {
  return row[metric] ?? 0;
}

function metricValue(row: AggregatedPlayer, metric: LeaderboardMetric): number {
  return row[metric] ?? 0;
}

function rankBoard(
  rows: AggregatedPlayer[],
  metric: LeaderboardMetric,
  label: string,
  limit: number,
): CompetitionLeaderboardBoard {
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

async function resolveSeasonForCompetition(
  competitionId: string,
  seasonLabel?: string,
) {
  const seasons = await listSeasonsForPicker(competitionId);
  const active = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
  if (!seasonLabel?.trim()) return { seasons, season: active };

  const requested = seasonLabel.trim();
  const requestedYear = parseSeasonStartYear(requested);
  const match =
    seasons.find((s) => s.label === requested) ??
    seasons.find((s) => s.label.replace(/–/g, "-") === requested.replace(/–/g, "-")) ??
    (requestedYear != null ? seasons.find((s) => s.year === requestedYear) : null) ??
    null;
  return { seasons, season: match };
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

  if (usesDomesticSeasonCatalog(competition.competitionType)) {
    await syncDomesticSeasonCatalog(competition.id);
  }

  const { seasons, season: resolvedSeason } = await resolveSeasonForCompetition(
    competition.id,
    options.seasonLabel,
  );

  // Future "active" RWC seasons (e.g. 2027) have empty boards and wipe the UI after load.
  // Prefer a completed tournament unless the caller asked for a specific season.
  let season = resolvedSeason;
  if (!options.seasonLabel?.trim() && competition.slug === "rugby-world-cup") {
    const nowYear = new Date().getFullYear();
    season =
      seasons.find((s) => s.year === 1987) ??
      seasons.find((s) => s.isActive && (s.year ?? 0) <= nowYear) ??
      [...seasons]
        .filter((s) => (s.year ?? 0) > 0 && (s.year ?? 0) <= nowYear)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ??
      resolvedSeason;
  }
  const supportsHemisphereFilter = isNationsChampionshipSlug(competition.slug);
  const hemisphereFilter: HemisphereFilter =
    supportsHemisphereFilter && options.hemisphere
      ? options.hemisphere
      : "all";
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);

  if (!season) {
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
      boards: PRIMARY_BOARDS.map((b) => ({
        ...b,
        valueLabel: LEADERBOARD_VALUE_LABELS[b.metric] ?? "VAL",
        entries: [],
      })),
      additionalBoards: ADDITIONAL_BOARDS.map((b) => ({
        ...b,
        valueLabel: LEADERBOARD_VALUE_LABELS[b.metric] ?? "VAL",
        entries: [],
      })),
      coverage: { playerCount: 0, rowCount: 0 },
      estimationNote: null,
    };
  }

  const db = getDb();
  const selectCols = {
    playerId: playerMatchPerformanceStats.playerId,
    playerName: players.name,
    playerSlug: players.slug,
    playerImageUrl: players.imageUrl,
    teamId: playerMatchPerformanceStats.teamId,
    teamName: teams.name,
    teamSlug: teams.slug,
    teamShortName: teams.shortName,
    teamImageUrl: teams.imageUrl,
    sourceProvider: playerMatchPerformanceStats.sourceProvider,
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
  };

  const rows = await db
    .select(selectCols)
    .from(playerMatchPerformanceStats)
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .innerJoin(teams, eq(playerMatchPerformanceStats.teamId, teams.id))
    .where(
      and(
        eq(playerMatchPerformanceStats.competitionId, competition.id),
        eq(playerMatchPerformanceStats.seasonId, season.id),
      ),
    )
    .orderBy(desc(playerMatchPerformanceStats.syncedAt));

  // Also include rows linked via competition only (season null) for partial imports.
  const fallbackRows =
    rows.length > 0
      ? []
      : await db
          .select(selectCols)
          .from(playerMatchPerformanceStats)
          .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
          .innerJoin(teams, eq(playerMatchPerformanceStats.teamId, teams.id))
          .where(eq(playerMatchPerformanceStats.competitionId, competition.id));

  const sourceRows = rows.length > 0 ? rows : fallbackRows;

  const [estimateHit] = await db
    .select({ id: playerMatchPerformanceStats.id })
    .from(playerMatchPerformanceStats)
    .where(
      and(
        eq(playerMatchPerformanceStats.competitionId, competition.id),
        eq(playerMatchPerformanceStats.seasonId, season.id),
        eq(playerMatchPerformanceStats.sourceProvider, ESTIMATOR_PROVIDER),
      ),
    )
    .limit(1);

  const buckets = new Map<string, AggregatedPlayer>();

  for (const row of sourceRows) {
    if (isJunkPlayerName(row.playerName)) continue;
    const displayName = normalizePlayerName(row.playerName) || row.playerName;

    const key = `${row.playerId}:${row.teamId}`;
    const existing =
      buckets.get(key) ??
      emptyAgg({
        playerId: row.playerId,
        playerName: displayName,
        playerSlug: row.playerSlug,
        playerImageUrl: row.playerImageUrl,
        teamId: row.teamId,
        teamName: row.teamName,
        teamSlug: row.teamSlug,
        teamShortName: row.teamShortName,
        teamImageUrl: row.teamImageUrl,
        hemisphere: nationsChampionshipHemisphereForTeam(row.teamName),
      });

    const provider = row.sourceProvider ?? "";
    const isWiki = provider === "wikipedia_statistics";
    const isAuthoritative = AUTHORITATIVE_PROVIDERS.has(provider);
    const isEstimate = provider === ESTIMATOR_PROVIDER;

    // Appearances / minutes: count match-level rows only (skip seed fixtures providers).
    if (!isWiki && provider !== "opta_published_leaderboard") {
      existing.appearances += 1;
      existing.minutesPlayed += row.minutesPlayed ?? 0;
    }

    const scoring = existing._scoring!;
    if (isWiki) {
      scoring.wikiPoints += row.points ?? 0;
      scoring.wikiTries += row.tries ?? 0;
    } else if (provider === "sdms") {
      // Prefer SDMS scoring alone — never sum with fixture_players twins.
      scoring.sdmsPoints += row.points ?? 0;
      scoring.sdmsTries += row.tries ?? 0;
    } else if (!isAuthoritative) {
      // Match-level rows (estimates / fixture_players / scoring_events).
      scoring.matchPoints += row.points ?? 0;
      scoring.matchTries += row.tries ?? 0;
    }

    const advanced = existing._advanced!;
    for (const metric of ADVANCED_METRICS) {
      const value = advancedMetricValue(row, metric);
      if (value <= 0) continue;
      if (isAuthoritative) {
        // Opta / SDMS / Wikipedia confirmed advanced — prefer over estimates.
        // Season-seed rows are tournament totals (take max); match SDMS rows sum.
        if (isWiki || provider === "opta_published_leaderboard") {
          advanced.confirmed[metric] = Math.max(advanced.confirmed[metric] ?? 0, value);
        } else {
          advanced.confirmed[metric] = (advanced.confirmed[metric] ?? 0) + value;
        }
      } else if (
        isEstimate ||
        provider === "fixture_players" ||
        provider === "scoring_events"
      ) {
        advanced.estimated[metric] = (advanced.estimated[metric] ?? 0) + value;
      }
    }

    buckets.set(key, existing);
  }

  let aggregated = [...buckets.values()].map((row) => {
    const scoring = row._scoring!;
    const advanced = row._advanced!;
    // Prefer Wikipedia season totals, then SDMS match sums, then other match rows.
    // Never combine SDMS + fixture_players (duplicate fixtures inflate scores).
    row.points =
      scoring.wikiPoints > 0
        ? scoring.wikiPoints
        : scoring.sdmsPoints > 0
          ? scoring.sdmsPoints
          : scoring.matchPoints;
    row.tries =
      scoring.wikiTries > 0
        ? scoring.wikiTries
        : scoring.sdmsTries > 0
          ? scoring.sdmsTries
          : scoring.matchTries;
    for (const metric of ADVANCED_METRICS) {
      const confirmed = advanced.confirmed[metric] ?? 0;
      const estimated = advanced.estimated[metric] ?? 0;
      row[metric] = confirmed > 0 ? confirmed : estimated;
    }
    delete row._scoring;
    delete row._advanced;
    return row;
  });
  if (supportsHemisphereFilter && hemisphereFilter !== "all") {
    aggregated = aggregated.filter((row) => row.hemisphere === hemisphereFilter);
  }

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
      rowCount: sourceRows.length,
    },
    estimationNote: estimateHit ? RWC_ESTIMATION_SEASON_NOTE : null,
  };
}
