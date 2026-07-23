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
import { and, eq, or } from "drizzle-orm";
import { competitions, competitionSeasons } from "@rugby365/db";
import { getDb } from "./db";
import { buildMatchEntityContext, type MatchEntityContext } from "./entity-lookup-service";
import { findFixtureBySdmsMatchId, getFixtureById } from "./fixture-admin-service";
import {
  listFixtureSquadPlayerIds,
  syncSdmsMatchEntityLinks,
  ensureSdmsProvidersRegistered,
} from "./match-entity-sync-service";
import {
  calculateAndPersistFixtureMatchRatings,
  listCareerRatingsForPlayerIds,
  listMatchRatingsForFixture,
  type FixtureMatchRatingsBundle,
  type MatchRatingDisplay,
} from "./match-rating-service";
import { autoImportSdmsMatchToCms } from "./sdms-auto-import-service";
import { CAREER_RATING_MODEL, MATCH_RATING_MODEL, isFixtureRatingsPublished } from "./match-rating-math";
import type { MatchTableContext } from "./match-table-context";

export type { MatchTableContext } from "./match-table-context";

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
  } | null;
  tableContext: MatchTableContext | null;
  entities: MatchEntityContext;
  matchRatings: MatchRatingDisplay[];
  rugby365PotmName: string | null;
  officialPotmName: string | null;
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

  await ensureSdmsProvidersRegistered(detail, lineups);

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

  // Ensure Career Ratings appear on line-ups even when Match Ratings are missing.
  let matchRatings = ratingsPublished ? ratingsBundle.ratings : [];
  if (ratingsPublished) {
    const careerTargets = new Set<string>([
      ...squadPlayerIds,
      ...Object.values(entities.playersByExternalId).map((p) => p.id),
    ]);
    const missingCareerIds = [...careerTargets].filter(
      (id) => !matchRatings.some((r) => r.playerId === id),
    );
    if (missingCareerIds.length) {
      const careerMap = await listCareerRatingsForPlayerIds(missingCareerIds);
      const byId = new Map(
        Object.values(entities.playersByExternalId).map((p) => [p.id, p] as const),
      );
      const byName = new Map(
        Object.values(entities.playersByName).map((p) => [p.id, p] as const),
      );
      for (const playerId of missingCareerIds) {
        const career = careerMap.get(playerId);
        if (career == null) continue;
        const link = byId.get(playerId) ?? byName.get(playerId);
        matchRatings = [
          ...matchRatings,
          {
            playerId,
            externalPlayerId: link?.externalProviderId ?? null,
            teamId: "",
            playerName: link?.name ?? "Player",
            jerseyNumber: null,
            positionName: null,
            squadRole: "starter",
            minutesPlayed: 0,
            careerRating: career,
            careerModel: CAREER_RATING_MODEL,
            rating: null,
            matchModel: MATCH_RATING_MODEL,
            ratingStatus: "unavailable",
            performanceBand: null,
            ratingLabel: "—",
            ratingExplanation: null,
            positiveImpacts: [],
            deductions: [],
            matchContext: [],
            formRating: null,
            formTrend: null,
            formLabel: "—",
            previousRating: null,
            ratingChange: null,
            performanceTrend: null,
            performanceTrendLabel: "NEW",
            selectionPreviousRole: null,
            selectionCurrentRole: null,
            selectionTrend: null,
            selectionBadge: null,
            isRugby365Potm: false,
            isOfficialPotm: false,
          },
        ];
      }
    }
  }

  const tableContext = await resolveMatchTableContext(detail, cmsFixtureRow);

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
        }
      : null,
    tableContext,
    entities,
    matchRatings,
    rugby365PotmName,
    officialPotmName: ratingsBundle.officialPotmName,
  };
}
