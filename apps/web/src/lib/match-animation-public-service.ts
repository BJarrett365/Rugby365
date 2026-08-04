import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  coaches,
  fixturePlayers,
  fixtures,
  fixtureTrackerSettings,
  matchEvents,
  playerMatchPerformanceStats,
  players,
  teamMatchStats,
  venues,
} from "@rugby365/db";
import { DEFAULT_FIXTURES_TIMEZONE } from "@rugby365/import-sdk";
import { getDb } from "./db";
import {
  resolveMatchAnimationAvailability,
  type AnimationSettingsSnapshot,
  type MatchAnimationTabBadge,
} from "./match-animation-availability";
import { mapKeyEventsToAnimation } from "./match-animation-events";
import {
  enrichAnimationEventPlayers,
  type AnimationPlayerLookup,
} from "./match-animation-player-enrich";
import {
  isFullTimeConfirmed,
  officialFinalScore,
  resolveMatchResultKind,
} from "./match-animation-fulltime";
import { normalizeTeamStatSide } from "./match-animation-insight";
import {
  geocodeVenueById,
  resolveWeatherForVenueCoords,
} from "./venue-geocode-service";
import { resolveHalfTimeScore } from "./match-header-utils";
import { lookupPlayerLink } from "./match-entity-context";
import { teamAccentColor } from "./team-accent-color";
import type { MatchDetailPageData } from "./match-detail-service";
import type { MatchAnimationPublicPayload } from "./match-animation-types";
import { buildMatchAnimationPlayerStats } from "./match-animation-player-stats";
import { hasDetailedMatchPlayerData } from "./match-animation-detail-gate";
import { EMPTY_MATCH_ANIMATION_AUDIO } from "./match-animation-public-audio";
import { buildMatchAnimationPublicAudio } from "./match-animation-public-audio-server";
import { syncFixtureLiveStateFromSdms } from "./fixture-live-score-sync";
import { syncSdmsLiveEventsFromDetail } from "./planet-rugby-match-import-service";
import { sdmsStatusToPeriod } from "./rugby-match-clock";

export type { MatchAnimationPublicPayload } from "./match-animation-types";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.toUpperCase();
  return (parts[parts.length - 1] ?? name).toUpperCase();
}

function hasPublishedFullTimeEvent(events: Array<{ eventType: string; label: string }>): boolean {
  return events.some((e) => {
    const t = `${e.eventType} ${e.label}`.toLowerCase();
    return (
      t.includes("full time") ||
      t.includes("full-time") ||
      t.includes("full_time") ||
      /\bft\b/.test(t) ||
      t.includes("end of match")
    );
  });
}

async function loadSettings(fixtureId: string | null): Promise<AnimationSettingsSnapshot | null> {
  if (!fixtureId) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(fixtureTrackerSettings)
      .where(eq(fixtureTrackerSettings.fixtureId, fixtureId))
      .limit(1);
    if (!row) return null;
    return {
      trackerActivated: row.trackerActivated,
      publicAnimationEnabled: row.publicAnimationEnabled,
      publicReplayEnabled: row.publicReplayEnabled,
      countdownHeld: row.countdownHeld,
      countdownCancelled: row.countdownCancelled,
      kickOffDelayed: row.kickOffDelayed,
      revisedKickoffAt: row.revisedKickoffAt?.toISOString() ?? null,
      kickOffConfirmedAt: row.kickOffConfirmedAt?.toISOString() ?? null,
      matchStartedAt: row.matchStartedAt?.toISOString() ?? null,
      fullTimeConfirmedAt: row.fullTimeConfirmedAt?.toISOString() ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Persist public animation activation for matches with detailed player data —
 * without resetting CMS scores (unlike CMS "Start match").
 */
async function ensureDetailedMatchAnimationActivated(
  fixtureId: string,
  settings: AnimationSettingsSnapshot | null,
  kickoffAt: string | null,
  options?: { enableReplay?: boolean },
): Promise<AnimationSettingsSnapshot> {
  const wantReplay = Boolean(options?.enableReplay);
  if (
    settings?.publicAnimationEnabled &&
    settings.matchStartedAt &&
    (!wantReplay || settings.publicReplayEnabled)
  ) {
    return settings;
  }

  const now = new Date();
  const startedAt = settings?.matchStartedAt
    ? new Date(settings.matchStartedAt)
    : kickoffAt
      ? new Date(kickoffAt)
      : now;

  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(fixtureTrackerSettings)
      .where(eq(fixtureTrackerSettings.fixtureId, fixtureId))
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(fixtureTrackerSettings)
        .set({
          trackerActivated: true,
          publicAnimationEnabled: true,
          publicReplayEnabled: wantReplay || existing.publicReplayEnabled,
          matchStartedAt: existing.matchStartedAt ?? startedAt,
          matchStartedBy: existing.matchStartedBy ?? "sdms_auto",
          kickOffConfirmedAt: existing.kickOffConfirmedAt ?? startedAt,
          updatedAt: now,
        })
        .where(eq(fixtureTrackerSettings.fixtureId, fixtureId))
        .returning();
      return {
        trackerActivated: row.trackerActivated,
        publicAnimationEnabled: row.publicAnimationEnabled,
        publicReplayEnabled: row.publicReplayEnabled,
        countdownHeld: row.countdownHeld,
        countdownCancelled: row.countdownCancelled,
        kickOffDelayed: row.kickOffDelayed,
        revisedKickoffAt: row.revisedKickoffAt?.toISOString() ?? null,
        kickOffConfirmedAt: row.kickOffConfirmedAt?.toISOString() ?? null,
        matchStartedAt: row.matchStartedAt?.toISOString() ?? null,
        fullTimeConfirmedAt: row.fullTimeConfirmedAt?.toISOString() ?? null,
      };
    }

    const [row] = await db
      .insert(fixtureTrackerSettings)
      .values({
        fixtureId,
        trackerActivated: true,
        publicAnimationEnabled: true,
        publicReplayEnabled: wantReplay,
        mode: "auto",
        matchStartedAt: startedAt,
        matchStartedBy: "sdms_auto",
        kickOffConfirmedAt: startedAt,
        updatedAt: now,
      })
      .returning();

    return {
      trackerActivated: row.trackerActivated,
      publicAnimationEnabled: row.publicAnimationEnabled,
      publicReplayEnabled: row.publicReplayEnabled,
      countdownHeld: row.countdownHeld,
      countdownCancelled: row.countdownCancelled,
      kickOffDelayed: row.kickOffDelayed,
      revisedKickoffAt: row.revisedKickoffAt?.toISOString() ?? null,
      kickOffConfirmedAt: row.kickOffConfirmedAt?.toISOString() ?? null,
      matchStartedAt: row.matchStartedAt?.toISOString() ?? null,
      fullTimeConfirmedAt: row.fullTimeConfirmedAt?.toISOString() ?? null,
    };
  } catch {
    return (
      settings ?? {
        trackerActivated: true,
        publicAnimationEnabled: true,
        publicReplayEnabled: wantReplay,
        countdownHeld: false,
        countdownCancelled: false,
        kickOffDelayed: false,
        revisedKickoffAt: null,
        kickOffConfirmedAt: startedAt.toISOString(),
        matchStartedAt: startedAt.toISOString(),
        fullTimeConfirmedAt: null,
      }
    );
  }
}

function maxEventMinute(
  rows: Array<{ minute?: number | null }>,
): number {
  let max = 0;
  for (const row of rows) {
    const m = Number(row.minute ?? 0);
    if (Number.isFinite(m) && m > max) max = m;
  }
  return max;
}

export async function buildMatchAnimationPublicPayload(
  data: MatchDetailPageData,
): Promise<MatchAnimationPublicPayload> {
  const { detail, kickoffAt, cmsFixture, entities, venue, referee, lineups } = data;
  const settings = await loadSettings(cmsFixture?.id ?? null);
  const keyEvents = detail.key_events ?? [];
  const sdmsEvents = mapKeyEventsToAnimation(
    keyEvents.map((e) => ({
      id: (e as { match_event_id?: string | number }).match_event_id ?? undefined,
      minute: e.minute,
      type: e.type,
      player_name: e.player_name ?? null,
      player_id: e.player_id ?? null,
      team_id: e.team_id ?? null,
      home_score: e.home_score ?? null,
      away_score: e.away_score ?? null,
    })),
    detail.home_team_id ?? null,
  );
  let events = sdmsEvents;
  const serverNow = new Date().toISOString();

  let cmsHome: number | null = null;
  let cmsAway: number | null = null;
  let cmsStatus: string | null = null;
  let cmsPeriod: string | null = null;
  let cmsMatchMinute = 0;
  let cmsMatchSecond = 0;
  let round: string | null = null;
  let attendance: number | null = null;
  let cmsHomeTeamId: string | null = null;
  let squadLookup: AnimationPlayerLookup[] = [];

  // Keep CMS clock/events current before animation reads them (fixes stuck HT clocks).
  if (cmsFixture?.id) {
    const liveFeed =
      /live|first|second|half\s*time|halftime/i.test(detail.status) ||
      /live|first|second|half/i.test(String(cmsStatus ?? ""));
    if (liveFeed) {
      try {
        await syncFixtureLiveStateFromSdms(cmsFixture.id, detail);
        await syncSdmsLiveEventsFromDetail(cmsFixture.id, detail.match_id, detail);
      } catch (error) {
        console.warn(
          `[match-animation] live feed sync failed for ${detail.match_id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  if (cmsFixture?.id) {
    try {
      const db = getDb();
      const [row] = await db
        .select({
          homeScore: fixtures.homeScore,
          awayScore: fixtures.awayScore,
          status: fixtures.status,
          period: fixtures.period,
          matchMinute: fixtures.matchMinute,
          matchSecond: fixtures.matchSecond,
          round: fixtures.round,
          attendance: fixtures.attendance,
          homeTeamId: fixtures.homeTeamId,
        })
        .from(fixtures)
        .where(eq(fixtures.id, cmsFixture.id))
        .limit(1);
      if (row) {
        cmsHome = row.homeScore;
        cmsAway = row.awayScore;
        cmsStatus = row.status;
        cmsPeriod = row.period;
        cmsMatchMinute = row.matchMinute ?? 0;
        cmsMatchSecond = row.matchSecond ?? 0;
        round = row.round;
        attendance = row.attendance;
        cmsHomeTeamId = row.homeTeamId;
      }

      squadLookup = await db
        .select({
          playerId: players.id,
          name: players.name,
          jerseyNumber: fixturePlayers.jerseyNumber,
          imageUrl: players.imageUrl,
          teamId: fixturePlayers.teamId,
          externalProviderId: players.externalProviderId,
        })
        .from(fixturePlayers)
        .innerJoin(players, eq(fixturePlayers.playerId, players.id))
        .where(eq(fixturePlayers.fixtureId, cmsFixture.id));

      // Prefer CMS events when they are at least as fresh as SDMS (TMO / missed kicks).
      // If CMS lags (e.g. stuck at HT 39'), fall back to the live SDMS timeline.
      const cmsRows = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.fixtureId, cmsFixture.id))
        .orderBy(asc(matchEvents.sequenceNo), asc(matchEvents.minute));
      const cmsMaxMinute = maxEventMinute(cmsRows);
      const sdmsMaxMinute = maxEventMinute(keyEvents);
      if (cmsRows.length > 0 && cmsMaxMinute >= sdmsMaxMinute) {
        const { mapCmsEventsToPublicKeyEvents } = await import("./match-key-events");
        const paired = mapCmsEventsToPublicKeyEvents(
          cmsRows.map((e) => ({
            id: e.id,
            minute: e.minute,
            second: e.second,
            eventType: e.eventType,
            teamId: e.teamId,
            playerId: e.playerId,
            payload: (e.payload ?? {}) as Record<string, unknown>,
          })),
        );
        events = mapKeyEventsToAnimation(
          paired.map((e, index) => {
            // Resolve CMS team UUID from provider team id when pairing rewrote team_id.
            const providerTeamId = e.team_id ?? null;
            const source =
              cmsRows.find((row) => {
                const payload = (row.payload ?? {}) as Record<string, unknown>;
                const pTeam =
                  typeof payload.team_provider_id === "string" ? payload.team_provider_id : null;
                return (
                  row.minute === e.minute &&
                  (pTeam === providerTeamId || row.teamId === providerTeamId)
                );
              }) ?? cmsRows[Math.min(index, cmsRows.length - 1)]!;
            const payload = (source.payload ?? {}) as Record<string, unknown>;
            const jerseyFromPayload =
              typeof payload.jerseyNumber === "number" ? payload.jerseyNumber : null;
            const cmsTeamId = source.teamId;
            return {
              id: `${e.minute}-${e.type}-${e.player_on ?? e.player_off ?? e.player_name ?? index}`,
              minute: e.minute,
              second: e.second ?? 0,
              event_type: e.type,
              player_id: e.player_id ?? null,
              player_name: e.player_name ?? null,
              player_off: e.player_off ?? null,
              player_on: e.player_on ?? null,
              assist_player_name:
                typeof payload.assistPlayerName === "string" ? payload.assistPlayerName : null,
              jersey_number: jerseyFromPayload,
              team_id: cmsTeamId ?? providerTeamId,
              home_team: cmsHomeTeamId && cmsTeamId ? cmsTeamId === cmsHomeTeamId : null,
              home_score: e.home_score ?? null,
              away_score: e.away_score ?? null,
            };
          }),
          cmsHomeTeamId,
        );
      } else {
        events = sdmsEvents;
      }
    } catch {
      /* fall back to detail scores / SDMS events */
      events = sdmsEvents;
    }
  }

  // Lineup jersey fallback when CMS squad is empty.
  if (squadLookup.length === 0 && lineups) {
    const fromLineups: AnimationPlayerLookup[] = [];
    for (const side of ["home", "away"] as const) {
      const pack = lineups[side];
      if (!pack) continue;
      for (const p of [...(pack.starting ?? []), ...(pack.substitutes ?? [])]) {
        const entity = lookupPlayerLink(entities, {
          externalId: p.providerId,
          name: p.name,
        });
        fromLineups.push({
          playerId: entity?.id || p.providerId || `lineup:${side}:${p.name}`,
          name: entity?.name || p.name,
          jerseyNumber: p.jerseyNumber ?? null,
          imageUrl: entity?.imageUrl ?? null,
          teamId: null,
          externalProviderId: p.providerId ?? entity?.externalProviderId ?? null,
        });
      }
    }
    squadLookup = fromLineups;
  }

  // Entity name fallback for CMS player links without squad row.
  for (const link of Object.values(entities.playersByName)) {
    const existing = squadLookup.find((p) => p.playerId === link.id);
    if (existing) {
      if (!existing.imageUrl && link.imageUrl) existing.imageUrl = link.imageUrl;
      continue;
    }
    squadLookup.push({
      playerId: link.id,
      name: link.name,
      jerseyNumber: null,
      imageUrl: link.imageUrl ?? null,
      teamId: null,
      externalProviderId: link.externalProviderId,
    });
  }

  // Fill missing headshots from players table (entity links often omit imageUrl).
  const idsNeedingImage = [
    ...new Set(
      squadLookup
        .filter((p) => !p.imageUrl && p.playerId && !p.playerId.startsWith("lineup:"))
        .map((p) => p.playerId),
    ),
  ];
  if (idsNeedingImage.length > 0) {
    try {
      const db = getDb();
      const rows = await db
        .select({ id: players.id, imageUrl: players.imageUrl, name: players.name })
        .from(players)
        .where(inArray(players.id, idsNeedingImage));
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const p of squadLookup) {
        const row = byId.get(p.playerId);
        if (row?.imageUrl && !p.imageUrl) p.imageUrl = row.imageUrl;
        if (row?.name) p.name = row.name;
      }
    } catch {
      /* keep existing lookup */
    }
  }

  if (squadLookup.length > 0) {
    events = enrichAnimationEventPlayers(events, squadLookup);
  }

  const sdmsPeriod = sdmsStatusToPeriod(detail.status);
  const liveFeed =
    /live|first|second|half\s*time|halftime/i.test(detail.status) ||
    /live|first_half|second_half|half_time/i.test(String(cmsStatus ?? cmsPeriod ?? ""));
  const fixtureStatus = liveFeed
    ? /live|first|second|half/i.test(detail.status)
      ? detail.status
      : (cmsStatus ?? detail.status)
    : (cmsStatus ?? detail.status);
  const period =
    liveFeed && sdmsPeriod !== "not_started" && sdmsPeriod !== "unknown"
      ? sdmsPeriod
      : cmsPeriod && cmsPeriod !== "not_started"
        ? cmsPeriod
        : detail.status;
  // Live animation always prefers the freshest SDMS scoreline over a lagging CMS row.
  const score = liveFeed
    ? {
        home: Number(detail.home_team_score ?? cmsHome ?? 0),
        away: Number(detail.away_team_score ?? cmsAway ?? 0),
        source: "fallback" as const,
      }
    : officialFinalScore({
        cmsHomeScore: cmsHome,
        cmsAwayScore: cmsAway,
        fallbackHomeScore: Number(detail.home_team_score ?? 0),
        fallbackAwayScore: Number(detail.away_team_score ?? 0),
      });
  const sdmsMinute =
    typeof detail.minutes === "number" && Number.isFinite(detail.minutes)
      ? Math.max(0, Math.floor(detail.minutes))
      : 0;
  const sdmsSecond =
    typeof detail.seconds === "number" && Number.isFinite(detail.seconds)
      ? Math.max(0, Math.min(59, Math.floor(detail.seconds)))
      : 0;
  const eventMinute = maxEventMinute(events);
  const matchMinute = liveFeed
    ? Math.max(cmsMatchMinute, sdmsMinute, eventMinute, sdmsPeriod === "half_time" ? 40 : 0)
    : cmsMatchMinute;
  const matchSecond =
    liveFeed && (sdmsMinute > cmsMatchMinute || (sdmsMinute === cmsMatchMinute && sdmsSecond > 0))
      ? sdmsSecond
      : cmsMatchSecond;

  let squadCount = squadLookup.length;
  let performanceStatCount = 0;
  if (cmsFixture?.id) {
    try {
      const db = getDb();
      if (squadCount === 0) {
        const [squadRow] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(fixturePlayers)
          .where(eq(fixturePlayers.fixtureId, cmsFixture.id));
        squadCount = Number(squadRow?.n ?? 0);
      }
      const [perfRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(playerMatchPerformanceStats)
        .where(eq(playerMatchPerformanceStats.fixtureId, cmsFixture.id));
      performanceStatCount = Number(perfRow?.n ?? 0);
    } catch {
      /* keep zero counts */
    }
  }

  const detailedPlayerData = hasDetailedMatchPlayerData({
    eventCount: events.length,
    squadCount,
    performanceStatCount,
    lineups,
    playerStats: data.playerStats,
  });

  const finishedLike =
    /result|finished|complete|full_time|full-time|\bft\b/i.test(fixtureStatus) ||
    /full_time|\bft\b/i.test(period ?? "");
  const liveLike =
    /live|first|second|half\s*time|halftime/i.test(fixtureStatus) ||
    /first_half|second_half|half_time|live/i.test(period ?? "");

  let resolvedSettings = settings;
  if (cmsFixture?.id && detailedPlayerData && (liveLike || finishedLike)) {
    resolvedSettings = await ensureDetailedMatchAnimationActivated(
      cmsFixture.id,
      settings,
      kickoffAt || null,
      { enableReplay: finishedLike || events.length > 0 },
    );
  }

  const availability = resolveMatchAnimationAvailability({
    fixtureStatus,
    period,
    scheduledKickoffAt: kickoffAt || null,
    serverNowIso: serverNow,
    settings: resolvedSettings,
    publishedEventCount: events.length,
    hasDetailedPlayerData: detailedPlayerData,
    hasFullTimeEvent: hasPublishedFullTimeEvent(events),
  });

  const ht = resolveHalfTimeScore(keyEvents);
  const extraTime = /extra|aet|\bet\b/i.test(fixtureStatus);
  const resultKind = resolveMatchResultKind({
    fixtureStatus,
    homeScore: score.home,
    awayScore: score.away,
    extraTime,
  });

  const homeName = detail.home_team_name;
  const awayName = detail.away_team_name;
  const homeImageUrl = entities.homeTeam?.imageUrl ?? detail.home_team_icon ?? null;
  const awayImageUrl = entities.awayTeam?.imageUrl ?? detail.away_team_icon ?? null;
  const venueName = venue?.name ?? detail.venue_name ?? null;
  const refereeName =
    referee?.name ??
    detail.referee?.find((r) => /referee/i.test(r.role))?.name ??
    detail.referee?.[0]?.name ??
    null;

  let matchDateLabel: string | null = null;
  if (kickoffAt) {
    matchDateLabel = new Date(kickoffAt).toLocaleDateString("en-GB", {
      timeZone: DEFAULT_FIXTURES_TIMEZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const potm = data.rugby365PotmName || data.officialPotmName || null;
  const ftConfirmed = isFullTimeConfirmed({
    fixtureStatus,
    fullTimeConfirmedAt: resolvedSettings?.fullTimeConfirmedAt,
    hasFullTimeEvent: hasPublishedFullTimeEvent(events),
  });

  let venueDetails: MatchAnimationPublicPayload["venue"] = venueName
    ? {
        name: venueName,
        city: null,
        country: null,
        capacity: null,
        latitude: null,
        longitude: null,
      }
    : null;
  let weather: MatchAnimationPublicPayload["weather"] = null;
  let homeCoachName = data.homeCoach?.name ?? null;
  let awayCoachName = data.awayCoach?.name ?? null;
  let teamStats: MatchAnimationPublicPayload["teamStats"] = { home: null, away: null };
  let potmImageUrl: string | null = null;
  let potmTeamSide: "home" | "away" | null = null;

  if (cmsFixture?.id) {
    try {
      const db = getDb();
      const [fx] = await db
        .select({
          venueId: fixtures.venueId,
          homeCoachId: fixtures.homeCoachId,
          awayCoachId: fixtures.awayCoachId,
          homeTeamId: fixtures.homeTeamId,
          awayTeamId: fixtures.awayTeamId,
        })
        .from(fixtures)
        .where(eq(fixtures.id, cmsFixture.id))
        .limit(1);

      if (fx?.venueId) {
        let [v] = await db
          .select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            countryName: venues.countryName,
            capacity: venues.capacity,
            latitude: venues.latitude,
            longitude: venues.longitude,
          })
          .from(venues)
          .where(eq(venues.id, fx.venueId))
          .limit(1);
        if (v && (v.latitude == null || v.longitude == null)) {
          await geocodeVenueById(fx.venueId);
          [v] = await db
            .select({
              id: venues.id,
              name: venues.name,
              city: venues.city,
              countryName: venues.countryName,
              capacity: venues.capacity,
              latitude: venues.latitude,
              longitude: venues.longitude,
            })
            .from(venues)
            .where(eq(venues.id, fx.venueId))
            .limit(1);
        }
        if (v) {
          venueDetails = {
            name: v.name,
            city: v.city,
            country: v.countryName,
            capacity: v.capacity,
            latitude: v.latitude,
            longitude: v.longitude,
          };
          if (v.latitude != null && v.longitude != null) {
            weather = await resolveWeatherForVenueCoords({
              venueId: v.id,
              latitude: v.latitude,
              longitude: v.longitude,
              kickoffAt: kickoffAt || null,
            });
          }
        }
      }

      const coachIds = [fx?.homeCoachId, fx?.awayCoachId].filter(Boolean) as string[];
      if (coachIds.length && (!homeCoachName || !awayCoachName)) {
        const coachRows = await db
          .select({ id: coaches.id, name: coaches.name })
          .from(coaches)
          .where(inArray(coaches.id, coachIds));
        const byId = new Map(coachRows.map((c) => [c.id, c.name]));
        if (!homeCoachName && fx?.homeCoachId) homeCoachName = byId.get(fx.homeCoachId) ?? null;
        if (!awayCoachName && fx?.awayCoachId) awayCoachName = byId.get(fx.awayCoachId) ?? null;
      }

      const statRows = await db
        .select()
        .from(teamMatchStats)
        .where(eq(teamMatchStats.fixtureId, cmsFixture.id));
      for (const row of statRows) {
        const side = normalizeTeamStatSide({
          tries: row.tries,
          conversions: row.conversions,
          penalties: row.penalties,
          dropGoals: row.dropGoals,
          carries: row.carries,
          metres: row.metres,
          tackles: row.tackles,
          turnoversWon: row.turnoversWon,
          sections: row.sections,
        });
        if (row.side === "home" || (fx?.homeTeamId && row.teamId === fx.homeTeamId)) {
          teamStats = { ...teamStats, home: side };
        } else if (row.side === "away" || (fx?.awayTeamId && row.teamId === fx.awayTeamId)) {
          teamStats = { ...teamStats, away: side };
        }
      }
    } catch {
      /* keep defaults */
    }
  }

  if (potm) {
    const potmNorm = potm.trim().toLowerCase();
    const match = squadLookup.find((p) => p.name.trim().toLowerCase() === potmNorm);
    if (match) {
      potmImageUrl = match.imageUrl;
      if (match.teamId && cmsHomeTeamId) {
        potmTeamSide = match.teamId === cmsHomeTeamId ? "home" : "away";
      }
    }
  }

  const audio = cmsFixture?.id
    ? await buildMatchAnimationPublicAudio(cmsFixture.id)
    : EMPTY_MATCH_ANIMATION_AUDIO;

  return {
    matchId: detail.match_id,
    cmsFixtureId: cmsFixture?.id ?? null,
    serverNow,
    timeZone: DEFAULT_FIXTURES_TIMEZONE,
    competitionName: detail.competition_name,
    competitionLogoUrl: null,
    home: {
      name: homeName,
      shortName: shortName(homeName),
      imageUrl: homeImageUrl,
      colour: teamAccentColor(homeName, "home"),
    },
    away: {
      name: awayName,
      shortName: shortName(awayName),
      imageUrl: awayImageUrl,
      colour: teamAccentColor(awayName, "away"),
    },
    venueName: venueDetails?.name ?? venueName,
    venue: venueDetails,
    weather,
    homeCoachName,
    awayCoachName,
    scheduledKickoffAt: kickoffAt || null,
    statusLabel: fixtureStatus,
    refereeName,
    homeScore: score.home,
    awayScore: score.away,
    scoreSource: score.source,
    matchMinute,
    matchSecond,
    period: typeof period === "string" ? period : cmsPeriod,
    halfTimeHome: ht?.home ?? null,
    halfTimeAway: ht?.away ?? null,
    round,
    attendance,
    matchDateLabel,
    playerOfTheMatch: potm,
    playerOfTheMatchImageUrl: potmImageUrl,
    playerOfTheMatchTeamSide: potmTeamSide,
    resultKind,
    availability,
    events,
    playerStats: buildMatchAnimationPlayerStats(data.playerStats),
    teamStats,
    settings: resolvedSettings
      ? {
          publicAnimationEnabled: resolvedSettings.publicAnimationEnabled,
          publicReplayEnabled: resolvedSettings.publicReplayEnabled,
          kickOffDelayed: resolvedSettings.kickOffDelayed,
          countdownHeld: resolvedSettings.countdownHeld,
          fullTimeConfirmed: ftConfirmed,
        }
      : null,
    audio,
  };
}

/** Light badge for tab chrome without loading the animation engine. */
export async function getMatchAnimationTabBadge(
  data: MatchDetailPageData,
): Promise<MatchAnimationTabBadge> {
  const payload = await buildMatchAnimationPublicPayload(data);
  return payload.availability.tabBadge;
}
