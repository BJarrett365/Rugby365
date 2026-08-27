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
import { after } from "next/server";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import {
  competitions,
  competitionSeasons,
  fixtures,
  matchEvents,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  mapCmsEventsToPublicKeyEvents,
  mapSdmsEventsToPublicKeyEvents,
  selectPublicKeyEvents,
  type PublicKeyEvent,
} from "./match-key-events";
import { buildMatchEntityContext, type MatchEntityContext } from "./entity-lookup-service";
import { findFixtureBySdmsMatchId, getFixtureById } from "./fixture-admin-service";
import { resolveReferee } from "./entity-admin-service";
import {
  ensureMissingFixtureStaffMatchRatings,
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
  ensureSdmsProvidersRegistered,
  ensureSdmsTeamsRegistered,
} from "./match-entity-sync-service";
import { syncFixtureLiveStateFromSdms } from "./fixture-live-score-sync";
import { isLiveFixtureStatus } from "./table-lab/live-table-service";
import {
  attachCareerAndFormToLineupRatings,
  ensureMissingFixturePlayerCareerRatings,
  ensureMissingFixturePlayerMatchRatings,
  listMatchRatingsForFixture,
  type FixtureMatchRatingsBundle,
  type MatchRatingDisplay,
} from "./match-rating-service";
import { autoImportSdmsMatchToCms } from "./sdms-auto-import-service";
import { isFixtureRatingsPublished } from "./match-rating-math";
import type { MatchTableContext } from "./match-table-context";
import { resolveTeamCrestImageUrl } from "./crest-library-service";
import { resolveApprovedTeamShirt } from "./shirt-library-service";
import type { ShirtSvgConfig } from "./shirt-library-types";

export type { MatchTableContext } from "./match-table-context";

export type MatchLineupKit = {
  kitType: string;
  svgConfig: ShirtSvgConfig;
  crestUrl: string | null;
  isFallback: boolean;
};

async function resolveMatchLineupKit(input: {
  teamId: string | null | undefined;
  teamName: string;
  competitionId: string | null | undefined;
  seasonId: string | null | undefined;
  matchId: string | null | undefined;
  kitType: "HOME" | "AWAY";
}): Promise<MatchLineupKit | null> {
  if (!input.teamId) return null;
  try {
    const [shirt, crestUrl] = await Promise.all([
      resolveApprovedTeamShirt({
        teamId: input.teamId,
        teamName: input.teamName,
        competitionId: input.competitionId,
        seasonId: input.seasonId,
        matchId: input.matchId,
        kitType: input.kitType,
      }),
      resolveTeamCrestImageUrl(input.teamId),
    ]);
    if (shirt.isFallback) return null;
    return {
      kitType: String(shirt.kitType),
      svgConfig: shirt.svgConfig,
      crestUrl,
      isFallback: false,
    };
  } catch {
    return null;
  }
}

export type MatchStaffLink = {
  id: string;
  name: string;
  slug: string;
  rating: StaffMatchRatingDisplay | null;
};

const MATCH_ENSURE_BUDGET_MS = 800;
const matchSelfHealInflight = new Set<string>();

function raceWithBudget<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * SDMS enrich + sequential career ratings are too heavy for Match Centre RSC.
 * Run them after the response so the page reads existing DB rows quickly.
 */
function scheduleMatchDataSelfHeal(fixtureId: string, matchId: string): void {
  if (matchSelfHealInflight.has(fixtureId)) return;
  matchSelfHealInflight.add(fixtureId);
  const work = async () => {
    try {
      await ensureMissingFixturePlayerMatchRatings(fixtureId, { matchId });
      await ensureMissingFixturePlayerCareerRatings(fixtureId);
    } catch (error) {
      console.warn(
        `[match-detail] background self-heal failed for ${fixtureId}:`,
        error instanceof Error ? error.message : error,
      );
    } finally {
      matchSelfHealInflight.delete(fixtureId);
    }
  };
  try {
    after(() => {
      void work();
    });
  } catch {
    void work();
  }
}

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
  /** Planet Rugby / SDMS competition code (e.g. pd9ro98v), not numeric internal ids. */
  competitionExternalId: string | null;
  kickoffAt: string;
  cmsFixture: {
    id: string;
    slug: string;
    seasonId: string | null;
    /** CMS fixture status (e.g. full_time). Prefer this for ratings publish gating. */
    status: string | null;
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
  /** Public profile slug for Rugby365 POTM when known. */
  rugby365PotmSlug: string | null;
  officialPotmName: string | null;
  officialPotmSlug: string | null;
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
  /** Approved Shirt Library kits for lineup pitch (null side = use accent fallback jersey). */
  lineupKits: {
    home: MatchLineupKit | null;
    away: MatchLineupKit | null;
  };
};

async function resolveMatchTableContext(
  detail: SdmsMatchDetail,
  cmsFixtureRow: {
    id?: string | null;
    competitionId: string | null;
    seasonId: string | null;
    status?: string | null;
    externalMatchId?: string | null;
  } | null,
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

  const fixtureStatus = cmsFixtureRow?.status ?? detail.status ?? "";
  return {
    competitionId,
    seasonId,
    competitionSlug,
    competitionName,
    fixtureId: cmsFixtureRow?.id ?? null,
    externalMatchId: cmsFixtureRow?.externalMatchId ?? detail.match_id ?? null,
    isLive: isLiveFixtureStatus(fixtureStatus) || isLiveFixtureStatus(detail.status),
  };
}

function competitionCodeFromPlanetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // /matches/{id}/{compSlug}/{compId}/...
    const code = parts[3]?.trim() || null;
    return code && !/^\d+$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

async function resolveCompetitionExternalId(
  detail: SdmsMatchDetail,
  cmsFixtureRow: {
    competitionId: string | null;
    planetRugbyUrl?: string | null;
  } | null,
): Promise<string | null> {
  const fromDetail = String(detail.competition_id ?? "").trim();
  if (fromDetail && !/^\d+$/.test(fromDetail)) return fromDetail;

  const fromStoredUrl = competitionCodeFromPlanetUrl(cmsFixtureRow?.planetRugbyUrl);
  if (fromStoredUrl) return fromStoredUrl;

  const competitionId = cmsFixtureRow?.competitionId;
  if (!competitionId) return null;

  const db = getDb();
  const [row] = await db
    .select({
      sdmsCompCode: competitions.sdmsCompCode,
      externalProviderId: competitions.externalProviderId,
    })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  const code = String(row?.sdmsCompCode ?? row?.externalProviderId ?? "").trim();
  return code && !/^\d+$/.test(code) ? code : null;
}

export async function getMatchDetailForPage(
  matchId: string,
  options: { tab?: string } = {},
): Promise<MatchDetailPageData | null> {
  const __t0 = performance.now();
  const __mark = (label: string) => {
    if (process.env.MATCH_DETAIL_PROFILE === "1") {
      console.log(`[match-detail ${matchId}] ${label}: ${(performance.now() - __t0).toFixed(0)}ms`);
    }
  };
  // Soft navigation RSC flights abort around ~10–15s under load. Keep the page
  // budget under that so Link clicks never surface as "network error".
  const PAGE_MS = 4_000;
  const SECONDARY_MS = 2_500;
  const tab = (options.tab ?? "details").toLowerCase();
  const needPlayerStats = tab === "player-stats" || tab === "stats";
  const needMeetings = tab === "head-to-head" || tab === "betting";

  // Player-stat category fan-out (10 SDMS calls) raced with a short budget so it
  // cannot stall Match Centre / trigger Next.js client "network error".
  const emptyPlayerStats = {
    home: { attack: null, defend: null, kicking: null, errors: null, carries: null },
    away: { attack: null, defend: null, kicking: null, errors: null, carries: null },
  } as Awaited<ReturnType<typeof fetchSdmsMatchPlayerStats>>;

  const playerStatsPromise = needPlayerStats
    ? Promise.race([
        fetchSdmsMatchPlayerStats(matchId, { timeoutMs: SECONDARY_MS }),
        new Promise<typeof emptyPlayerStats>((resolve) =>
          setTimeout(() => resolve(emptyPlayerStats), 1_500),
        ),
      ])
    : Promise.resolve(emptyPlayerStats);

  const [detail, lineupsRaw, matchStats, previousMeetings, headToHead, playerStats] = await Promise.all([
    fetchSdmsMatchDetail(matchId, { timeoutMs: PAGE_MS }),
    fetchSdmsLineups(matchId, { timeoutMs: SECONDARY_MS }),
    fetchSdmsMatchStats(matchId, { timeoutMs: SECONDARY_MS }),
    needMeetings
      ? fetchSdmsPreviousMeetings(matchId, { timeoutMs: SECONDARY_MS })
      : Promise.resolve([] as Awaited<ReturnType<typeof fetchSdmsPreviousMeetings>>),
    needMeetings
      ? fetchSdmsHeadToHead(matchId, { timeoutMs: SECONDARY_MS })
      : Promise.resolve([] as Awaited<ReturnType<typeof fetchSdmsHeadToHead>>),
    playerStatsPromise,
  ]);
  __mark("sdms");
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

  let cmsFixtureRow = await findFixtureBySdmsMatchId(matchId);
  __mark("findFixture");
  let entitySyncRan = false;
  let autoImported = false;

  // Only upsert teams when this match isn't linked yet — avoid ~400ms DB round-trips
  // on every soft-nav into an already-imported fixture.
  if (!cmsFixtureRow?.homeTeamId || !cmsFixtureRow?.awayTeamId) {
    try {
      await ensureSdmsTeamsRegistered(detail);
    } catch (error) {
      console.warn(
        `[match-detail] ensureSdmsTeamsRegistered failed for ${matchId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!cmsFixtureRow) {
    try {
      // Auto-import can fan out into entity sync — never let it blow the RSC budget.
      const imported = await Promise.race([
        autoImportSdmsMatchToCms(matchId, detail),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000)),
      ]);
      if (imported) {
        cmsFixtureRow =
          (await findFixtureBySdmsMatchId(matchId)) ??
          (await getFixtureById(imported.fixtureId)) ??
          null;
        entitySyncRan = imported.enriched;
        autoImported = imported.created;
      } else {
        cmsFixtureRow = await findFixtureBySdmsMatchId(matchId);
      }
    } catch (error) {
      console.warn(
        `[match-detail] auto-import failed for ${matchId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    const cmsPublished = isFixtureRatingsPublished(cmsFixtureRow.status);
    const sdmsPublished = isFixtureRatingsPublished(detail.status);
    const shouldSyncLive =
      isLiveFixtureStatus(cmsFixtureRow.status) ||
      isLiveFixtureStatus(detail.status) ||
      // SDMS already Result/FT but CMS still scheduled/live — without this, match
      // ratings never unlock (ensureMissing bails when CMS status isn't published).
      (sdmsPublished && !cmsPublished);
    if (shouldSyncLive) {
      try {
        // Score/clock/status only — do not re-enrich squads/events on public RSC.
        const synced = await syncFixtureLiveStateFromSdms(cmsFixtureRow.id, detail);
        if (synced.patch.status) {
          cmsFixtureRow = { ...cmsFixtureRow, status: synced.patch.status };
        }
      } catch (error) {
        console.warn(
          `[match-detail] live score sync failed for ${matchId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  const competitionExternalIdPromise = resolveCompetitionExternalId(detail, cmsFixtureRow);
  const squadPlayerIdsPromise = cmsFixtureRow
    ? listFixtureSquadPlayerIds(cmsFixtureRow.id)
    : Promise.resolve([] as string[]);
  const ratingsPromise = cmsFixtureRow
    ? (async () => {
        // Prefer CMS status, but treat SDMS Result/FT as published so a stale CMS
        // row cannot blank the lineups ratings tab after full time.
        const ratingsStatus =
          isFixtureRatingsPublished(cmsFixtureRow.status) ||
          isFixtureRatingsPublished(detail.status)
            ? cmsFixtureRow.status && isFixtureRatingsPublished(cmsFixtureRow.status)
              ? cmsFixtureRow.status
              : detail.status
            : cmsFixtureRow.status;
        if (isFixtureRatingsPublished(ratingsStatus)) {
          // Lineups tab: allow a longer DB calc wait so first paint isn't empty when
          // perf rows already exist. SDMS enrich still stays off-request (after heal).
          const ensureBudgetMs =
            tab === "lineups" ? Math.max(MATCH_ENSURE_BUDGET_MS, 2_500) : MATCH_ENSURE_BUDGET_MS;
          const ensureResult = await raceWithBudget(
            ensureMissingFixturePlayerMatchRatings(cmsFixtureRow.id, {
              matchId,
              allowSdmsEnrich: false,
            }),
            ensureBudgetMs,
          );
          if (
            ensureResult == null ||
            ensureResult.triggered ||
            ensureResult.needsSdmsEnrich
          ) {
            scheduleMatchDataSelfHeal(cmsFixtureRow.id, matchId);
          }
        }
        return listMatchRatingsForFixture(cmsFixtureRow.id);
      })().catch(
        () =>
          ({
            fixtureId: cmsFixtureRow.id,
            ratings: [],
            rugby365PotmPlayerId: null,
            officialPotmPlayerId: null,
            officialPotmName: null,
          }) satisfies FixtureMatchRatingsBundle,
      )
    : Promise.resolve({
        fixtureId: "",
        ratings: [],
        rugby365PotmPlayerId: null,
        officialPotmPlayerId: null,
        officialPotmName: null,
      } satisfies FixtureMatchRatingsBundle);
  const coachesPromise =
    cmsFixtureRow != null
      ? Promise.race([
          ensureFixtureMatchCoaches(cmsFixtureRow.id).catch(() => undefined),
          new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
        ])
      : Promise.resolve();
  // Reload fixture after coach resolve so newly assigned home/away coaches appear
  // on the same request (parallel getFixtureById used to race ahead of the write).
  const fixturePromise = (async () => {
    if (!cmsFixtureRow) return null;
    await coachesPromise;
    return getFixtureById(cmsFixtureRow.id);
  })();
  // Wait for coach links, then fill any missing staff ratings (coach linked after
  // the first ratings pass used to leave header ratings blank).
  const staffPromise = (async () => {
    if (!cmsFixtureRow) return null;
    await coachesPromise;
    await raceWithBudget(
      ensureMissingFixtureStaffMatchRatings(cmsFixtureRow.id),
      MATCH_ENSURE_BUDGET_MS,
    );
    return listStaffMatchRatingsForFixture(cmsFixtureRow.id);
  })();
  const tableContextPromise = resolveMatchTableContext(detail, cmsFixtureRow);
  const bonusPromise = cmsFixtureRow
    ? getFixtureBonusPoints(cmsFixtureRow.id).catch(() => null)
    : Promise.resolve(null);
  const eventsPromise = cmsFixtureRow
    ? Promise.resolve(
        getDb()
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
          .orderBy(asc(matchEvents.sequenceNo), asc(matchEvents.minute), asc(matchEvents.second)),
      ).catch(
        () =>
          [] as Array<{
            id: string;
            minute: number | null;
            second: number | null;
            eventType: string;
            teamId: string | null;
            playerId: string | null;
            payload: unknown;
          }>,
      )
    : Promise.resolve(
        [] as Array<{
          id: string;
          minute: number | null;
          second: number | null;
          eventType: string;
          teamId: string | null;
          playerId: string | null;
          payload: unknown;
        }>,
      );
  const broadcastersPromise = cmsFixtureRow
    ? listFixtureBroadcasters(cmsFixtureRow.id).catch(() => [])
    : Promise.resolve([]);
  const kitsPromise = Promise.race([
    Promise.all([
      resolveMatchLineupKit({
        teamId: cmsFixtureRow?.homeTeamId,
        teamName: detail.home_team_name,
        competitionId: cmsFixtureRow?.competitionId,
        seasonId: cmsFixtureRow?.seasonId,
        matchId: cmsFixtureRow?.id,
        kitType: "HOME",
      }),
      resolveMatchLineupKit({
        teamId: cmsFixtureRow?.awayTeamId,
        teamName: detail.away_team_name,
        competitionId: cmsFixtureRow?.competitionId,
        seasonId: cmsFixtureRow?.seasonId,
        matchId: cmsFixtureRow?.id,
        kitType: "HOME",
      }),
    ]),
    new Promise<[null, null]>((resolve) => setTimeout(() => resolve([null, null]), 700)),
  ]);

  const [
    competitionExternalId,
    squadPlayerIds,
    ratingsListed,
    ,
    tableContext,
    fixtureLoaded,
    staffLoaded,
    bonusResult,
    cmsEventRows,
    broadcasterRows,
    kitPair,
  ] = await Promise.all([
    competitionExternalIdPromise,
    squadPlayerIdsPromise,
    ratingsPromise,
    coachesPromise,
    tableContextPromise,
    fixturePromise,
    staffPromise,
    bonusPromise,
    eventsPromise,
    broadcastersPromise,
    kitsPromise,
  ]);
  __mark("cms-parallel");

  const planetRugbyUrl =
    (cmsFixtureRow?.planetRugbyUrl &&
    !/\/matches\/[^/]+\/[^/]+\/\d+\//.test(cmsFixtureRow.planetRugbyUrl)
      ? cmsFixtureRow.planetRugbyUrl
      : null) ??
    buildPlanetRugbyMatchUrl({
      match_external_id: detail.match_id,
      competition_slug: detail.competition_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      competition_external_id: competitionExternalId ?? String(detail.competition_id ?? ""),
      home_team: detail.home_team_slug,
      away_team: detail.away_team_slug,
      match_date: detail.date,
    });

  // Player Stats / Line Up tabs need CMS profiles so names can link to /players/[slug].
  if (needPlayerStats || tab === "lineups") {
    try {
      await Promise.race([
        ensureSdmsProvidersRegistered(detail, lineups, needPlayerStats ? playerStats : null),
        new Promise<void>((resolve) => setTimeout(resolve, 4_000)),
      ]);
    } catch (error) {
      console.warn(
        `[match-detail] ensureSdmsProvidersRegistered failed for ${matchId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const entities = await buildMatchEntityContext({
    detail,
    lineups,
    playerStats,
    squadPlayerIds,
  });
  __mark("entities");

  let ratingsBundle: FixtureMatchRatingsBundle = ratingsListed;
  const fixtureStatus =
    isFixtureRatingsPublished(cmsFixtureRow?.status ?? "") ||
    isFixtureRatingsPublished(detail.status ?? "")
      ? isFixtureRatingsPublished(cmsFixtureRow?.status ?? "")
        ? (cmsFixtureRow?.status ?? detail.status ?? "")
        : (detail.status ?? cmsFixtureRow?.status ?? "")
      : (cmsFixtureRow?.status ?? detail.status ?? "");
  const ratingsPublished = isFixtureRatingsPublished(fixtureStatus);
  __mark("ratings");

  const rugby365PotmName = ratingsPublished
    ? (ratingsBundle.ratings.find((r) => r.isRugby365Potm)?.playerName ??
      ratingsBundle.ratings.find((r) => r.playerId === ratingsBundle.rugby365PotmPlayerId)?.playerName ??
      null)
    : null;

  const potmPlayerIds = [
    ...new Set(
      [
        ratingsPublished ? ratingsBundle.rugby365PotmPlayerId : null,
        ratingsPublished ? ratingsBundle.officialPotmPlayerId : null,
        ratingsPublished
          ? (ratingsBundle.ratings.find((r) => r.isRugby365Potm)?.playerId ?? null)
          : null,
        ratingsPublished
          ? (ratingsBundle.ratings.find((r) => r.isOfficialPotm)?.playerId ?? null)
          : null,
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const potmSlugById = new Map<string, string>();
  if (potmPlayerIds.length > 0) {
    const db = getDb();
    const potmRows = await db
      .select({ id: players.id, slug: players.slug })
      .from(players)
      .where(inArray(players.id, potmPlayerIds));
    for (const row of potmRows) potmSlugById.set(row.id, row.slug);
  }
  const rugby365PotmPlayerId =
    ratingsBundle.rugby365PotmPlayerId ??
    ratingsBundle.ratings.find((r) => r.isRugby365Potm)?.playerId ??
    null;
  const officialPotmPlayerId =
    ratingsBundle.officialPotmPlayerId ??
    ratingsBundle.ratings.find((r) => r.isOfficialPotm)?.playerId ??
    null;
  const rugby365PotmSlug = rugby365PotmPlayerId
    ? (potmSlugById.get(rugby365PotmPlayerId) ?? null)
    : null;
  const officialPotmSlug = officialPotmPlayerId
    ? (potmSlugById.get(officialPotmPlayerId) ?? null)
    : null;

  let matchRatings: MatchRatingDisplay[] = ratingsPublished ? ratingsBundle.ratings : [];
  if (ratingsPublished && cmsFixtureRow) {
    const playerLinks = Object.values(entities.playersByExternalId);
    try {
      matchRatings = await attachCareerAndFormToLineupRatings(matchRatings, playerLinks);
    } catch {
      // Career/form fallback is best-effort for lineup display.
    }
  }

  let fixtureWithStaff = fixtureLoaded;
  let staffBundle = staffLoaded;

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
      // Never geocode during Match Centre render — that external call was adding
      // multi-second hangs and contributed to client "network error" timeouts.
      const weatherPromise = resolveWeatherForVenueId({
        venueId: venue.id,
        kickoffAt: kickoffIso,
        geocodeIfMissing: false,
      });
      const weather = await Promise.race([
        weatherPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
      ]);
      venue = { ...venue, weather };
    } catch {
      // non-blocking
    }
  }
  __mark("venue+weather");

  const coachRating = (coachId: string | null | undefined) =>
    staffBundle?.coaches.find((c) => c.entityId === coachId) ?? null;

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

  const bonusPoints: MatchBonusPoints | null = bonusResult;
  const sdmsKeyEvents = mapSdmsEventsToPublicKeyEvents(detail.key_events ?? []);
  const cmsKeyEvents =
    cmsEventRows.length > 0
      ? mapCmsEventsToPublicKeyEvents(
          cmsEventRows.map((r) => ({
            ...r,
            payload: (r.payload ?? {}) as Record<string, unknown>,
          })),
        )
      : [];
  const keyEvents = selectPublicKeyEvents(sdmsKeyEvents, cmsKeyEvents);
  const broadcasters: MatchDetailPageData["broadcasters"] = broadcasterRows.map((row) => ({
    id: row.id,
    label: formatBroadcasterLabel(row),
    broadcasterName: row.broadcasterName,
    channelName: row.channelName,
    region: row.region,
    platform: row.platform,
    url: row.url,
  }));

  // Missing referee linking is admin/background work — do not block Match Centre.
  if (!fixtureWithStaff?.referee && cmsFixtureRow) {
    const sdmsRef =
      detail.referee?.find((r) => /referee/i.test(r.role)) ?? detail.referee?.[0] ?? null;
    if (sdmsRef?.name) {
      void resolveReferee({
        name: sdmsRef.name,
        externalProviderId: sdmsRef.id || undefined,
        createIfMissing: true,
      })
        .then(async (resolved) => {
          if (!resolved || !cmsFixtureRow) return;
          await getDb()
            .update(fixtures)
            .set({ refereeId: resolved.id, refereeName: resolved.name })
            .where(eq(fixtures.id, cmsFixtureRow.id));
        })
        .catch(() => undefined);
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

  const [homeKit, awayKit] = kitPair;
  __mark("done");

  return {
    detail,
    lineups,
    matchStats,
    playerStats,
    planetRugbyUrl,
    competitionExternalId,
    kickoffAt: sdmsScheduleKickoffIso(detail.date, detail.time),
    cmsFixture: cmsFixtureRow
      ? {
          id: cmsFixtureRow.id,
          slug: cmsFixtureRow.slug,
          seasonId: cmsFixtureRow.seasonId ?? null,
          status: cmsFixtureRow.status ?? null,
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
    rugby365PotmSlug,
    officialPotmName: ratingsBundle.officialPotmName,
    officialPotmSlug,
    homeCoach,
    awayCoach,
    referee,
    bonusPoints,
    venue,
    broadcasters,
    keyEvents,
    lineupKits: { home: homeKit, away: awayKit },
  };
}
