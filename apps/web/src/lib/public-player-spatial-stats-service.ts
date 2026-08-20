import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { competitions, fixturePlayers, fixtures, matchEvents, playerMatchPerformanceStats, players } from "@rugby365/db";
import { getDb } from "./db";
import {
  resolveAppearancePassingPosition,
} from "./player-intelligence-position-config";
import {
  buildKickingSpatialStats,
  buildPassingSpatialStats,
  buildPositionBasedPassingZones,
  coveragePct,
  emptyPitchZoneCells,
  normalizeToAttackingCoords,
  readCoordPair,
  readEndCoordPair,
  spatialEventKind,
} from "./public-player-spatial-stats-math";
import { extraNumber, rugbySeasonStartFromKickoff } from "./public-player-stats-v2-math";
import { formatSeasonRangeLabel, seasonSlugFromStartYear } from "./season-label-utils";
import { isInternationalCompetitionType } from "./public-player-filters";
import type {
  KickingSpatialStats,
  PassingSpatialStats,
  PlayerSpatialStatsDto,
  PlayerSpatialStatsFilters,
  RawSpatialEvent,
  SpatialStatsCoverage,
} from "./public-player-spatial-stats-types";
const EMPTY_COVERAGE: SpatialStatsCoverage = {
  totalEvents: 0,
  eventsWithCoords: 0,
  coveragePct: null,
  matchesInScope: 0,
  matchesWithCoords: 0,
  matchesUsed: 0,
  sources: [],
  notes: [],
  method: null,
};

function unavailablePassing(message: string, coverage: SpatialStatsCoverage): PassingSpatialStats {
  return {
    available: false,
    method: null,
    cells: null,
    totalPasses: coverage.totalEvents > 0 ? coverage.totalEvents : null,
    passesWithCoords: null,
    passesWithPosition: null,
    message,
    coverage,
  };
}

function unavailableKicking(message: string, coverage: SpatialStatsCoverage): KickingSpatialStats {
  return {
    available: false,
    origin: null,
    destination: null,
    hasDestinationCoords: false,
    totalKicksFromHand: coverage.totalEvents > 0 ? coverage.totalEvents : null,
    kicksWithOriginCoords: null,
    kicksWithDestinationCoords: null,
    message,
    coverage,
  };
}

function readHalf(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const raw = obj.half ?? obj.period ?? obj.period_number;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function getPlayerSpatialStats(
  playerId: string,
  filters: PlayerSpatialStatsFilters = {},
): Promise<PlayerSpatialStatsDto | null> {
  const db = getDb();
  const [player] = await db
    .select({
      id: players.id,
      internationalTeamId: players.internationalTeamId,
      positionName: players.positionName,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) return null;

  const appearanceRows = await db
    .select({
      fixtureId: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      competitionId: fixtures.competitionId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      teamId: fixturePlayers.teamId,
      positionName: fixturePlayers.positionName,
      jerseyNumber: fixturePlayers.jerseyNumber,
      competitionType: competitions.competitionType,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixturePlayers.playerId, playerId));

  const seasonSlug = filters.seasonSlug?.trim() || null;
  const scoped = appearanceRows.filter((row) => {
    if (filters.competitionId && row.competitionId !== filters.competitionId) return false;
    if (filters.teamId && row.teamId !== filters.teamId) return false;
    if (filters.scope === "international") {
      const isIntl =
        isInternationalCompetitionType(row.competitionType) ||
        (player.internationalTeamId != null && row.teamId === player.internationalTeamId);
      if (!isIntl) return false;
    }
    if (filters.scope === "club") {
      const isIntl =
        isInternationalCompetitionType(row.competitionType) ||
        (player.internationalTeamId != null && row.teamId === player.internationalTeamId);
      if (isIntl) return false;
    }
    if (seasonSlug) {
      const start = rugbySeasonStartFromKickoff(row.kickoffAt);
      const slug = start != null ? seasonSlugFromStartYear(start) : null;
      if (slug !== seasonSlug) return false;
    }
    return true;
  });

  const fixtureIds = scoped.map((r) => r.fixtureId);
  const fixtureById = new Map(scoped.map((r) => [r.fixtureId, r]));

  let seasonLabel: string | null = null;
  if (seasonSlug) {
    const m = seasonSlug.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      seasonLabel = formatSeasonRangeLabel(Number(m[1]));
    }
  }

  if (fixtureIds.length === 0) {
    const coverage = { ...EMPTY_COVERAGE, notes: ["No eligible appearances in this filter."] };
    return {
      playerId,
      seasonSlug,
      seasonLabel,
      passing: unavailablePassing(
        "Spatial passing data not yet available for this player/period.",
        coverage,
      ),
      kicking: unavailableKicking(
        "Spatial kicking data not yet available for this player/period.",
        coverage,
      ),
    };
  }

  const eventRows =
    fixtureIds.length > 0
      ? await db
          .select({
            fixtureId: matchEvents.fixtureId,
            eventType: matchEvents.eventType,
            payload: matchEvents.payload,
            sourceProvider: matchEvents.sourceProvider,
            teamId: matchEvents.teamId,
          })
          .from(matchEvents)
          .where(and(eq(matchEvents.playerId, playerId), inArray(matchEvents.fixtureId, fixtureIds)))
      : [];

  const spatialEvents: RawSpatialEvent[] = [];
  const sources = new Set<string>();
  let passEventCount = 0;
  let kickEventCount = 0;

  for (const row of eventRows) {
    const kind = spatialEventKind(row.eventType);
    if (!kind) continue;
    if (kind === "pass") passEventCount += 1;
    if (kind === "kick_from_hand") kickEventCount += 1;

    const fixture = fixtureById.get(row.fixtureId);
    if (!fixture) continue;

    const start = readCoordPair(row.payload);
    if (!start) continue;

    const normalized = normalizeToAttackingCoords({
      x: start.x,
      y: start.y,
      playerTeamId: fixture.teamId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      half: readHalf(row.payload),
    });

    const endRaw = readEndCoordPair(row.payload);
    const endNorm =
      endRaw != null
        ? normalizeToAttackingCoords({
            x: endRaw.x,
            y: endRaw.y,
            playerTeamId: fixture.teamId,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            half: readHalf(row.payload),
          })
        : null;

    if (row.sourceProvider) sources.add(row.sourceProvider);
    spatialEvents.push({
      kind,
      fixtureId: row.fixtureId,
      sourceProvider: row.sourceProvider,
      x: normalized.x,
      y: normalized.y,
      endX: endNorm?.x ?? null,
      endY: endNorm?.y ?? null,
    });
  }

  const matchesWithCoords = new Set(spatialEvents.map((e) => e.fixtureId)).size;
  const totalSpatialEvents = passEventCount + kickEventCount;
  const coverage: SpatialStatsCoverage = {
    totalEvents: totalSpatialEvents,
    eventsWithCoords: spatialEvents.length,
    coveragePct: coveragePct(spatialEvents.length, totalSpatialEvents),
    matchesInScope: fixtureIds.length,
    matchesWithCoords,
    matchesUsed: matchesWithCoords,
    sources: [...sources].sort(),
    notes: [],
    method: spatialEvents.length > 0 ? "spatial" : null,
  };

  if (spatialEvents.length === 0) {
    coverage.notes.push(
      totalSpatialEvents > 0
        ? "Pass/kick events exist but none carry pitch coordinates in match_events payloads."
        : "No pass or kick-from-hand events with coordinates in match_events for this filter.",
    );
    if (passEventCount === 0 && kickEventCount === 0) {
      coverage.notes.push(
        "Aggregate pass/kick counts may exist in player_match_performance_stats.extras without spatial coords.",
      );
    }
  }

  const passingBuilt = buildPassingSpatialStats(spatialEvents);
  const kickingBuilt = buildKickingSpatialStats(spatialEvents);

  const kicking: KickingSpatialStats =
    kickingBuilt.withOrigin > 0
      ? {
          available: true,
          origin: kickingBuilt.origin,
          destination: kickingBuilt.withDestination > 0 ? kickingBuilt.destination : null,
          hasDestinationCoords: kickingBuilt.withDestination > 0,
          totalKicksFromHand: kickEventCount > 0 ? kickEventCount : null,
          kicksWithOriginCoords: kickingBuilt.withOrigin,
          kicksWithDestinationCoords:
            kickingBuilt.withDestination > 0 ? kickingBuilt.withDestination : null,
          message: null,
          coverage: {
            ...coverage,
            totalEvents: kickEventCount,
            eventsWithCoords: kickingBuilt.withOrigin,
            coveragePct: coveragePct(kickingBuilt.withOrigin, kickEventCount),
            matchesUsed: matchesWithCoords,
            method: "spatial",
          },
        }
      : unavailableKicking("Spatial kicking data not yet available for this player/period.", {
          ...coverage,
          totalEvents: kickEventCount,
          eventsWithCoords: 0,
          coveragePct: coveragePct(0, kickEventCount),
          matchesUsed: 0,
          method: null,
        });

  let passing: PassingSpatialStats;
  if (passingBuilt.withCoords > 0) {
    passing = {
      available: true,
      method: "spatial",
      cells: passingBuilt.cells,
      totalPasses: passEventCount > 0 ? passEventCount : passingBuilt.withCoords,
      passesWithCoords: passingBuilt.withCoords,
      passesWithPosition: null,
      message: null,
      coverage: {
        ...coverage,
        totalEvents: passEventCount,
        eventsWithCoords: passingBuilt.withCoords,
        coveragePct: coveragePct(passingBuilt.withCoords, passEventCount),
        matchesUsed: matchesWithCoords,
        method: "spatial",
      },
    };
  } else {
    passing = await buildPositionBasedPassingStats({
      db,
      playerId,
      primaryPositionName: player.positionName,
      scoped,
      fixtureIds,
      eventRows,
      passEventCount,
      baseCoverage: coverage,
    });
  }

  return { playerId, seasonSlug, seasonLabel, passing, kicking };
}

type PositionFallbackAppearance = {
  fixtureId: string;
  positionName: string | null;
  jerseyNumber: number | null;
};

async function buildPositionBasedPassingStats(input: {
  db: ReturnType<typeof getDb>;
  playerId: string;
  primaryPositionName: string | null;
  scoped: PositionFallbackAppearance[];
  fixtureIds: string[];
  eventRows: Array<{ fixtureId: string; eventType: string }>;
  passEventCount: number;
  baseCoverage: SpatialStatsCoverage;
}): Promise<PassingSpatialStats> {
  const passEventsByFixture = new Map<string, number>();
  for (const row of input.eventRows) {
    if (spatialEventKind(row.eventType) !== "pass") continue;
    passEventsByFixture.set(row.fixtureId, (passEventsByFixture.get(row.fixtureId) ?? 0) + 1);
  }

  const perfRows =
    input.fixtureIds.length > 0
      ? await input.db
          .select({
            fixtureId: playerMatchPerformanceStats.fixtureId,
            extras: playerMatchPerformanceStats.extras,
            sourceProvider: playerMatchPerformanceStats.sourceProvider,
          })
          .from(playerMatchPerformanceStats)
          .where(
            and(
              eq(playerMatchPerformanceStats.playerId, input.playerId),
              inArray(playerMatchPerformanceStats.fixtureId, input.fixtureIds),
            ),
          )
      : [];

  const perfByFixture = new Map(perfRows.map((row) => [row.fixtureId, row]));
  const sources = new Set<string>();
  const appearances: Array<{
    passCount: number;
    positionName: string | null;
    jerseyNumber: number | null;
  }> = [];

  for (const row of input.scoped) {
    const perf = perfByFixture.get(row.fixtureId);
    const extrasPasses = extraNumber(perf?.extras, "passes", "passesMade", "passes_made");
    const eventPasses = passEventsByFixture.get(row.fixtureId) ?? null;
    const passCount = extrasPasses != null ? extrasPasses : eventPasses;
    if (passCount == null || passCount <= 0) continue;
    if (perf?.sourceProvider) sources.add(perf.sourceProvider);
    const resolved = resolveAppearancePassingPosition({
      matchPositionName: row.positionName,
      jerseyNumber: row.jerseyNumber,
      primaryPositionName: input.primaryPositionName,
    });
    appearances.push({
      passCount,
      positionName: resolved.positionName,
      jerseyNumber: resolved.jerseyNumber,
    });
  }

  const built = buildPositionBasedPassingZones(appearances);
  const totalPasses = built.totalPasses > 0 ? built.totalPasses : input.passEventCount;

  if (built.passesWithPosition > 0) {
    return {
      available: true,
      method: "position",
      cells: built.cells,
      totalPasses,
      passesWithCoords: 0,
      passesWithPosition: built.passesWithPosition,
      message: null,
      coverage: {
        ...input.baseCoverage,
        totalEvents: totalPasses,
        eventsWithCoords: 0,
        coveragePct: coveragePct(built.passesWithPosition, totalPasses),
        matchesWithCoords: 0,
        matchesUsed: built.matchesWithPosition,
        sources: [...sources].sort(),
        notes: [
          "Method: POSITION-BASED (not spatial coordinates)",
          `${built.totalPasses} passes · ${built.matchesWithPosition} matches used`,
          "Zones estimated from playing position until pass coordinates are available.",
          ...(built.excludedMatches > 0
            ? [
                `${built.excludedPasses} passes from ${built.excludedMatches} matches excluded (unknown playing position).`,
              ]
            : []),
        ],
        method: "position",
      },
    };
  }

  const notes = [...input.baseCoverage.notes];
  if (built.excludedPasses > 0) {
    notes.push(
      `${built.excludedPasses} passes across ${built.excludedMatches} matches had no resolvable playing position — zones not estimated.`,
    );
  }

  return unavailablePassing("Spatial passing data not yet available for this player/period.", {
    ...input.baseCoverage,
    totalEvents: totalPasses > 0 ? totalPasses : input.passEventCount,
    eventsWithCoords: 0,
    coveragePct: coveragePct(0, totalPasses),
    matchesWithCoords: 0,
    matchesUsed: 0,
    sources: [...sources].sort(),
    notes,
    method: null,
  });
}

/** Map spatial service output onto stats slice DTO fields. */
export function mapSpatialToPassingZones(passing: PassingSpatialStats) {
  return {
    available: passing.available,
    method: passing.method,
    cells: passing.cells,
    totalPasses: passing.totalPasses,
    passesWithCoords: passing.passesWithCoords,
    passesWithPosition: passing.passesWithPosition,
    message: passing.message,
    coverage: passing.coverage,
  };
}

export function mapSpatialToKickingZones(kicking: KickingSpatialStats) {
  return {
    available: kicking.available,
    origin: kicking.origin,
    destination: kicking.destination,
    hasDestinationCoords: kicking.hasDestinationCoords,
    totalKicksFromHand: kicking.totalKicksFromHand,
    message: kicking.message,
    coverage: kicking.coverage,
  };
}

export { emptyPitchZoneCells };
