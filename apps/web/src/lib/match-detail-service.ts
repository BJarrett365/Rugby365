import {
  buildPlanetRugbyMatchUrl,
  fetchSdmsLineups,
  fetchSdmsMatchDetail,
  fetchSdmsMatchPlayerStats,
  fetchSdmsMatchStats,
  mapSdmsLineups,
  sdmsScheduleKickoffIso,
  type MappedLineups,
  type SdmsMatchDetail,
  type SdmsMatchPlayerStats,
  type SdmsMatchStatsBundle,
} from "@rugby365/import-sdk";
import { buildMatchEntityContext, type MatchEntityContext } from "./entity-lookup-service";
import { findFixtureByExternalMatchId } from "./fixture-admin-service";
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
  entities: MatchEntityContext;
  matchRatings: MatchRatingDisplay[];
  rugby365PotmName: string | null;
  officialPotmName: string | null;
};

export async function getMatchDetailForPage(matchId: string): Promise<MatchDetailPageData | null> {
  const [detail, lineupsRaw, matchStats, playerStats] = await Promise.all([
    fetchSdmsMatchDetail(matchId),
    fetchSdmsLineups(matchId),
    fetchSdmsMatchStats(matchId),
    fetchSdmsMatchPlayerStats(matchId),
  ]);
  if (!detail) return null;

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

  let cmsFixtureRow = await findFixtureByExternalMatchId(matchId);
  let entitySyncRan = false;
  let autoImported = false;

  if (!cmsFixtureRow) {
    const imported = await autoImportSdmsMatchToCms(matchId, detail);
    cmsFixtureRow = await findFixtureByExternalMatchId(matchId);
    entitySyncRan = imported.enriched;
    autoImported = imported.created;
  } else {
    const sync = await syncSdmsMatchEntityLinks(cmsFixtureRow.id, matchId);
    entitySyncRan = sync.synced;
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
    entities,
    matchRatings,
    rugby365PotmName,
    officialPotmName: ratingsBundle.officialPotmName,
  };
}
