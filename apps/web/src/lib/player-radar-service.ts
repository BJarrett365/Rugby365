/**
 * Player Performance Radar — load/compute/cache position percentiles.
 */
import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  playerRadarCaches,
  playerRatings,
  players,
  playerSeasonStats,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  buildPlayerRadarBundle,
  emptyRadarBundle,
  type CohortPeerRow,
  type PlayerRadarBundle,
} from "./player-radar-build";
import type { RadarType } from "./player-radar-metrics";
import { normalizePositionFamily } from "./player-radar-positions";
import {
  currentDomesticSeasonStartYear,
  seasonSlugFromStartYear,
} from "./season-label-utils";
import { seasonLabelToPublicSlug } from "./public-player-filters";

export type RadarCmsSettings = {
  enabled: boolean;
  defaultType: RadarType;
  minMinutes: number;
};

const VALID_TYPES = new Set<RadarType>([
  "overall",
  "attack",
  "defence",
  "carrying",
  "set_piece",
  "kicking",
  "discipline",
  "physical",
]);

export function parseRadarSettings(raw: unknown): RadarCmsSettings {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const type = typeof s.defaultType === "string" ? s.defaultType : "overall";
  return {
    enabled: s.enabled !== false,
    defaultType: VALID_TYPES.has(type as RadarType) ? (type as RadarType) : "overall",
    minMinutes: typeof s.minMinutes === "number" && s.minMinutes >= 0 ? s.minMinutes : 400,
  };
}

function toRatesInput(row: {
  minutesPlayed: number;
  appearances: number;
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
}) {
  return {
    minutesPlayed: row.minutesPlayed ?? 0,
    appearances: row.appearances ?? 0,
    tries: row.tries ?? 0,
    points: row.points ?? 0,
    carries: row.carries ?? 0,
    metresCarried: row.metresCarried ?? 0,
    tacklesMade: row.tacklesMade ?? 0,
    tacklesCompleted: row.tacklesCompleted ?? 0,
    dominantTackles: row.dominantTackles ?? 0,
    turnoversWon: row.turnoversWon ?? 0,
    tryAssists: row.tryAssists ?? 0,
    lineBreaks: row.lineBreaks ?? 0,
    defendersBeaten: row.defendersBeaten ?? 0,
    touches: row.touches ?? 0,
    postContactMetres: row.postContactMetres ?? 0,
    ruckArrivalEffectiveness: row.ruckArrivalEffectiveness ?? 0,
  };
}

async function resolveSeasonIds(seasonParam: string): Promise<string[] | null> {
  /** null = all seasons */
  if (seasonParam === "all") return null;
  const db = getDb();
  const slug =
    seasonParam === "current"
      ? seasonSlugFromStartYear(currentDomesticSeasonStartYear())
      : seasonParam;
  const rows = await db
    .select({ id: competitionSeasons.id, label: competitionSeasons.label, slug: competitionSeasons.slug })
    .from(competitionSeasons);

  // Calendar year "2026" must also include club seasons like 2026-27 so radar
  // still finds Premiership/Top 14 season_stats rows.
  const calendarYear = /^\d{4}$/.test(slug) ? slug : null;
  const clubPrefix = calendarYear ? `${calendarYear}-` : null;

  const ids = rows
    .filter((r) => {
      const s = (r.slug ?? "").toLowerCase();
      const fromLabel = seasonLabelToPublicSlug(r.label)?.toLowerCase();
      if (s === slug || fromLabel === slug) return true;
      if (clubPrefix && (s.startsWith(clubPrefix) || (fromLabel ?? "").startsWith(clubPrefix))) {
        return true;
      }
      return false;
    })
    .map((r) => r.id);
  return ids.length ? ids : [];
}

function isUsableRadarCache(payload: unknown): payload is PlayerRadarBundle {
  if (!payload || typeof payload !== "object") return false;
  const bundle = payload as PlayerRadarBundle;
  if (!bundle.title || !bundle.radars || typeof bundle.radars !== "object") return false;
  const overall = bundle.radars.overall ?? Object.values(bundle.radars)[0];
  const spokes = overall?.spokes ?? [];
  return spokes.filter((s) => s.percentile != null).length >= 3;
}

/** Prefer the player's richest season_stats season when the page filter has none. */
async function loadPlayerSeasonStatsFallback(playerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.playerId, playerId));
  if (!rows.length) return null;
  const bySeason = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySeason.get(row.seasonId) ?? [];
    list.push(row);
    bySeason.set(row.seasonId, list);
  }
  let bestId: string | null = null;
  let bestMinutes = -1;
  for (const [seasonId, list] of bySeason) {
    const mins = list.reduce((s, r) => s + (r.minutesPlayed || 0), 0);
    if (mins > bestMinutes) {
      bestMinutes = mins;
      bestId = seasonId;
    }
  }
  if (!bestId) return null;
  return { seasonId: bestId, rows: bySeason.get(bestId)! };
}

async function resolveCompetitionId(competitionParam: string): Promise<string | null> {
  if (!competitionParam || competitionParam === "all") return null;
  const db = getDb();
  const [row] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, competitionParam))
    .limit(1);
  return row?.id ?? null;
}

function cacheScopeKey(view: "domestic" | "international" | "scouting" | "all"): string {
  if (view === "international") return "international";
  if (view === "scouting") return "scouting";
  return "domestic";
}

export async function getPublicPlayerRadar(input: {
  playerId: string;
  playerName: string;
  positionName: string | null;
  season: string;
  competition: string;
  view?: "domestic" | "international" | "scouting";
  /** Force recompute (skip read cache) */
  forceRecompute?: boolean;
}): Promise<PlayerRadarBundle> {
  const db = getDb();
  const [ratingRow] = await db
    .select({
      radarSettings: playerRatings.radarSettings,
      radarSummaryOverride: playerRatings.radarSummaryOverride,
      radarSummaryApproved: playerRatings.radarSummaryApproved,
    })
    .from(playerRatings)
    .where(eq(playerRatings.playerId, input.playerId))
    .limit(1);

  const settings = parseRadarSettings(ratingRow?.radarSettings);
  if (!settings.enabled) {
    const empty = emptyRadarBundle({
      playerName: input.playerName,
      positionName: input.positionName,
      minMinutes: settings.minMinutes,
      enabled: false,
    });
    empty.summary = "Performance radar is disabled for this player.";
    return empty;
  }

  let seasonIds = await resolveSeasonIds(input.season);
  const competitionId = await resolveCompetitionId(input.competition);
  const scope = cacheScopeKey(input.view ?? "domestic");

  const playerStatConditions = [eq(playerSeasonStats.playerId, input.playerId)];
  if (seasonIds && seasonIds.length > 0) {
    playerStatConditions.push(inArray(playerSeasonStats.seasonId, seasonIds));
  } else if (seasonIds && seasonIds.length === 0) {
    // Unknown season slug — try fall back below
  }
  if (competitionId) {
    playerStatConditions.push(eq(playerSeasonStats.competitionId, competitionId));
  }

  let playerRows =
    seasonIds && seasonIds.length === 0
      ? []
      : await db
          .select()
          .from(playerSeasonStats)
          .where(and(...playerStatConditions));

  let usedSeasonFallback = false;
  if (!playerRows.length) {
    const fallback = await loadPlayerSeasonStatsFallback(input.playerId);
    if (!fallback) {
      return emptyRadarBundle({
        playerName: input.playerName,
        positionName: input.positionName,
        minMinutes: settings.minMinutes,
        enabled: true,
      });
    }
    playerRows = fallback.rows;
    seasonIds = [fallback.seasonId];
    usedSeasonFallback = true;
  }

  const seasonIdForCache =
    seasonIds?.length === 1 ? seasonIds[0]! : playerRows[0]?.seasonId ?? null;

  if (!input.forceRecompute) {
    const cached = await findRadarCache({
      playerId: input.playerId,
      seasonId: seasonIdForCache,
      competitionId: usedSeasonFallback ? null : competitionId,
      scope,
      minMinutes: settings.minMinutes,
    });
    if (isUsableRadarCache(cached?.payload)) {
      return { ...cached!.payload as PlayerRadarBundle, enabled: true };
    }
  }

  // Cohort universe: same season(s) + optional competition, minutes threshold
  const peerConditions = [gte(playerSeasonStats.minutesPlayed, settings.minMinutes)];
  if (seasonIds && seasonIds.length > 0) {
    peerConditions.push(inArray(playerSeasonStats.seasonId, seasonIds));
  }
  if (competitionId && !usedSeasonFallback) {
    peerConditions.push(eq(playerSeasonStats.competitionId, competitionId));
  }

  const peerRows = await db
    .select({
      playerId: playerSeasonStats.playerId,
      minutesPlayed: playerSeasonStats.minutesPlayed,
      appearances: playerSeasonStats.appearances,
      tries: playerSeasonStats.tries,
      points: playerSeasonStats.points,
      carries: playerSeasonStats.carries,
      metresCarried: playerSeasonStats.metresCarried,
      tacklesMade: playerSeasonStats.tacklesMade,
      tacklesCompleted: playerSeasonStats.tacklesCompleted,
      dominantTackles: playerSeasonStats.dominantTackles,
      turnoversWon: playerSeasonStats.turnoversWon,
      tryAssists: playerSeasonStats.tryAssists,
      lineBreaks: playerSeasonStats.lineBreaks,
      defendersBeaten: playerSeasonStats.defendersBeaten,
      touches: playerSeasonStats.touches,
      postContactMetres: playerSeasonStats.postContactMetres,
      ruckArrivalEffectiveness: playerSeasonStats.ruckArrivalEffectiveness,
      competitionId: playerSeasonStats.competitionId,
      positionName: players.positionName,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .where(and(...peerConditions));

  // Collapse multi-row peers (team splits) into one rates input per player
  const peerByPlayer = new Map<string, CohortPeerRow>();
  for (const row of peerRows) {
    const existing = peerByPlayer.get(row.playerId);
    const rates = toRatesInput(row);
    if (!existing) {
      peerByPlayer.set(row.playerId, {
        ...rates,
        playerId: row.playerId,
        positionName: row.positionName,
        competitionId: row.competitionId,
      });
    } else {
      peerByPlayer.set(row.playerId, {
        playerId: row.playerId,
        positionName: existing.positionName || row.positionName,
        competitionId: existing.competitionId,
        minutesPlayed: existing.minutesPlayed + rates.minutesPlayed,
        appearances: existing.appearances + rates.appearances,
        tries: existing.tries + rates.tries,
        points: existing.points + rates.points,
        carries: existing.carries + rates.carries,
        metresCarried: existing.metresCarried + rates.metresCarried,
        tacklesMade: existing.tacklesMade + rates.tacklesMade,
        tacklesCompleted: existing.tacklesCompleted + rates.tacklesCompleted,
        dominantTackles: existing.dominantTackles + rates.dominantTackles,
        turnoversWon: existing.turnoversWon + rates.turnoversWon,
        tryAssists: existing.tryAssists + rates.tryAssists,
        lineBreaks: existing.lineBreaks + rates.lineBreaks,
        defendersBeaten: existing.defendersBeaten + rates.defendersBeaten,
        touches: existing.touches + rates.touches,
        postContactMetres: existing.postContactMetres + rates.postContactMetres,
        ruckArrivalEffectiveness: Math.max(
          existing.ruckArrivalEffectiveness,
          rates.ruckArrivalEffectiveness,
        ),
      });
    }
  }

  const firstSeasonId = playerRows[0]!.seasonId;
  const [seasonMeta] = await db
    .select({
      label: competitionSeasons.label,
      slug: competitionSeasons.slug,
      competitionName: competitions.name,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .where(eq(competitionSeasons.id, firstSeasonId))
    .limit(1);

  let competitionLabel: string | null = null;
  if (competitionId && !usedSeasonFallback) {
    const [c] = await db
      .select({ name: competitions.name })
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);
    competitionLabel = c?.name ?? null;
  } else if (playerRows[0]?.competitionId) {
    const [c] = await db
      .select({ name: competitions.name })
      .from(competitions)
      .where(eq(competitions.id, playerRows[0].competitionId))
      .limit(1);
    competitionLabel = c?.name ?? seasonMeta?.competitionName ?? null;
  } else {
    competitionLabel = seasonMeta?.competitionName ?? null;
  }

  const seasonLabel =
    input.season === "all" && !usedSeasonFallback
      ? "Career"
      : seasonMeta?.label ?? (input.season === "current" ? "Current season" : input.season);

  const bundle = buildPlayerRadarBundle({
    playerId: input.playerId,
    playerName: input.playerName,
    positionName: input.positionName,
    competitionLabel,
    seasonLabel,
    minMinutes: settings.minMinutes,
    defaultType: settings.defaultType,
    enabled: true,
    summaryOverride: ratingRow?.radarSummaryOverride ?? null,
    summaryApproved: Boolean(ratingRow?.radarSummaryApproved),
    playerRows: playerRows.map(toRatesInput),
    peers: [...peerByPlayer.values()],
  });

  if (isUsableRadarCache(bundle)) {
    await upsertRadarCache({
      playerId: input.playerId,
      seasonId: seasonIdForCache,
      competitionId: usedSeasonFallback ? null : competitionId,
      scope,
      positionFamily: normalizePositionFamily(input.positionName),
      minMinutes: settings.minMinutes,
      title: bundle.title,
      cohortSize: bundle.cohortSize,
      payload: bundle,
    });
  }

  return bundle;
}

async function findRadarCache(input: {
  playerId: string;
  seasonId: string | null;
  competitionId: string | null;
  scope: string;
  minMinutes: number;
}) {
  const db = getDb();
  const conditions = [
    eq(playerRadarCaches.playerId, input.playerId),
    eq(playerRadarCaches.scope, input.scope),
    eq(playerRadarCaches.minMinutes, input.minMinutes),
  ];
  if (input.seasonId) conditions.push(eq(playerRadarCaches.seasonId, input.seasonId));
  else conditions.push(sql`${playerRadarCaches.seasonId} is null`);
  if (input.competitionId) {
    conditions.push(eq(playerRadarCaches.competitionId, input.competitionId));
  } else {
    conditions.push(sql`${playerRadarCaches.competitionId} is null`);
  }
  conditions.push(sql`${playerRadarCaches.teamId} is null`);

  const [row] = await db
    .select()
    .from(playerRadarCaches)
    .where(and(...conditions))
    .limit(1);
  return row ?? null;
}

async function upsertRadarCache(input: {
  playerId: string;
  seasonId: string | null;
  competitionId: string | null;
  scope: string;
  positionFamily: string;
  minMinutes: number;
  title: string;
  cohortSize: number;
  payload: PlayerRadarBundle;
}) {
  const db = getDb();
  const existing = await findRadarCache({
    playerId: input.playerId,
    seasonId: input.seasonId,
    competitionId: input.competitionId,
    scope: input.scope,
    minMinutes: input.minMinutes,
  });
  const values = {
    playerId: input.playerId,
    seasonId: input.seasonId,
    competitionId: input.competitionId,
    teamId: null as string | null,
    scope: input.scope,
    positionFamily: input.positionFamily,
    minMinutes: input.minMinutes,
    title: input.title,
    cohortSize: input.cohortSize,
    payload: input.payload,
    computedAt: new Date(),
  };
  try {
    if (existing) {
      await db
        .update(playerRadarCaches)
        .set(values)
        .where(eq(playerRadarCaches.id, existing.id));
    } else {
      await db.insert(playerRadarCaches).values(values);
    }
  } catch {
    // Cache write failure must not break the public page
  }
}

/** Drop caches for a season (call after season stats rebuild). */
export async function invalidateRadarCachesForSeason(seasonId: string) {
  const db = getDb();
  await db.delete(playerRadarCaches).where(eq(playerRadarCaches.seasonId, seasonId));
}

/** Drop all caches for a player. */
export async function invalidateRadarCachesForPlayer(playerId: string) {
  const db = getDb();
  await db.delete(playerRadarCaches).where(eq(playerRadarCaches.playerId, playerId));
}

/**
 * Warm cache for players who have season stats in the given season.
 * Safe to run from CLI after imports.
 */
export async function rebuildRadarCachesForSeason(seasonId: string, limit = 500) {
  const db = getDb();
  await invalidateRadarCachesForSeason(seasonId);
  const rows = await db
    .select({
      playerId: playerSeasonStats.playerId,
      name: players.name,
      positionName: players.positionName,
      competitionId: playerSeasonStats.competitionId,
      minutes: playerSeasonStats.minutesPlayed,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .where(eq(playerSeasonStats.seasonId, seasonId))
    .limit(limit);

  const [season] = await db
    .select({ slug: competitionSeasons.slug, label: competitionSeasons.label })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, seasonId))
    .limit(1);
  const seasonSlug =
    season?.slug || seasonLabelToPublicSlug(season?.label) || "current";

  const seen = new Set<string>();
  let built = 0;
  for (const row of rows) {
    if (seen.has(row.playerId)) continue;
    seen.add(row.playerId);
    const [comp] = await db
      .select({ slug: competitions.slug })
      .from(competitions)
      .where(eq(competitions.id, row.competitionId))
      .limit(1);
    await getPublicPlayerRadar({
      playerId: row.playerId,
      playerName: row.name,
      positionName: row.positionName,
      season: seasonSlug,
      competition: comp?.slug ?? "all",
      view: "domestic",
      forceRecompute: true,
    });
    built += 1;
  }
  return { built, players: seen.size };
}
