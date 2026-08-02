import { and, desc, eq, inArray } from "drizzle-orm";
import {
  commentarySuggestions,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
} from "@rugby365/db";
import {
  combineKickoffIso,
  fetchSdmsLineups,
  fetchSdmsMatchDetail,
  fetchSdmsPreviousMeetings,
  isPlanetRugbyMatchUrl,
  mapSdmsLineups,
  parsePlanetRugbyMatchUrl,
  sdmsEventTypeToMatchEvent,
  sdmsKeyEventPayload,
  type MappedLineups,
  type SdmsKeyEvent,
} from "@rugby365/import-sdk";
import type { Sport365Lineups } from "@rugby365/match-operator-agent";
import { enrichFixtureEventPlayers } from "./fixture-player-map";
import {
  linkFixtureEventPlayerIds,
  SDMS_PROVIDER,
  syncFixtureSquad,
} from "./entity-resolve-service";
import { resolveReferee } from "./entity-admin-service";
import {
  findFixtureByExternalMatchId,
  getFixtureById,
} from "./fixture-admin-service";
import { getDb } from "./db";
import { syncFixturePlayerStats } from "./player-stats";
import { resolveVenue, getVenueById } from "./venue-admin-service";
import { ensureVenueCapacityInDatabase } from "./venue-capacity-sync-service";
import { mergeProviderSnapshot } from "./head-to-head-service";

function mappedLineupsToSport365(lineups: MappedLineups): Sport365Lineups {
  return lineups as Sport365Lineups;
}

function sdmsStatusToFixtureStatus(status: string): string {
  if (status === "Result") return "full_time";
  if (status === "Fixture") return "scheduled";
  if (/half\s*time|^ht\b/i.test(status)) return "half_time";
  if (/live|first|second|in\s*play/i.test(status)) return "live";
  return "scheduled";
}

async function existingSdmsEventIds(fixtureId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId));
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.sourceProvider !== SDMS_PROVIDER) continue;
    const payload = row.payload as Record<string, unknown>;
    const id = typeof payload.sdms_event_id === "string" ? payload.sdms_event_id : "";
    if (id) ids.add(id);
  }
  return ids;
}

async function importSdmsKeyEvents(
  fixtureId: string,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeTeamProviderId?: string,
  awayTeamProviderId?: string,
  replaceExisting = false,
  keyEvents?: SdmsKeyEvent[] | null,
): Promise<number> {
  const events =
    keyEvents ??
    (await fetchSdmsMatchDetail(matchId))?.key_events ??
    [];
  if (events.length === 0) return 0;

  const db = getDb();
  const existingRows = await db.select().from(matchEvents).where(eq(matchEvents.fixtureId, fixtureId));
  const sdmsRows = existingRows.filter((row) => row.sourceProvider === SDMS_PROVIDER);

  const incoming: Array<{
    sdmsId: string;
    eventType: string;
    minute: number;
    second: number;
    teamId: string | null;
    payload: ReturnType<typeof sdmsKeyEventPayload>;
  }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventType = sdmsEventTypeToMatchEvent(event.type);
    if (!eventType) continue;
    const payload = sdmsKeyEventPayload(event, matchId, i);
    const teamId =
      event.team_id === homeTeamProviderId
        ? homeTeamId
        : event.team_id === awayTeamProviderId
          ? awayTeamId
          : null;
    incoming.push({
      sdmsId: payload.sdms_event_id,
      eventType,
      minute: event.minute ?? 0,
      second: event.second ?? 0,
      teamId,
      payload,
    });
  }

  const incomingIds = new Set(incoming.map((row) => row.sdmsId));

  // Drop stale SDMS rows (including legacy index-based ids like matchId:12)
  // so re-import restores missing conversions after feed growth/reorder.
  const staleIds: string[] = [];
  for (const row of sdmsRows) {
    const payload = row.payload as Record<string, unknown>;
    const id = typeof payload.sdms_event_id === "string" ? payload.sdms_event_id : "";
    if (replaceExisting || !id || !incomingIds.has(id)) {
      staleIds.push(row.id);
    }
  }
  if (staleIds.length > 0) {
    // Clear commentary FKs before deleting events (no ON DELETE SET NULL).
    await db
      .update(commentarySuggestions)
      .set({ triggerEventId: null })
      .where(inArray(commentarySuggestions.triggerEventId, staleIds));
    await db.delete(matchEvents).where(inArray(matchEvents.id, staleIds));
  }

  const known = replaceExisting ? new Set<string>() : await existingSdmsEventIds(fixtureId);
  const [last] = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(desc(matchEvents.sequenceNo))
    .limit(1);
  let sequenceNo = last?.sequenceNo ?? 0;

  const values = [];
  for (const row of incoming) {
    if (known.has(row.sdmsId)) continue;
    sequenceNo += 1;
    values.push({
      fixtureId,
      eventType: row.eventType,
      minute: row.minute,
      second: row.second,
      teamId: row.teamId,
      payload: row.payload,
      sourceProvider: SDMS_PROVIDER,
      sequenceNo,
    });
  }

  if (values.length === 0) return 0;
  await db.insert(matchEvents).values(values);
  return values.length;
}

export type PlanetRugbyMatchImportResult = {
  fixtureId: string;
  matchId: string;
  squadPlayers: number;
  eventsImported: number;
  hasLineups: boolean;
  hasHeadToHead: boolean;
  hasStats: boolean;
};

export async function enrichFixtureFromSdmsMatch(
  fixtureId: string,
  matchId: string,
  options: {
    planetRugbyUrl?: string;
    replaceEvents?: boolean;
    /** Skip SDMS attack/defend/kicking/errors/carries import (events-only repair). */
    skipPerformanceStats?: boolean;
  } = {},
): Promise<PlanetRugbyMatchImportResult> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture must have home and away teams before SDMS enrich.");
  }

  const [detail, lineupsRaw, previousMeetings] = await Promise.all([
    fetchSdmsMatchDetail(matchId),
    fetchSdmsLineups(matchId),
    fetchSdmsPreviousMeetings(matchId),
  ]);
  if (!detail) throw new Error(`SDMS match detail not found: ${matchId}`);

  if (previousMeetings.length > 0) {
    detail.last_five_meetings = previousMeetings;
  }

  const lineups = lineupsRaw
    ? mapSdmsLineups(
        lineupsRaw,
        detail.home_team_name,
        detail.away_team_name,
        detail.home_team_id,
        detail.away_team_id,
      )
    : undefined;

  const mainRef = detail.referee?.find((r) => r.role.toLowerCase().includes("referee"));
  const referee = mainRef?.name
    ? await resolveReferee({ name: mainRef.name.trim(), createIfMissing: true })
    : null;

  let venue = detail.venue_name
    ? await resolveVenue({
        name: detail.venue_name,
        teamId: fixture.homeTeamId ?? undefined,
        createIfMissing: true,
      })
    : null;

  if (venue) {
    await ensureVenueCapacityInDatabase(venue.id, {
      sourceProvider: "planet_rugby",
    });
    venue = (await getVenueById(venue.id)) ?? venue;
  }

  const kickoffAt = combineKickoffIso(detail.date, detail.time);
  const status = sdmsStatusToFixtureStatus(detail.status);
  const sport365Lineups = lineups ? mappedLineupsToSport365(lineups) : undefined;

  const db = getDb();
  const existingSnap =
    fixture.providerSnapshot && typeof fixture.providerSnapshot === "object"
      ? (fixture.providerSnapshot as Record<string, unknown>)
      : {};

  await db
    .update(fixtures)
    .set({
      kickoffAt: new Date(kickoffAt),
      status,
      homeScore: detail.home_team_score ?? fixture.homeScore,
      awayScore: detail.away_team_score ?? fixture.awayScore,
      competitionName: detail.competition_name ?? fixture.competitionName,
      round: detail.round ?? fixture.round,
      venueName: detail.venue_name ?? fixture.venueName,
      venueId: venue?.id ?? fixture.venueId,
      refereeName: mainRef?.name?.trim() ?? fixture.refereeName,
      refereeId: referee?.id ?? fixture.refereeId,
      planetRugbyUrl: options.planetRugbyUrl ?? fixture.planetRugbyUrl,
      externalMatchId: matchId,
      providerSnapshot: mergeProviderSnapshot(existingSnap, {
        source: "planet_rugby",
        matchId,
        sourceUrl: options.planetRugbyUrl ?? fixture.planetRugbyUrl,
        polledAt: new Date().toISOString(),
        sdms: {
          headToHead: detail.head_to_head ?? [],
          lastFiveMeetings: detail.last_five_meetings ?? [],
        },
        headToHead: detail.head_to_head ?? [],
        lastFiveMeetings: detail.last_five_meetings ?? [],
        lineups: sport365Lineups,
        homeRecentResults: detail.home_recent_results,
        awayRecentResults: detail.away_recent_results,
        summary: detail.summary,
        scoringDetail: detail.detail,
        referees: detail.referee,
      }),
    })
    .where(eq(fixtures.id, fixtureId));

  let squadPlayers = 0;
  if (sport365Lineups) {
    await enrichFixtureEventPlayers(fixtureId, {
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      lineups: sport365Lineups,
    });
    squadPlayers = await syncFixtureSquad(
      fixtureId,
      sport365Lineups,
      fixture.homeTeamId,
      fixture.awayTeamId,
      { sourceProvider: SDMS_PROVIDER },
    );
  }

  const eventsImported = await importSdmsKeyEvents(
    fixtureId,
    matchId,
    fixture.homeTeamId,
    fixture.awayTeamId,
    detail.home_team_id,
    detail.away_team_id,
    options.replaceEvents ?? false,
    detail.key_events,
  );

  await linkFixtureEventPlayerIds(fixtureId);
  await syncFixturePlayerStats(fixtureId);

  let playerStatsImported = 0;
  if (options.skipPerformanceStats !== true) {
    try {
      const { importMatchPerformanceStats } = await import("./planet-rugby-player-stats-import-service");
      const statsResult = await importMatchPerformanceStats(fixtureId, matchId);
      playerStatsImported = statsResult.playersProcessed;
    } catch {
      /* performance stats optional when SDMS feed unavailable */
    }
  }

  return {
    fixtureId,
    matchId,
    squadPlayers,
    eventsImported,
    hasLineups: Boolean(sport365Lineups),
    hasHeadToHead: Boolean(detail.head_to_head?.length),
    hasStats: Boolean(detail.summary) || playerStatsImported > 0,
  };
}

async function syncMatchPerformanceScoringFromFixturePlayers(fixtureId: string): Promise<number> {
  const db = getDb();
  const squad = await db
    .select({
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
      tries: fixturePlayers.tries,
      points: fixturePlayers.points,
    })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  let updated = 0;
  for (const row of squad) {
    const patched = await db
      .update(playerMatchPerformanceStats)
      .set({
        tries: row.tries,
        points: row.points,
        syncedAt: new Date(),
      })
      .where(
        and(
          eq(playerMatchPerformanceStats.fixtureId, fixtureId),
          eq(playerMatchPerformanceStats.playerId, row.playerId),
        ),
      )
      .returning({ id: playerMatchPerformanceStats.id });
    updated += patched.length;
  }
  return updated;
}

/**
 * Lightweight repair: refresh SDMS key events + fixture_players scoring only.
 * Use for bulk conversion/try fixes without re-pulling full performance stats.
 */
export async function repairSdmsFixtureScoringEvents(
  fixtureId: string,
  matchId: string,
): Promise<{ eventsImported: number; linked: number; performanceScoringUpdated: number }> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture?.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture must have home and away teams.");
  }
  const detail = await fetchSdmsMatchDetail(matchId);
  if (!detail) throw new Error(`SDMS match detail not found: ${matchId}`);

  const eventsImported = await importSdmsKeyEvents(
    fixtureId,
    matchId,
    fixture.homeTeamId,
    fixture.awayTeamId,
    detail.home_team_id,
    detail.away_team_id,
    true,
    detail.key_events,
  );
  const linked = await linkFixtureEventPlayerIds(fixtureId);
  await syncFixturePlayerStats(fixtureId);
  const performanceScoringUpdated = await syncMatchPerformanceScoringFromFixturePlayers(fixtureId);
  return { eventsImported, linked, performanceScoringUpdated };
}

export async function importFixtureFromPlanetRugbyMatchUrl(
  sourceUrl: string,
  options: { replaceEvents?: boolean } = {},
): Promise<PlanetRugbyMatchImportResult> {
  if (!isPlanetRugbyMatchUrl(sourceUrl)) {
    throw new Error("Not a Planet Rugby match URL.");
  }
  const parts = parsePlanetRugbyMatchUrl(sourceUrl);
  const matchId = parts.match_external_id;

  const existing = await findFixtureByExternalMatchId(matchId);
  if (!existing) {
    throw new Error(
      "Fixture not found. Import the competition season first, or create the match from the league results import.",
    );
  }

  return enrichFixtureFromSdmsMatch(existing.id, matchId, {
    planetRugbyUrl: sourceUrl,
    replaceEvents: options.replaceEvents,
  });
}

export async function enrichFixturesFromSdmsRows(
  matchIds: string[],
  options: { delayMs?: number; replaceEvents?: boolean } = {},
): Promise<{ enriched: number; failed: number; results: PlanetRugbyMatchImportResult[] }> {
  const results: PlanetRugbyMatchImportResult[] = [];
  let enriched = 0;
  let failed = 0;
  const delay = options.delayMs ?? 150;

  for (const matchId of matchIds) {
    try {
      const fixture = await findFixtureByExternalMatchId(matchId);
      if (!fixture) {
        failed += 1;
        continue;
      }
      const result = await enrichFixtureFromSdmsMatch(fixture.id, matchId, {
        replaceEvents: options.replaceEvents ?? true,
      });
      results.push(result);
      enriched += 1;
    } catch {
      failed += 1;
    }
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  return { enriched, failed, results };
}
