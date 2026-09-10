import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  fixtures,
  matchEvents,
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
  RUGBY_CHAMPIONSHIP_FIRST_YEAR,
  TRI_NATIONS_FIRST_YEAR,
} from "./rugby-championship-lineage";
import { pickDefaultSeasonForPicker } from "./season-list-utils";
import {
  currentDomesticSeasonStartYear,
  parseSeasonStartYear,
  sanitizeSeasonQueryParam,
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
import { isJunkPlayerName } from "./entity-normalize";
import {
  eventPayloadPlayerName,
  matchScorerToCandidates,
  type ScorerCandidate,
} from "./event-scorer-match";
import {
  aggregatesHaveScoring,
  collapseDuplicateLeaderboardPlayers,
  mergeEventScoringIntoRows,
} from "./event-scoring-leaderboard";
import { leaderboardEmptyMessage } from "./competition-player-leaderboards-math";
import { pointsForScoringEventType } from "./match-event-scores";

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
    emptyMessage: leaderboardEmptyMessage({ hasTrackedData, playerCount: rows.length }),
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
  if (isRugbyChampionshipLineageSlug(slug)) {
    return seasons.filter((season) => isRugbyChampionshipPickerYear(season.year));
  }
  return seasons;
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
      label: String(year),
      seasonKind: "international",
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

  const requested = sanitizeSeasonQueryParam(seasonLabel);
  if (!requested) {
    const withStats = await seasonIdsWithPlayerStats(competitionId);
    const latestWithStats =
      seasons.find((season) => withStats.has(season.id)) ?? null;
    const fallback = pickDefaultSeasonForPicker(seasons) ?? seasons[0] ?? null;
    return { seasons, season: latestWithStats ?? fallback };
  }
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

  return rows
    .filter((row) => !isJunkPlayerName(row.playerName))
    .map((row) => ({
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
    if (isJunkPlayerName(row.playerName)) continue;
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

const SCORING_EVENT_TYPES = ["try", "conversion", "penalty", "penalty_goal", "drop_goal"] as const;

type EventScorerIdentity = {
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerImageUrl: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamShortName: string | null;
  teamImageUrl: string | null;
};

async function loadInternationalSquadCandidates(teamIds: string[]): Promise<Map<string, ScorerCandidate[]>> {
  const byTeam = new Map<string, ScorerCandidate[]>();
  if (teamIds.length === 0) return byTeam;
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      teamId: players.internationalTeamId,
    })
    .from(players)
    .where(inArray(players.internationalTeamId, teamIds));

  for (const row of rows) {
    if (!row.teamId) continue;
    const list = byTeam.get(row.teamId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      imageUrl: row.imageUrl,
    });
    byTeam.set(row.teamId, list);
  }
  return byTeam;
}

async function loadEventScoringAggregates(
  competitionId: string,
  seasonId: string,
): Promise<{ players: AggregatedPlayer[]; scoringEventCount: number }> {
  const db = getDb();
  const rows = await db
    .select({
      eventType: matchEvents.eventType,
      playerId: matchEvents.playerId,
      teamId: matchEvents.teamId,
      payload: matchEvents.payload,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
      teamImageUrl: teams.imageUrl,
      linkedPlayerName: players.name,
      linkedPlayerSlug: players.slug,
      linkedPlayerImageUrl: players.imageUrl,
    })
    .from(matchEvents)
    .innerJoin(fixtures, eq(matchEvents.fixtureId, fixtures.id))
    .leftJoin(teams, eq(matchEvents.teamId, teams.id))
    .leftJoin(players, eq(matchEvents.playerId, players.id))
    .where(
      and(
        eq(fixtures.competitionId, competitionId),
        eq(fixtures.seasonId, seasonId),
        inArray(matchEvents.eventType, [...SCORING_EVENT_TYPES]),
      ),
    );

  const teamIds = [
    ...new Set(rows.map((row) => row.teamId).filter((id): id is string => Boolean(id))),
  ];
  const candidatesByTeam = await loadInternationalSquadCandidates(teamIds);

  const identityByKey = new Map<string, EventScorerIdentity>();
  const totals = new Map<string, { tries: number; points: number }>();

  for (const row of rows) {
    if (!row.teamId || !row.teamName) continue;
    const points = pointsForScoringEventType(row.eventType);
    if (points <= 0) continue;
    const tries = row.eventType === "try" ? 1 : 0;
    const payloadName = eventPayloadPlayerName(row.payload);
    const teamCandidates = candidatesByTeam.get(row.teamId) ?? [];
    const matched =
      matchScorerToCandidates(payloadName ?? "", teamCandidates) ??
      matchScorerToCandidates(row.linkedPlayerName ?? "", teamCandidates);

    let identity: EventScorerIdentity | null = null;
    if (matched) {
      identity = {
        playerId: matched.id,
        playerName: matched.name,
        playerSlug: matched.slug,
        playerImageUrl: matched.imageUrl,
        teamId: row.teamId,
        teamName: row.teamName,
        teamSlug: row.teamSlug ?? "",
        teamShortName: row.teamShortName,
        teamImageUrl: row.teamImageUrl,
      };
    } else if (row.playerId && row.linkedPlayerName && row.linkedPlayerSlug) {
      identity = {
        playerId: row.playerId,
        playerName: row.linkedPlayerName,
        playerSlug: row.linkedPlayerSlug,
        playerImageUrl: row.linkedPlayerImageUrl,
        teamId: row.teamId,
        teamName: row.teamName,
        teamSlug: row.teamSlug ?? "",
        teamShortName: row.teamShortName,
        teamImageUrl: row.teamImageUrl,
      };
    }

    if (!identity) continue;
    const key = `${identity.playerId}:${identity.teamId}`;
    identityByKey.set(key, identity);
    const current = totals.get(key) ?? { tries: 0, points: 0 };
    current.tries += tries;
    current.points += points;
    totals.set(key, current);
  }

  const playersOut: AggregatedPlayer[] = [];
  for (const [key, identity] of identityByKey) {
    const score = totals.get(key);
    if (!score || (score.tries <= 0 && score.points <= 0)) continue;
    const row = emptyAgg({
      ...identity,
      hemisphere: nationsChampionshipHemisphereForTeam(identity.teamName),
    });
    row.tries = score.tries;
    row.points = score.points;
    playersOut.push(row);
  }

  return { players: playersOut, scoringEventCount: rows.length };
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

  const seasonAgg = await loadSeasonStatAggregates(competition.id, season.id);
  const matchAgg = await loadMatchStatAggregates(competition.id, season.id);

  let aggregated: AggregatedPlayer[] = [];
  let rowCount = 0;
  let source: CompetitionPlayerStatsPayload["coverage"]["source"] = "none";

  if (seasonAgg.length > 0) {
    aggregated = seasonAgg;
    rowCount = seasonAgg.length;
    source = "season_stats";
  }
  if (matchAgg.players.length > 0) {
    aggregated = aggregated.length
      ? mergeEventScoringIntoRows(matchAgg.players, aggregated)
      : matchAgg.players;
    rowCount = Math.max(rowCount, matchAgg.rowCount);
    if (source === "none") source = "match_stats";
  }

  if (!aggregatesHaveScoring(aggregated)) {
    const eventAgg = await loadEventScoringAggregates(competition.id, season.id);
    if (eventAgg.players.length > 0) {
      aggregated = mergeEventScoringIntoRows(aggregated, eventAgg.players);
      if (source === "none") {
        source = "match_stats";
        rowCount = eventAgg.scoringEventCount;
      } else {
        rowCount = Math.max(rowCount, aggregated.length);
      }
    }
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
  aggregated = collapseDuplicateLeaderboardPlayers(aggregated);

  return {
    competition: {
      id: competition.id,
      slug: competition.slug,
      name: seasonEra ?? competition.name,
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
