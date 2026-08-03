import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import {
  coaches,
  fixturePlayers,
  fixtures,
  fixtureTrackerSettings,
  matchEvents,
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

export async function buildMatchAnimationPublicPayload(
  data: MatchDetailPageData,
): Promise<MatchAnimationPublicPayload> {
  const { detail, kickoffAt, cmsFixture, entities, venue, referee, lineups } = data;
  const settings = await loadSettings(cmsFixture?.id ?? null);
  const keyEvents = detail.key_events ?? [];
  let events = mapKeyEventsToAnimation(
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

      // Prefer published CMS match events when present (includes TMO / missed conversion).
      const cmsRows = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.fixtureId, cmsFixture.id))
        .orderBy(asc(matchEvents.sequenceNo), asc(matchEvents.minute));
      if (cmsRows.length > 0) {
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
      }
    } catch {
      /* fall back to detail scores / SDMS events */
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

  const fixtureStatus = cmsStatus ?? detail.status;
  const score = officialFinalScore({
    cmsHomeScore: cmsHome,
    cmsAwayScore: cmsAway,
    fallbackHomeScore: Number(detail.home_team_score ?? 0),
    fallbackAwayScore: Number(detail.away_team_score ?? 0),
  });

  const availability = resolveMatchAnimationAvailability({
    fixtureStatus,
    period: cmsPeriod,
    scheduledKickoffAt: kickoffAt || null,
    serverNowIso: serverNow,
    settings,
    publishedEventCount: events.length,
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
    fullTimeConfirmedAt: settings?.fullTimeConfirmedAt,
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
    matchMinute: cmsMatchMinute,
    matchSecond: cmsMatchSecond,
    period: cmsPeriod,
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
    settings: settings
      ? {
          publicAnimationEnabled: settings.publicAnimationEnabled,
          publicReplayEnabled: settings.publicReplayEnabled,
          kickOffDelayed: settings.kickOffDelayed,
          countdownHeld: settings.countdownHeld,
          fullTimeConfirmed: ftConfirmed,
        }
      : null,
  };
}

/** Light badge for tab chrome without loading the animation engine. */
export async function getMatchAnimationTabBadge(
  data: MatchDetailPageData,
): Promise<MatchAnimationTabBadge> {
  const payload = await buildMatchAnimationPublicPayload(data);
  return payload.availability.tabBadge;
}
