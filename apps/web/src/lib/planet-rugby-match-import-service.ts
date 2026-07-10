import { desc, eq } from "drizzle-orm";
import { fixtures, matchEvents } from "@rugby365/db";
import {
  combineKickoffIso,
  fetchSdmsLineups,
  fetchSdmsMatchDetail,
  isPlanetRugbyMatchUrl,
  mapSdmsLineups,
  parsePlanetRugbyMatchUrl,
  sdmsEventTypeToMatchEvent,
  sdmsKeyEventPayload,
  type MappedLineups,
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
  if (/half|live|first|second/i.test(status)) return "live";
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
): Promise<number> {
  const detail = await fetchSdmsMatchDetail(matchId);
  const events = detail?.key_events ?? [];
  if (events.length === 0) return 0;

  const db = getDb();
  if (replaceExisting) {
    const existing = await db.select().from(matchEvents).where(eq(matchEvents.fixtureId, fixtureId));
    for (const row of existing) {
      if (row.sourceProvider === SDMS_PROVIDER) {
        await db.delete(matchEvents).where(eq(matchEvents.id, row.id));
      }
    }
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
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventType = sdmsEventTypeToMatchEvent(event.type);
    if (!eventType) continue;
    const sdmsId = `${matchId}:${i}`;
    if (known.has(sdmsId)) continue;

    const teamId =
      event.team_id === homeTeamProviderId
        ? homeTeamId
        : event.team_id === awayTeamProviderId
          ? awayTeamId
          : null;

    sequenceNo += 1;
    values.push({
      fixtureId,
      eventType,
      minute: event.minute ?? 0,
      second: event.second ?? 0,
      teamId,
      payload: sdmsKeyEventPayload(event, matchId, i),
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
  } = {},
): Promise<PlanetRugbyMatchImportResult> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture must have home and away teams before SDMS enrich.");
  }

  const [detail, lineupsRaw] = await Promise.all([
    fetchSdmsMatchDetail(matchId),
    fetchSdmsLineups(matchId),
  ]);
  if (!detail) throw new Error(`SDMS match detail not found: ${matchId}`);

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
  );

  await linkFixtureEventPlayerIds(fixtureId);
  await syncFixturePlayerStats(fixtureId);

  let playerStatsImported = 0;
  try {
    const { importMatchPerformanceStats } = await import("./planet-rugby-player-stats-import-service");
    const statsResult = await importMatchPerformanceStats(fixtureId, matchId);
    playerStatsImported = statsResult.playersProcessed;
  } catch {
    /* performance stats optional when SDMS feed unavailable */
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
  options: { delayMs?: number } = {},
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
      const result = await enrichFixtureFromSdmsMatch(fixture.id, matchId);
      results.push(result);
      enriched += 1;
    } catch {
      failed += 1;
    }
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  return { enriched, failed, results };
}
