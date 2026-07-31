import {
  buildPlanetRugbyMatchUrl,
  fetchSdmsHeadToHead,
  fetchSdmsLineups,
  fetchSdmsMatchDetail,
  fetchSdmsMatchPlayerStats,
  fetchSdmsMatchStats,
  fetchSdmsPreviousMeetings,
  mapSdmsLineups,
  sdmsScheduleKickoffIso,
  type MappedLineups,
  type SdmsMatchDetail,
  type SdmsMatchPlayerStats,
  type SdmsMatchStatsBundle,
} from "@rugby365/import-sdk";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { competitions, competitionSeasons, fixtures, matchEvents, players } from "@rugby365/db";
import { getDb } from "./db";
import {
  mapCmsEventsToPublicKeyEvents,
  mapSdmsEventsToPublicKeyEvents,
  type PublicKeyEvent,
} from "./match-key-events";
import { buildMatchEntityContext, type MatchEntityContext } from "./entity-lookup-service";
import { findFixtureBySdmsMatchId, getFixtureById } from "./fixture-admin-service";
import { resolveReferee } from "./entity-admin-service";
import {
  calculateAndPersistFixtureStaffMatchRatings,
  listStaffMatchRatingsForFixture,
  type StaffMatchRatingDisplay,
} from "./staff-match-rating-service";
import { ensureFixtureMatchCoaches } from "./match-coach-resolve-service";
import { getFixtureBonusPoints } from "./fixture-bonus-points-service";
import type { MatchBonusPoints } from "./match-bonus-points";
import { resolveVenue } from "./venue-admin-service";
import { resolveWeatherForVenueId } from "./venue-geocode-service";
import {
  formatBroadcasterLabel,
  listFixtureBroadcasters,
} from "./fixture-broadcasters-service";
import {
  listFixtureSquadPlayerIds,
  syncSdmsMatchEntityLinks,
  ensureSdmsProvidersRegistered,
} from "./match-entity-sync-service";
import {
  attachCareerAndFormToLineupRatings,
  calculateAndPersistFixtureMatchRatings,
  listMatchRatingsForFixture,
  type FixtureMatchRatingsBundle,
  type MatchRatingDisplay,
} from "./match-rating-service";
import { autoImportSdmsMatchToCms } from "./sdms-auto-import-service";
import { isFixtureRatingsPublished } from "./match-rating-math";
import type { CmsEntityLink } from "./match-entity-context";
import type { MatchTableContext } from "./match-table-context";

export type { MatchTableContext } from "./match-table-context";

export type MatchStaffLink = {
  id: string;
  name: string;
  slug: string;
  rating: StaffMatchRatingDisplay | null;
};

export type MatchVenueLink = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  weather?: {
    temperatureC: number | null;
    humidityPct: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
    windCompass: string | null;
    weatherCode?: number | null;
    icon?: import("./weather-condition").WeatherIconKind | null;
    conditionLabel?: string | null;
    observedAt: string | null;
    source: "forecast" | "archive";
  } | null;
};

export type MatchDetailPageData = {
  detail: SdmsMatchDetail;
  lineups: MappedLineups | null;
  matchStats: SdmsMatchStatsBundle | null;
  playerStats: SdmsMatchPlayerStats | null;
  planetRugbyUrl: string;
  kickoffAt: string;
  cmsFixture: {
    id: string;
    slug: string;
    squadCount: number;
    entitySyncRan: boolean;
    autoImported: boolean;
    watchalongYoutubeUrl: string | null;
    highlightsYoutubeUrl: string | null;
  } | null;
  tableContext: MatchTableContext | null;
  entities: MatchEntityContext;
  matchRatings: MatchRatingDisplay[];
  rugby365PotmName: string | null;
  officialPotmName: string | null;
  homeCoach: MatchStaffLink | null;
  awayCoach: MatchStaffLink | null;
  referee: MatchStaffLink | null;
  venue: MatchVenueLink | null;
  /** TV / streaming where-to-watch rows from CMS (and later EPG providers). */
  broadcasters: Array<{
    id: string;
    label: string;
    broadcasterName: string;
    channelName: string | null;
    region: string | null;
    platform: string;
    url: string | null;
  }>;
  bonusPoints: MatchBonusPoints | null;
  /** Key events for public Match Details (CMS preferred, Sub On/Off paired). */
  keyEvents: PublicKeyEvent[];
};

async function resolveMatchTableContext(
  detail: SdmsMatchDetail,
  cmsFixtureRow: { competitionId: string | null; seasonId: string | null } | null,
): Promise<MatchTableContext | null> {
  const db = getDb();
  const sdmsCompId = String(detail.competition_id ?? "").trim();

  let competitionId = cmsFixtureRow?.competitionId ?? null;
  let seasonId = cmsFixtureRow?.seasonId ?? null;
  let competitionName = detail.competition_name;
  let competitionSlug: string | null = null;

  if (competitionId) {
    const [row] = await db
      .select({
        id: competitions.id,
        name: competitions.name,
        slug: competitions.slug,
      })
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);
    if (row) {
      competitionName = row.name;
      competitionSlug = row.slug;
    }
  } else if (sdmsCompId) {
    const [row] = await db
      .select({
        id: competitions.id,
        name: competitions.name,
        slug: competitions.slug,
      })
      .from(competitions)
      .where(
        or(eq(competitions.sdmsCompCode, sdmsCompId), eq(competitions.externalProviderId, sdmsCompId)),
      )
      .limit(1);
    if (row) {
      competitionId = row.id;
      competitionName = row.name;
      competitionSlug = row.slug;
    }
  }

  if (!competitionId) return null;

  if (!seasonId) {
    const [active] = await db
      .select({ id: competitionSeasons.id })
      .from(competitionSeasons)
      .where(
        and(
          eq(competitionSeasons.competitionId, competitionId),
          eq(competitionSeasons.isActive, true),
          eq(competitionSeasons.isDeprecated, false),
        ),
      )
      .limit(1);
    seasonId = active?.id ?? null;
  }

  return {
    competitionId,
    seasonId,
    competitionSlug,
    competitionName,
  };
}

export async function getMatchDetailForPage(matchId: string): Promise<MatchDetailPageData | null> {
  const [detail, lineupsRaw, matchStats, playerStats, previousMeetings, headToHead] = await Promise.all([
    fetchSdmsMatchDetail(matchId),
    fetchSdmsLineups(matchId),
    fetchSdmsMatchStats(matchId),
    fetchSdmsMatchPlayerStats(matchId),
    fetchSdmsPreviousMeetings(matchId),
    fetchSdmsHeadToHead(matchId),
  ]);
  if (!detail) return null;

  if (previousMeetings.length > 0) {
    detail.last_five_meetings = previousMeetings;
  }
  if (headToHead.length > 0) {
    detail.head_to_head = headToHead;
  }

  const lineups = lineupsRaw
    ? mapSdmsLineups(
        lineupsRaw,
        detail.home_team_name,
        detail.away_team_name,
        detail.home_team_id,
        detail.away_team_id,
      )
    : null;

  const planetRugbyUrl = buildPlanetRugbyMatchUrl({
    match_external_id: detail.match_id,
    competition_slug: detail.competition_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    competition_external_id: String(detail.competition_id ?? ""),
    home_team: detail.home_team_slug,
    away_team: detail.away_team_slug,
    match_date: detail.date,
  });

  try {
    await ensureSdmsProvidersRegistered(detail, lineups);
  } catch (error) {
    // Entity registration must never blank the Match Centre (e.g. concurrent player insert races).
    console.warn(
      `[match-detail] ensureSdmsProvidersRegistered failed for ${matchId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  let cmsFixtureRow = await findFixtureBySdmsMatchId(matchId);
  let entitySyncRan = false;
  let autoImported = false;

  if (!cmsFixtureRow) {
    try {
      const imported = await autoImportSdmsMatchToCms(matchId, detail);
      cmsFixtureRow =
        (await findFixtureBySdmsMatchId(matchId)) ??
        (await getFixtureById(imported.fixtureId)) ??
        null;
      entitySyncRan = imported.enriched;
      autoImported = imported.created;
    } catch (error) {
      console.warn(
        `[match-detail] auto-import failed for ${matchId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    try {
      const sync = await syncSdmsMatchEntityLinks(cmsFixtureRow.id, matchId);
      entitySyncRan = sync.synced;
    } catch (error) {
      console.warn(
        `[match-detail] entity sync failed for ${matchId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const squadPlayerIds = cmsFixtureRow ? await listFixtureSquadPlayerIds(cmsFixtureRow.id) : [];

  const entities = await buildMatchEntityContext({
    detail,
    lineups,
    playerStats,
    squadPlayerIds,
  });

  let ratingsBundle: FixtureMatchRatingsBundle = {
    fixtureId: cmsFixtureRow?.id ?? "",
    ratings: [],
    rugby365PotmPlayerId: null,
    officialPotmPlayerId: null,
    officialPotmName: null,
  };

  const fixtureStatus = cmsFixtureRow?.status ?? detail.status ?? "";
  const ratingsPublished = isFixtureRatingsPublished(fixtureStatus);

  if (cmsFixtureRow && ratingsPublished) {
    try {
      // Ensure lineup ratings exist from stored match stats (no separate display formula).
      await calculateAndPersistFixtureMatchRatings(cmsFixtureRow.id);
    } catch {
      // Ratings are best-effort on page load; listing still works if rows exist.
    }
    ratingsBundle = await listMatchRatingsForFixture(cmsFixtureRow.id);
  }

  const rugby365PotmName = ratingsPublished
    ? (ratingsBundle.ratings.find((r) => r.isRugby365Potm)?.playerName ??
      ratingsBundle.ratings.find((r) => r.playerId === ratingsBundle.rugby365PotmPlayerId)?.playerName ??
      null)
    : null;

  // Career (+ Form) before kick-off; Match + refreshed Career after full time.
  const playerLinksById = new Map<string, CmsEntityLink>();
  for (const link of Object.values(entities.playersByExternalId)) {
    playerLinksById.set(link.id, link);
  }
  for (const link of Object.values(entities.playersByName)) {
    playerLinksById.set(link.id, link);
  }
  const unresolvedSquadIds = squadPlayerIds.filter((id) => !playerLinksById.has(id));
  if (unresolvedSquadIds.length > 0) {
    const db = getDb();
    const rows = await db
      .select({
        id: players.id,
        slug: players.slug,
        name: players.name,
        externalProviderId: players.externalProviderId,
      })
      .from(players)
      .where(inArray(players.id, unresolvedSquadIds));
    for (const row of rows) {
      playerLinksById.set(row.id, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        externalProviderId: row.externalProviderId,
      });
    }
  }
  const matchRatings = await attachCareerAndFormToLineupRatings(
    ratingsPublished ? ratingsBundle.ratings : [],
    [...playerLinksById.values()],
  );

  const tableContext = await resolveMatchTableContext(detail, cmsFixtureRow);

  // Ensure coaches are linked (staff rows + curated head-coach defaults) for the header.
  if (cmsFixtureRow) {
    try {
      await ensureFixtureMatchCoaches(cmsFixtureRow.id);
    } catch {
      // non-blocking
    }
  }

  // Reload after match/staff rating calc so coach/ref FKs + ratings are fresh.
  let fixtureWithStaff = cmsFixtureRow ? await getFixtureById(cmsFixtureRow.id) : null;
  let staffBundle = cmsFixtureRow
    ? await listStaffMatchRatingsForFixture(cmsFixtureRow.id)
    : null;

  let venue: MatchVenueLink | null = fixtureWithStaff?.venue
    ? {
        id: fixtureWithStaff.venue.id,
        name: fixtureWithStaff.venue.name,
        slug: fixtureWithStaff.venue.slug,
        city: fixtureWithStaff.venue.city ?? null,
        countryName: fixtureWithStaff.venue.countryName ?? null,
        latitude: fixtureWithStaff.venue.latitude ?? null,
        longitude: fixtureWithStaff.venue.longitude ?? null,
        weather: null,
      }
    : null;

  if (!venue && (detail.venue_name || fixtureWithStaff?.venueName)) {
    const venueName = (detail.venue_name || fixtureWithStaff?.venueName || "").trim();
    if (venueName) {
      try {
        const resolved = await resolveVenue({
          name: venueName,
          teamId: fixtureWithStaff?.homeTeamId ?? undefined,
          createIfMissing: true,
        });
        if (resolved) {
          venue = {
            id: resolved.id,
            name: resolved.name,
            slug: resolved.slug,
            city: resolved.city ?? null,
            countryName: resolved.countryName ?? null,
            latitude: resolved.latitude ?? null,
            longitude: resolved.longitude ?? null,
            weather: null,
          };
          if (cmsFixtureRow && !fixtureWithStaff?.venueId) {
            await getDb()
              .update(fixtures)
              .set({ venueId: resolved.id, venueName: resolved.name })
              .where(eq(fixtures.id, cmsFixtureRow.id));
          }
        }
      } catch {
        // non-blocking
      }
    }
  }

  if (venue) {
    try {
      const kickoffIso =
        fixtureWithStaff?.kickoffAt?.toISOString?.() ??
        (typeof fixtureWithStaff?.kickoffAt === "string"
          ? fixtureWithStaff.kickoffAt
          : null) ??
        sdmsScheduleKickoffIso(detail.date, detail.time);
      venue = {
        ...venue,
        weather: await resolveWeatherForVenueId({
          venueId: venue.id,
          kickoffAt: kickoffIso,
          geocodeIfMissing: true,
        }),
      };
    } catch {
      // non-blocking
    }
  }

  if (!fixtureWithStaff?.referee) {
    const sdmsRef =
      detail.referee?.find((r) => /referee/i.test(r.role)) ?? detail.referee?.[0] ?? null;
    if (sdmsRef?.name && cmsFixtureRow) {
      const resolved = await resolveReferee({
        name: sdmsRef.name,
        externalProviderId: sdmsRef.id || undefined,
        createIfMissing: true,
      });
      if (resolved) {
        try {
          const db = getDb();
          await db
            .update(fixtures)
            .set({ refereeId: resolved.id })
            .where(eq(fixtures.id, cmsFixtureRow.id));
          if (ratingsPublished) {
            await calculateAndPersistFixtureStaffMatchRatings(cmsFixtureRow.id);
          }
          fixtureWithStaff = await getFixtureById(cmsFixtureRow.id);
          staffBundle = await listStaffMatchRatingsForFixture(cmsFixtureRow.id);
        } catch {
          // non-blocking
        }
      }
    }
  }

  const coachRating = (coachId: string | null | undefined) =>
    staffBundle?.coaches.find((c) => c.entityId === coachId) ?? null;

  // Reload after coach ensure so newly linked Stormers / sponsor-alias coaches appear.
  if (cmsFixtureRow) {
    fixtureWithStaff = await getFixtureById(cmsFixtureRow.id);
  }

  const homeCoach: MatchStaffLink | null = fixtureWithStaff?.homeCoach
    ? {
        id: fixtureWithStaff.homeCoach.id,
        name: fixtureWithStaff.homeCoach.name,
        slug: fixtureWithStaff.homeCoach.slug,
        rating: coachRating(fixtureWithStaff.homeCoach.id),
      }
    : null;
  const awayCoach: MatchStaffLink | null = fixtureWithStaff?.awayCoach
    ? {
        id: fixtureWithStaff.awayCoach.id,
        name: fixtureWithStaff.awayCoach.name,
        slug: fixtureWithStaff.awayCoach.slug,
        rating: coachRating(fixtureWithStaff.awayCoach.id),
      }
    : null;

  let bonusPoints: MatchBonusPoints | null = null;
  if (cmsFixtureRow) {
    try {
      bonusPoints = await getFixtureBonusPoints(cmsFixtureRow.id);
    } catch {
      bonusPoints = null;
    }
  }

  const referee: MatchStaffLink | null = fixtureWithStaff?.referee
    ? {
        id: fixtureWithStaff.referee.id,
        name: fixtureWithStaff.referee.name,
        slug: fixtureWithStaff.referee.slug,
        rating: staffBundle?.referee ?? null,
      }
    : null;

  let keyEvents: PublicKeyEvent[] = mapSdmsEventsToPublicKeyEvents(detail.key_events ?? []);
  if (cmsFixtureRow) {
    try {
      const cmsRows = await getDb()
        .select({
          id: matchEvents.id,
          minute: matchEvents.minute,
          second: matchEvents.second,
          eventType: matchEvents.eventType,
          teamId: matchEvents.teamId,
          playerId: matchEvents.playerId,
          payload: matchEvents.payload,
        })
        .from(matchEvents)
        .where(eq(matchEvents.fixtureId, cmsFixtureRow.id))
        .orderBy(asc(matchEvents.sequenceNo), asc(matchEvents.minute), asc(matchEvents.second));
      if (cmsRows.length > 0) {
        keyEvents = mapCmsEventsToPublicKeyEvents(
          cmsRows.map((r) => ({
            ...r,
            payload: (r.payload ?? {}) as Record<string, unknown>,
          })),
        );
      }
    } catch {
      /* keep SDMS-derived key events */
    }
  }

  let broadcasters: MatchDetailPageData["broadcasters"] = [];
  if (cmsFixtureRow?.id) {
    try {
      const rows = await listFixtureBroadcasters(cmsFixtureRow.id);
      broadcasters = rows.map((row) => ({
        id: row.id,
        label: formatBroadcasterLabel(row),
        broadcasterName: row.broadcasterName,
        channelName: row.channelName,
        region: row.region,
        platform: row.platform,
        url: row.url,
      }));
    } catch {
      broadcasters = [];
    }
  }

  return {
    detail,
    lineups,
    matchStats,
    playerStats,
    planetRugbyUrl,
    kickoffAt: sdmsScheduleKickoffIso(detail.date, detail.time),
    cmsFixture: cmsFixtureRow
      ? {
          id: cmsFixtureRow.id,
          slug: cmsFixtureRow.slug,
          squadCount: squadPlayerIds.length,
          entitySyncRan,
          autoImported,
          watchalongYoutubeUrl: cmsFixtureRow.watchalongYoutubeUrl ?? null,
          highlightsYoutubeUrl: cmsFixtureRow.highlightsYoutubeUrl ?? null,
        }
      : null,
    tableContext,
    entities,
    matchRatings,
    rugby365PotmName,
    officialPotmName: ratingsBundle.officialPotmName,
    homeCoach,
    awayCoach,
    referee,
    bonusPoints,
    venue,
    broadcasters,
    keyEvents,
  };
}
