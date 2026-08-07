import "server-only";
import { and, desc, eq, ilike } from "drizzle-orm";
import {
  attackScore,
  buildMatchPerformanceImportKey,
  defenceScore,
  parseMatchPlayerPerformance,
  type ParsedPlayerMatchPerformance,
} from "@rugby365/import-sdk";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerSeasonStats,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { resolveFixtureSeasonLabel } from "./fixture-season-utils";
import { perMinuteRate } from "@rugby365/import-sdk";
import {
  buildSeasonStatsFilterOptions,
  competitionFilterMatches,
  seasonFilterMatches,
  type SeasonStatsFilterOptions,
} from "./player-season-stats-filters";

export type { SeasonStatsFilterOptions };
export {
  buildSeasonStatsFilterOptions,
  competitionFilterMatches,
  seasonFilterMatches,
} from "./player-season-stats-filters";

export type PerformanceStatFields = {
  appearances: number;
  minutesPlayed: number;
  tries: number;
  points: number;
  carries: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  tryAssists: number;
  lineBreaks: number;
  defendersBeaten: number;
  touches: number;
  postContactMetres: number;
  ruckArrivalEffectiveness: number;
};

export type PlayerSeasonStatsRow = PerformanceStatFields & {
  id: string;
  playerId: string;
  seasonId: string;
  seasonLabel: string;
  competitionId: string;
  competitionName: string;
  teamId: string;
  teamName: string;
  attackRank: number | null;
  defenceRank: number | null;
  carriesPerMinute: number | null;
  tacklesPerMinute: number | null;
  averages: PerformanceStatFields;
};

export type PlayerMatchStatsRow = PerformanceStatFields & {
  id: string;
  fixtureId: string;
  fixtureSlug: string;
  kickoffAt: string | null;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  opponentName: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  competitionId: string | null;
  competitionName: string | null;
  attackRank: number | null;
  defenceRank: number | null;
  carriesPerMinute: number | null;
  tacklesPerMinute: number | null;
  syncedAt: string;
};

export type PlayerMatchStatsFilters = {
  seasonId?: string;
  competitionId?: string;
  teamId?: string;
};

export type TeamSeasonStatsRow = PlayerSeasonStatsRow & {
  playerName: string;
  playerSlug: string;
};

export type TeamSeasonStatsFilters = {
  seasonId?: string;
  competitionId?: string;
  search?: string;
  sortBy?: "playerName" | "tries" | "carries" | "tacklesCompleted" | "points" | "metresCarried";
  sortDir?: "asc" | "desc";
};

function averageStatFields(rows: PerformanceStatFields[]): PerformanceStatFields {
  if (rows.length === 0) {
    return {
      appearances: 0,
      minutesPlayed: 0,
      tries: 0,
      points: 0,
      carries: 0,
      metresCarried: 0,
      tacklesMade: 0,
      tacklesCompleted: 0,
      dominantTackles: 0,
      turnoversWon: 0,
      tryAssists: 0,
      lineBreaks: 0,
      defendersBeaten: 0,
      touches: 0,
      postContactMetres: 0,
      ruckArrivalEffectiveness: 0,
    };
  }
  const totals = rows.reduce(
    (acc, row) => {
      acc.appearances += row.appearances;
      acc.minutesPlayed += row.minutesPlayed;
      acc.tries += row.tries;
      acc.points += row.points;
      acc.carries += row.carries;
      acc.metresCarried += row.metresCarried;
      acc.tacklesMade += row.tacklesMade;
      acc.tacklesCompleted += row.tacklesCompleted;
      acc.dominantTackles += row.dominantTackles;
      acc.turnoversWon += row.turnoversWon;
      acc.tryAssists += row.tryAssists;
      acc.lineBreaks += row.lineBreaks;
      acc.defendersBeaten += row.defendersBeaten;
      acc.touches += row.touches;
      acc.postContactMetres += row.postContactMetres;
      acc.ruckArrivalEffectiveness += row.ruckArrivalEffectiveness;
      return acc;
    },
    {
      appearances: 0,
      minutesPlayed: 0,
      tries: 0,
      points: 0,
      carries: 0,
      metresCarried: 0,
      tacklesMade: 0,
      tacklesCompleted: 0,
      dominantTackles: 0,
      turnoversWon: 0,
      tryAssists: 0,
      lineBreaks: 0,
      defendersBeaten: 0,
      touches: 0,
      postContactMetres: 0,
      ruckArrivalEffectiveness: 0,
    },
  );
  const count = rows.length;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    appearances: round(totals.appearances / count),
    minutesPlayed: round(totals.minutesPlayed / count),
    tries: round(totals.tries / count),
    points: round(totals.points / count),
    carries: round(totals.carries / count),
    metresCarried: round(totals.metresCarried / count),
    tacklesMade: round(totals.tacklesMade / count),
    tacklesCompleted: round(totals.tacklesCompleted / count),
    dominantTackles: round(totals.dominantTackles / count),
    turnoversWon: round(totals.turnoversWon / count),
    tryAssists: round(totals.tryAssists / count),
    lineBreaks: round(totals.lineBreaks / count),
    defendersBeaten: round(totals.defendersBeaten / count),
    touches: round(totals.touches / count),
    postContactMetres: round(totals.postContactMetres / count),
    ruckArrivalEffectiveness: round(totals.ruckArrivalEffectiveness / count),
  };
}

function sumStatFields(rows: PerformanceStatFields[]): PerformanceStatFields {
  return rows.reduce(
    (acc, row) => ({
      appearances: acc.appearances + row.appearances,
      minutesPlayed: acc.minutesPlayed + row.minutesPlayed,
      tries: acc.tries + row.tries,
      points: acc.points + row.points,
      carries: acc.carries + row.carries,
      metresCarried: acc.metresCarried + row.metresCarried,
      tacklesMade: acc.tacklesMade + row.tacklesMade,
      tacklesCompleted: acc.tacklesCompleted + row.tacklesCompleted,
      dominantTackles: acc.dominantTackles + row.dominantTackles,
      turnoversWon: acc.turnoversWon + row.turnoversWon,
      tryAssists: acc.tryAssists + row.tryAssists,
      lineBreaks: acc.lineBreaks + row.lineBreaks,
      defendersBeaten: acc.defendersBeaten + row.defendersBeaten,
      touches: acc.touches + row.touches,
      postContactMetres: acc.postContactMetres + row.postContactMetres,
      ruckArrivalEffectiveness: acc.ruckArrivalEffectiveness + row.ruckArrivalEffectiveness,
    }),
    {
      appearances: 0,
      minutesPlayed: 0,
      tries: 0,
      points: 0,
      carries: 0,
      metresCarried: 0,
      tacklesMade: 0,
      tacklesCompleted: 0,
      dominantTackles: 0,
      turnoversWon: 0,
      tryAssists: 0,
      lineBreaks: 0,
      defendersBeaten: 0,
      touches: 0,
      postContactMetres: 0,
      ruckArrivalEffectiveness: 0,
    },
  );
}

function mapMatchPerformanceRow(input: {
  stat: typeof playerMatchPerformanceStats.$inferSelect;
  fixtureSlug: string;
  kickoffAt: Date | null;
  playerName: string;
  teamName: string;
  opponentName: string | null;
  seasonLabel: string | null;
  competitionName: string | null;
}): PlayerMatchStatsRow {
  const { stat } = input;
  const fields = toStatFields({ ...stat, appearances: 1 });
  return {
    id: stat.id,
    fixtureId: stat.fixtureId,
    fixtureSlug: input.fixtureSlug,
    kickoffAt: input.kickoffAt?.toISOString() ?? null,
    playerId: stat.playerId,
    playerName: input.playerName,
    teamId: stat.teamId,
    teamName: input.teamName,
    opponentName: input.opponentName,
    seasonId: stat.seasonId,
    seasonLabel: input.seasonLabel,
    competitionId: stat.competitionId,
    competitionName: input.competitionName,
    attackRank: null,
    defenceRank: null,
    carriesPerMinute: perMinuteRate(stat.carries, stat.minutesPlayed),
    tacklesPerMinute: perMinuteRate(stat.tacklesCompleted, stat.minutesPlayed),
    syncedAt: stat.syncedAt.toISOString(),
    ...fields,
  };
}

function aggregateSeasonRowsFromMatchStats(matchRows: PlayerMatchStatsRow[]): PlayerSeasonStatsRow[] {
  const buckets = new Map<string, PlayerMatchStatsRow[]>();
  for (const row of matchRows) {
    if (!row.seasonId || !row.competitionId || !row.seasonLabel || !row.competitionName) continue;
    const key = `${row.seasonId}:${row.competitionId}:${row.teamId}:${row.playerId}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, rows]) => {
      const first = rows[0]!;
      const statFields = sumStatFields(rows);
      const averages = averageStatFields(rows);
      return {
        id: key,
        playerId: first.playerId,
        seasonId: first.seasonId!,
        seasonLabel: first.seasonLabel!,
        competitionId: first.competitionId!,
        competitionName: first.competitionName!,
        teamId: first.teamId,
        teamName: first.teamName,
        attackRank: null,
        defenceRank: null,
        carriesPerMinute: perMinuteRate(statFields.carries, statFields.minutesPlayed),
        tacklesPerMinute: perMinuteRate(statFields.tacklesCompleted, statFields.minutesPlayed),
        averages,
        ...statFields,
      };
    })
    .sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel));
}

function applySeasonPerformanceRanks(rows: PlayerSeasonStatsRow[]): PlayerSeasonStatsRow[] {
  const groups = new Map<string, PlayerSeasonStatsRow[]>();
  for (const row of rows) {
    const key = `${row.seasonId}:${row.competitionId}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const rankById = new Map<string, { attackRank: number | null; defenceRank: number | null }>();
  for (const groupRows of groups.values()) {
    const attackSorted = [...groupRows]
      .map((row) => ({
        id: row.id,
        score: attackScore(row),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    const defenceSorted = [...groupRows]
      .map((row) => ({
        id: row.id,
        score: defenceScore(row),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const [index, row] of attackSorted.entries()) {
      rankById.set(row.id, { attackRank: index + 1, defenceRank: rankById.get(row.id)?.defenceRank ?? null });
    }
    for (const [index, row] of defenceSorted.entries()) {
      const existing = rankById.get(row.id) ?? { attackRank: null, defenceRank: null };
      rankById.set(row.id, { ...existing, defenceRank: index + 1 });
    }
  }

  return rows.map((row) => {
    const ranks = rankById.get(row.id);
    return ranks ? { ...row, ...ranks } : row;
  });
}

async function queryPlayerMatchStatsRows(filters: {
  playerId?: string;
  teamId?: string;
  fixtureId?: string;
  seasonId?: string;
  competitionId?: string;
}) {
  const db = getDb();
  const conditions = [];
  if (filters.playerId) conditions.push(eq(playerMatchPerformanceStats.playerId, filters.playerId));
  if (filters.teamId) conditions.push(eq(playerMatchPerformanceStats.teamId, filters.teamId));
  if (filters.fixtureId) conditions.push(eq(playerMatchPerformanceStats.fixtureId, filters.fixtureId));
  if (filters.seasonId) conditions.push(eq(playerMatchPerformanceStats.seasonId, filters.seasonId));
  if (filters.competitionId) {
    conditions.push(eq(playerMatchPerformanceStats.competitionId, filters.competitionId));
  }

  const rows = await db
    .select({
      stat: playerMatchPerformanceStats,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      playerName: players.name,
      teamName: teams.name,
      seasonLabel: competitionSeasons.label,
      competitionName: competitions.name,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(fixtures, eq(playerMatchPerformanceStats.fixtureId, fixtures.id))
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .innerJoin(teams, eq(playerMatchPerformanceStats.teamId, teams.id))
    .leftJoin(competitionSeasons, eq(playerMatchPerformanceStats.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(playerMatchPerformanceStats.competitionId, competitions.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(fixtures.kickoffAt));

  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamNameById = new Map(allTeams.map((team) => [team.id, team.name]));

  return rows.map(({ stat, fixtureSlug, kickoffAt, homeTeamId, awayTeamId, playerName, teamName, seasonLabel, competitionName }) => {
    const opponentId = stat.teamId === homeTeamId ? awayTeamId : homeTeamId;
    return mapMatchPerformanceRow({
      stat,
      fixtureSlug,
      kickoffAt,
      playerName,
      teamName,
      opponentName: opponentId ? (teamNameById.get(opponentId) ?? null) : null,
      seasonLabel,
      competitionName,
    });
  });
}

export function filterPlayerSeasonStatsRows(
  rows: PlayerSeasonStatsRow[],
  filters: Pick<TeamSeasonStatsFilters, "seasonId" | "competitionId">,
  options: Partial<SeasonStatsFilterOptions> = {},
): PlayerSeasonStatsRow[] {
  const seasonOptions = options.seasons ?? [];
  const competitionOptions = options.competitions ?? [];
  return rows.filter((row) => {
    if (!seasonFilterMatches(row.seasonId, filters.seasonId, seasonOptions)) return false;
    if (
      !competitionFilterMatches(row.competitionId, filters.competitionId, competitionOptions)
    ) {
      return false;
    }
    return true;
  });
}

function sortTeamSeasonStatsRows(rows: TeamSeasonStatsRow[], filters: TeamSeasonStatsFilters) {
  const sortBy = filters.sortBy ?? "playerName";
  const dir = filters.sortDir ?? "asc";
  return [...rows].sort((a, b) => {
    let left: string | number = a.playerName;
    let right: string | number = b.playerName;
    if (sortBy !== "playerName") {
      left = a[sortBy];
      right = b[sortBy];
    }
    if (left === right) return 0;
    if (typeof left === "number" && typeof right === "number") {
      return dir === "asc" ? left - right : right - left;
    }
    return dir === "asc"
      ? String(left).localeCompare(String(right))
      : String(right).localeCompare(String(left));
  });
}

function toStatFields(row: {
  appearances?: number;
  minutesPlayed: number;
  tries: number;
  points: number;
  carries: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  tryAssists: number;
  lineBreaks: number;
  defendersBeaten: number;
  touches: number;
  postContactMetres: number;
  ruckArrivalEffectiveness: number;
}): PerformanceStatFields {
  return {
    appearances: row.appearances ?? 1,
    minutesPlayed: row.minutesPlayed,
    tries: row.tries,
    points: row.points,
    carries: row.carries,
    metresCarried: row.metresCarried,
    tacklesMade: row.tacklesMade,
    tacklesCompleted: row.tacklesCompleted,
    dominantTackles: row.dominantTackles,
    turnoversWon: row.turnoversWon,
    tryAssists: row.tryAssists,
    lineBreaks: row.lineBreaks,
    defendersBeaten: row.defendersBeaten,
    touches: row.touches,
    postContactMetres: row.postContactMetres,
    ruckArrivalEffectiveness: row.ruckArrivalEffectiveness,
  };
}

export async function upsertMatchPerformanceStat(input: {
  fixtureId: string;
  playerId: string;
  teamId: string;
  seasonId?: string | null;
  competitionId?: string | null;
  externalMatchId: string;
  externalPlayerId: string;
  stats: ParsedPlayerMatchPerformance & {
    tries?: number;
    points?: number;
    /** True when minutes/stats were inferred because SDMS omitted the player. */
    gapFilled?: boolean;
  };
  sourceProvider?: string;
  /** Skip OpenAI bio refresh (bulk historical imports). */
  skipBioRefresh?: boolean;
}) {
  const db = getDb();
  const importKey = buildMatchPerformanceImportKey(input.externalMatchId, input.externalPlayerId);
  const values = {
    fixtureId: input.fixtureId,
    playerId: input.playerId,
    teamId: input.teamId,
    seasonId: input.seasonId ?? null,
    competitionId: input.competitionId ?? null,
    externalMatchId: input.externalMatchId,
    externalPlayerId: input.externalPlayerId,
    minutesPlayed: input.stats.minutesPlayed,
    tries: input.stats.tries ?? 0,
    points: input.stats.points ?? 0,
    carries: input.stats.carries,
    metresCarried: input.stats.metresCarried,
    tacklesMade: input.stats.tacklesMade,
    tacklesCompleted: input.stats.tacklesCompleted,
    dominantTackles: input.stats.dominantTackles,
    turnoversWon: input.stats.turnoversWon,
    tryAssists: input.stats.tryAssists,
    lineBreaks: input.stats.lineBreaks,
    defendersBeaten: input.stats.defendersBeaten,
    touches: input.stats.touches,
    postContactMetres: input.stats.postContactMetres,
    ruckArrivalEffectiveness: input.stats.ruckArrivalEffectiveness,
    extras: {
      passes: input.stats.passes,
      offloads: input.stats.offloads,
      missedTackles: input.stats.missedTackles,
      kicks: input.stats.kicks,
      kicksFromHand: input.stats.kicksFromHand,
      kickFromHandMetres: input.stats.kickFromHandMetres,
      kickPossessionRetained: input.stats.kickPossessionRetained,
      badPasses: input.stats.badPasses,
      droppedCatch: input.stats.droppedCatch,
      handlingError: input.stats.handlingError,
      turnoversConceded: input.stats.turnoversConceded,
      runs: input.stats.runs,
      gainLine: input.stats.gainLine,
      carriesMetres: input.stats.carriesMetres,
      carriesCrossedGainLine: input.stats.carriesCrossedGainLine,
      carriesNotMadeGainLine: input.stats.carriesNotMadeGainLine,
      ...(input.stats.gapFilled ? { gapFilled: true, statsEstimated: true } : {}),
    },
    sourceProvider: input.sourceProvider ?? "sdms",
    importKey,
    syncedAt: new Date(),
  };

  const [byFixturePlayer] = await db
    .select({ id: playerMatchPerformanceStats.id })
    .from(playerMatchPerformanceStats)
    .where(
      and(
        eq(playerMatchPerformanceStats.fixtureId, input.fixtureId),
        eq(playerMatchPerformanceStats.playerId, input.playerId),
      ),
    )
    .limit(1);

  if (byFixturePlayer) {
    // Keep existing import_key when another row already owns this key (duplicate fixtures).
    const [keyOwner] = await db
      .select({ id: playerMatchPerformanceStats.id })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.importKey, importKey))
      .limit(1);
    const { importKey: _nextKey, ...withoutKey } = values;
    const patch = keyOwner && keyOwner.id !== byFixturePlayer.id ? withoutKey : values;
    const [updated] = await db
      .update(playerMatchPerformanceStats)
      .set(patch)
      .where(eq(playerMatchPerformanceStats.id, byFixturePlayer.id))
      .returning();
    return { row: updated!, created: false };
  }

  const [existing] = await db
    .select({ id: playerMatchPerformanceStats.id })
    .from(playerMatchPerformanceStats)
    .where(eq(playerMatchPerformanceStats.importKey, importKey))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(playerMatchPerformanceStats)
      .set(values)
      .where(eq(playerMatchPerformanceStats.id, existing.id))
      .returning();
    return { row: updated!, created: false };
  }

  try {
    const [created] = await db.insert(playerMatchPerformanceStats).values(values).returning();
    const result = { row: created!, created: true };

    if (!input.skipBioRefresh) {
      const { triggerPlayerBioRefresh } = await import("./player-bio-trigger");
      void triggerPlayerBioRefresh({
        playerId: input.playerId,
        trigger: "match_stats_imported",
      });
    }

    return result;
  } catch (error) {
    const code =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;
    const fallbackCode =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code !== "23505" && fallbackCode !== "23505") throw error;

    const [retry] = await db
      .select({ id: playerMatchPerformanceStats.id })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          eq(playerMatchPerformanceStats.fixtureId, input.fixtureId),
          eq(playerMatchPerformanceStats.playerId, input.playerId),
        ),
      )
      .limit(1);
    if (retry) {
      const { importKey: _nextKey, ...withoutKey } = values;
      const [updated] = await db
        .update(playerMatchPerformanceStats)
        .set(withoutKey)
        .where(eq(playerMatchPerformanceStats.id, retry.id))
        .returning();
      return { row: updated!, created: false };
    }
    const [byKey] = await db
      .select({ id: playerMatchPerformanceStats.id })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.importKey, importKey))
      .limit(1);
    if (!byKey) throw error;
    const [updated] = await db
      .update(playerMatchPerformanceStats)
      .set(values)
      .where(eq(playerMatchPerformanceStats.id, byKey.id))
      .returning();
    return { row: updated!, created: false };
  }
}

export async function aggregatePlayerSeasonStats(input: {
  playerId: string;
  seasonId: string;
  teamId: string;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerMatchPerformanceStats)
    .where(
      and(
        eq(playerMatchPerformanceStats.playerId, input.playerId),
        eq(playerMatchPerformanceStats.seasonId, input.seasonId),
        eq(playerMatchPerformanceStats.teamId, input.teamId),
      ),
    );

  const totals = rows.reduce(
    (acc, row) => {
      acc.appearances += 1;
      acc.minutesPlayed += row.minutesPlayed;
      acc.tries += row.tries;
      acc.points += row.points;
      acc.carries += row.carries;
      acc.metresCarried += row.metresCarried;
      acc.tacklesMade += row.tacklesMade;
      acc.tacklesCompleted += row.tacklesCompleted;
      acc.dominantTackles += row.dominantTackles;
      acc.turnoversWon += row.turnoversWon;
      acc.tryAssists += row.tryAssists;
      acc.lineBreaks += row.lineBreaks;
      acc.defendersBeaten += row.defendersBeaten;
      acc.touches += row.touches;
      acc.postContactMetres += row.postContactMetres;
      acc.ruckArrivalEffectiveness += row.ruckArrivalEffectiveness;
      return acc;
    },
    {
      appearances: 0,
      minutesPlayed: 0,
      tries: 0,
      points: 0,
      carries: 0,
      metresCarried: 0,
      tacklesMade: 0,
      tacklesCompleted: 0,
      dominantTackles: 0,
      turnoversWon: 0,
      tryAssists: 0,
      lineBreaks: 0,
      defendersBeaten: 0,
      touches: 0,
      postContactMetres: 0,
      ruckArrivalEffectiveness: 0,
    },
  );

  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, input.seasonId))
    .limit(1);
  if (!season) throw new Error("Season not found");

  const [existing] = await db
    .select({ id: playerSeasonStats.id })
    .from(playerSeasonStats)
    .where(
      and(
        eq(playerSeasonStats.playerId, input.playerId),
        eq(playerSeasonStats.seasonId, input.seasonId),
        eq(playerSeasonStats.teamId, input.teamId),
      ),
    )
    .limit(1);

  const values = {
    playerId: input.playerId,
    seasonId: input.seasonId,
    competitionId: season.competitionId,
    teamId: input.teamId,
    ...totals,
    sourceProvider: "sdms",
    syncedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(playerSeasonStats)
      .set(values)
      .where(eq(playerSeasonStats.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db.insert(playerSeasonStats).values(values).returning();
  return created!;
}

export async function recomputeSeasonPerformanceRanks(seasonId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.seasonId, seasonId));

  const attackSorted = [...rows]
    .map((row) => ({
      id: row.id,
      score: attackScore(toStatFields({ ...row, appearances: row.appearances })),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const defenceSorted = [...rows]
    .map((row) => ({
      id: row.id,
      score: defenceScore(toStatFields({ ...row, appearances: row.appearances })),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const [index, row] of attackSorted.entries()) {
    await db
      .update(playerSeasonStats)
      .set({ attackRank: index + 1 })
      .where(eq(playerSeasonStats.id, row.id));
  }
  for (const [index, row] of defenceSorted.entries()) {
    await db
      .update(playerSeasonStats)
      .set({ defenceRank: index + 1 })
      .where(eq(playerSeasonStats.id, row.id));
  }

  try {
    const { invalidateRadarCachesForSeason } = await import("./player-radar-service");
    await invalidateRadarCachesForSeason(seasonId);
  } catch {
    // Radar cache is optional — ranks still succeed
  }

  return { attackRanked: attackSorted.length, defenceRanked: defenceSorted.length };
}

export async function getPlayerMatchStatsHistory(playerId: string, filters: PlayerMatchStatsFilters = {}) {
  const stats = await queryPlayerMatchStatsRows({
    playerId,
    seasonId: filters.seasonId,
    competitionId: filters.competitionId,
    teamId: filters.teamId,
  });
  const filtered = filters.teamId ? stats.filter((row) => row.teamId === filters.teamId) : stats;
  const filterOptions = buildSeasonStatsFilterOptions(
    filtered
      .filter((row) => row.seasonId && row.competitionId && row.seasonLabel && row.competitionName)
      .map((row) => ({
        seasonId: row.seasonId!,
        seasonLabel: row.seasonLabel!,
        competitionId: row.competitionId!,
        competitionName: row.competitionName!,
      })),
  );
  return { stats: filtered, filterOptions };
}

export async function getFixturePlayerMatchStats(fixtureId: string) {
  return queryPlayerMatchStatsRows({ fixtureId });
}

export async function getPlayerSeasonStats(playerId: string): Promise<PlayerSeasonStatsRow[]> {
  const matchRows = await queryPlayerMatchStatsRows({ playerId });
  const seasonRows = aggregateSeasonRowsFromMatchStats(matchRows);
  if (seasonRows.length === 0) return [];

  const seasonIds = [...new Set(seasonRows.map((row) => row.seasonId))];
  const competitionIds = [...new Set(seasonRows.map((row) => row.competitionId))];
  const rankScopeRows = await Promise.all(
    seasonIds.flatMap((seasonId) =>
      competitionIds.map((competitionId) => queryPlayerMatchStatsRows({ seasonId, competitionId })),
    ),
  );
  const rankScopeSeasonRows = applySeasonPerformanceRanks(
    aggregateSeasonRowsFromMatchStats(rankScopeRows.flat()),
  );
  const rankByKey = new Map(
    rankScopeSeasonRows.map((row) => [`${row.playerId}:${row.seasonId}:${row.teamId}`, row]),
  );

  return seasonRows.map((row) => {
    const ranked = rankByKey.get(`${row.playerId}:${row.seasonId}:${row.teamId}`);
    return ranked
      ? { ...row, attackRank: ranked.attackRank, defenceRank: ranked.defenceRank }
      : row;
  });
}

export async function getTeamSeasonStats(teamId: string, filters: TeamSeasonStatsFilters = {}) {
  const matchRows = await queryPlayerMatchStatsRows({
    teamId,
    seasonId: filters.seasonId,
    competitionId: filters.competitionId,
  });

  let scopedRows = matchRows;
  if (filters.search?.trim()) {
    const db = getDb();
    const matchingPlayers = await db
      .select({ id: players.id })
      .from(players)
      .where(ilike(players.name, `%${filters.search.trim()}%`));
    const playerIds = new Set(matchingPlayers.map((row) => row.id));
    scopedRows = matchRows.filter((row) => playerIds.has(row.playerId));
  }

  const seasonRows = applySeasonPerformanceRanks(aggregateSeasonRowsFromMatchStats(scopedRows));
  const playerNames = await getDb()
    .select({ id: players.id, name: players.name, slug: players.slug })
    .from(players);
  const playerById = new Map(playerNames.map((player) => [player.id, player]));

  const stats = sortTeamSeasonStatsRows(
    seasonRows.map((row) => ({
      ...row,
      playerName: playerById.get(row.playerId)?.name ?? "Unknown",
      playerSlug: playerById.get(row.playerId)?.slug ?? row.playerId,
    })),
    filters,
  );

  const filterOptions = buildSeasonStatsFilterOptions(
    matchRows
      .filter((row) => row.seasonId && row.competitionId && row.seasonLabel && row.competitionName)
      .map((row) => ({
        seasonId: row.seasonId!,
        seasonLabel: row.seasonLabel!,
        competitionId: row.competitionId!,
        competitionName: row.competitionName!,
      })),
  );

  return {
    stats,
    filterOptions,
    pagination: { total: stats.length },
  };
}

export async function resolveSeasonIdForFixture(input: {
  competitionId: string | null;
  kickoffAt: Date | null;
}) {
  if (!input.competitionId || !input.kickoffAt) return null;
  const db = getDb();
  const seasonRows = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, input.competitionId));

  const label = resolveFixtureSeasonLabel({
    kickoffAt: input.kickoffAt,
    competitionId: input.competitionId,
    seasons: seasonRows,
  });
  const match = seasonRows.find((season) => season.label === label);
  return match?.id ?? null;
}

export async function loadFixtureScoringByExternalPlayerId(fixtureId: string) {
  const db = getDb();
  const rows = await db
    .select({
      externalProviderId: players.externalProviderId,
      tries: fixturePlayers.tries,
      points: fixturePlayers.points,
      playerId: fixturePlayers.playerId,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  return rows;
}

export async function getFixtureScoringMap(fixtureId: string) {
  const db = getDb();
  const rows = await db
    .select({
      playerId: fixturePlayers.playerId,
      tries: fixturePlayers.tries,
      points: fixturePlayers.points,
    })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));
  return new Map(rows.map((row) => [row.playerId, row]));
}

export { parseMatchPlayerPerformance };
