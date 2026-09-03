/**
 * Loads Rugby365 ratings/lineups for a coach tenure and runs CoachPlayerDevelopmentEngine.
 */

import { and, eq, inArray, lt, ne, isNotNull } from "drizzle-orm";
import {
  fixtures,
  fixturePlayers,
  playerImages,
  playerMatchRatings,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import { allRelatedTeamIds } from "./coach-team-aliases";
import { getCoachDetail } from "./coach-admin-service";
import { loadCoachEligibleMatches } from "./coach-career-record-service";
import { calculatePlayerAge } from "./player-profile-utils";
import {
  buildCoachPlayerDevelopmentBundle,
  calculatePlayerDevelopmentRow,
  type CoachPlayerDevelopmentBundle,
  type CoachPlayerRatedAppearance,
  type CoachPlayerDevelopmentRow,
} from "./coach-player-development-engine";

export type { CoachPlayerDevelopmentBundle, CoachPlayerDevelopmentRow };

export type GetCoachPlayerDevelopmentOptions = {
  /** Default: current_team tenure only (Overview). */
  scope?: "current_team" | "all";
  tenureId?: string;
  publicTopN?: number;
};

function isStarter(squadRole: string | null | undefined, jersey: number | null | undefined): boolean {
  const role = (squadRole || "").toLowerCase();
  if (role.includes("start") || role === "xv" || role === "15") return true;
  if (jersey != null && jersey >= 1 && jersey <= 15) return true;
  return false;
}

function usableRating(rating: number | null | undefined, status: string | null | undefined): boolean {
  if (rating == null || !Number.isFinite(Number(rating)) || Number(rating) <= 0) return false;
  if ((status || "").toLowerCase() === "unavailable") return false;
  return true;
}

export async function getCoachPlayerDevelopmentBundle(
  coachId: string,
  options: GetCoachPlayerDevelopmentOptions = {},
): Promise<CoachPlayerDevelopmentBundle> {
  const scope = options.scope ?? "current_team";
  const detail = await getCoachDetail(coachId);
  if (!detail) {
    return emptyBundle("Coach not found.");
  }

  const current = detail.assignments.find((a) => a.isCurrent) ?? null;
  const tenure =
    options.tenureId != null
      ? detail.assignments.find((a) => a.id === options.tenureId) ?? null
      : scope === "current_team"
        ? current
        : null;

  const teamId = tenure?.teamId ?? current?.teamId ?? null;
  const tenureStartAt = tenure?.startDate
    ? new Date(`${tenure.startDate}T00:00:00.000Z`)
    : current?.startDate
      ? new Date(`${current.startDate}T00:00:00.000Z`)
      : null;

  const matches = await loadCoachEligibleMatches(coachId, {
    filter: scope === "current_team" ? "current_team" : "all",
    teamId: tenure?.teamId,
  });

  if (!teamId || matches.length < 3) {
    return emptyBundle("INSUFFICIENT PLAYER DEVELOPMENT DATA");
  }

  const fixtureIds = matches.map((m) => m.id);
  const fixtureKickoff = new Map(matches.map((m) => [m.id, m.kickoffAt]));
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);

  const [ratingRows, lineupRows] = await Promise.all([
    db
      .select({
        playerId: playerMatchRatings.playerId,
        fixtureId: playerMatchRatings.fixtureId,
        teamId: playerMatchRatings.teamId,
        rating: playerMatchRatings.rating,
        status: playerMatchRatings.ratingStatus,
        minutes: playerMatchRatings.minutesPlayed,
        positionName: playerMatchRatings.positionName,
        squadRole: playerMatchRatings.squadRole,
        jerseyNumber: playerMatchRatings.jerseyNumber,
      })
      .from(playerMatchRatings)
      .where(
        and(
          inArray(playerMatchRatings.fixtureId, fixtureIds),
          inArray(playerMatchRatings.teamId, teamIds),
        ),
      ),
    db
      .select({
        playerId: fixturePlayers.playerId,
        fixtureId: fixturePlayers.fixtureId,
        teamId: fixturePlayers.teamId,
        squadRole: fixturePlayers.squadRole,
        jerseyNumber: fixturePlayers.jerseyNumber,
        positionName: fixturePlayers.positionName,
      })
      .from(fixturePlayers)
      .where(
        and(inArray(fixturePlayers.fixtureId, fixtureIds), inArray(fixturePlayers.teamId, teamIds)),
      ),
  ]);

  const underByPlayer = new Map<string, CoachPlayerRatedAppearance[]>();
  const playersUsed = new Set<string>();

  for (const r of lineupRows) {
    playersUsed.add(r.playerId);
  }

  for (const r of ratingRows) {
    if (!usableRating(r.rating, r.status)) continue;
    playersUsed.add(r.playerId);
    const app: CoachPlayerRatedAppearance = {
      fixtureId: r.fixtureId,
      kickoffAt: fixtureKickoff.get(r.fixtureId) ?? null,
      rating: Number(r.rating),
      minutesPlayed: r.minutes ?? 0,
      isStart: isStarter(r.squadRole, r.jerseyNumber),
      positionName: r.positionName,
      competitionLevel: null,
      underCoach: true,
    };
    const bucket = underByPlayer.get(r.playerId) ?? [];
    bucket.push(app);
    underByPlayer.set(r.playerId, bucket);
  }

  // Fill starts from lineups when rating row lacked role clarity
  const lineupStart = new Set(
    lineupRows
      .filter((r) => isStarter(r.squadRole, r.jerseyNumber))
      .map((r) => `${r.fixtureId}:${r.playerId}`),
  );
  for (const [pid, apps] of underByPlayer) {
    for (const a of apps) {
      if (lineupStart.has(`${a.fixtureId}:${pid}`)) a.isStart = true;
    }
  }

  const playerIds = [...underByPlayer.keys()];
  if (!playerIds.length) {
    return emptyBundle("INSUFFICIENT PLAYER DEVELOPMENT DATA");
  }

  // Pre-coach ratings for baseline
  let preRows: Array<{
    playerId: string;
    fixtureId: string;
    rating: number | null;
    status: string;
    minutes: number;
    positionName: string | null;
    squadRole: string;
    jerseyNumber: number | null;
    kickoffAt: Date | null;
  }> = [];

  if (tenureStartAt) {
    preRows = await db
      .select({
        playerId: playerMatchRatings.playerId,
        fixtureId: playerMatchRatings.fixtureId,
        rating: playerMatchRatings.rating,
        status: playerMatchRatings.ratingStatus,
        minutes: playerMatchRatings.minutesPlayed,
        positionName: playerMatchRatings.positionName,
        squadRole: playerMatchRatings.squadRole,
        jerseyNumber: playerMatchRatings.jerseyNumber,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(playerMatchRatings)
      .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
      .where(
        and(
          inArray(playerMatchRatings.playerId, playerIds),
          lt(fixtures.kickoffAt, tenureStartAt),
          isNotNull(playerMatchRatings.rating),
          ne(playerMatchRatings.ratingStatus, "unavailable"),
        ),
      );
  }

  const preByPlayer = new Map<string, CoachPlayerRatedAppearance[]>();
  for (const r of preRows) {
    if (!usableRating(r.rating, r.status)) continue;
    const bucket = preByPlayer.get(r.playerId) ?? [];
    bucket.push({
      fixtureId: r.fixtureId,
      kickoffAt: r.kickoffAt,
      rating: Number(r.rating),
      minutesPlayed: r.minutes ?? 0,
      isStart: isStarter(r.squadRole, r.jerseyNumber),
      positionName: r.positionName,
      competitionLevel: null,
      underCoach: false,
    });
    preByPlayer.set(r.playerId, bucket);
  }

  const playerMeta = await db
    .select({
      id: players.id,
      name: players.name,
      fullName: players.fullName,
      slug: players.slug,
      imageUrl: players.imageUrl,
      primaryImageId: players.primaryImageId,
      birthDate: players.birthDate,
      positionName: players.positionName,
    })
    .from(players)
    .where(inArray(players.id, playerIds));
  const metaById = new Map(playerMeta.map((p) => [p.id, p]));

  const primaryIds = playerMeta
    .map((p) => p.primaryImageId)
    .filter((id): id is string => Boolean(id));
  const primaryUrlById = new Map<string, string>();
  if (primaryIds.length) {
    const imgs = await db
      .select({ id: playerImages.id, imageUrl: playerImages.imageUrl })
      .from(playerImages)
      .where(inArray(playerImages.id, primaryIds));
    for (const img of imgs) {
      if (img.imageUrl) primaryUrlById.set(img.id, img.imageUrl);
    }
  }

  // Fallback: any approved public gallery image per player missing imageUrl
  const missingImagePlayerIds = playerMeta
    .filter((p) => !p.imageUrl && !(p.primaryImageId && primaryUrlById.get(p.primaryImageId)))
    .map((p) => p.id);
  const galleryUrlByPlayer = new Map<string, string>();
  if (missingImagePlayerIds.length) {
    const gallery = await db
      .select({
        playerId: playerImages.playerId,
        imageUrl: playerImages.imageUrl,
        approvedAt: playerImages.approvedAt,
      })
      .from(playerImages)
      .where(
        and(
          inArray(playerImages.playerId, missingImagePlayerIds),
          eq(playerImages.status, "approved"),
          eq(playerImages.isPublic, true),
        ),
      );
    for (const g of gallery) {
      if (!g.imageUrl || galleryUrlByPlayer.has(g.playerId)) continue;
      galleryUrlByPlayer.set(g.playerId, g.imageUrl);
    }
  }

  // Team-wide rating delta (early vs late under coach) for fairness adjustment
  const teamRatingsChron = ratingRows
    .filter((r) => usableRating(r.rating, r.status))
    .map((r) => ({
      t: fixtureKickoff.get(r.fixtureId)?.getTime() ?? 0,
      rating: Number(r.rating),
    }))
    .sort((a, b) => a.t - b.t);
  let teamWideRatingDelta: number | null = null;
  if (teamRatingsChron.length >= 20) {
    const half = Math.floor(teamRatingsChron.length / 2);
    const early =
      teamRatingsChron.slice(0, half).reduce((s, x) => s + x.rating, 0) / half;
    const lateVals = teamRatingsChron.slice(half);
    const late = lateVals.reduce((s, x) => s + x.rating, 0) / lateVals.length;
    teamWideRatingDelta = late - early;
  }

  const rows: CoachPlayerDevelopmentRow[] = [];
  const unresolved: string[] = [];

  for (const [playerId, underApps] of underByPlayer) {
    const meta = metaById.get(playerId);
    if (!meta?.name?.trim()) {
      unresolved.push(playerId);
      continue;
    }
    const pre = preByPlayer.get(playerId) ?? [];
    const appearances = [...pre, ...underApps];
    const position =
      underApps.map((a) => a.positionName).find(Boolean) ?? meta.positionName ?? null;
    const underMax = Math.max(...underApps.map((a) => a.rating));
    const preMax = pre.length ? Math.max(...pre.map((a) => a.rating)) : null;
    const careerHigh = preMax == null ? underApps.length >= 5 : underMax > preMax + 0.05;

    const imageUrl =
      meta.imageUrl ??
      (meta.primaryImageId ? primaryUrlById.get(meta.primaryImageId) : null) ??
      galleryUrlByPlayer.get(playerId) ??
      null;

    rows.push(
      calculatePlayerDevelopmentRow({
        playerId,
        playerName: meta.name,
        playerSlug: meta.slug,
        playerImageUrl: imageUrl,
        position,
        age: calculatePlayerAge(meta.birthDate),
        appearances,
        tenureStartAt,
        teamWideRatingDelta,
        debutGiven: pre.length === 0 && underApps.length > 0,
        debutType: null,
        careerHighUnderCoach: careerHigh,
      }),
    );
  }

  if (unresolved.length) {
    // Flagged for CMS — excluded from public rows
    console.info(
      `[coach-player-dev] ${unresolved.length} unresolved player ids excluded for coach ${coachId}`,
    );
  }

  const matchesWithRatings = new Set(ratingRows.map((r) => r.fixtureId)).size;
  const coverage =
    matches.length > 0 ? Math.round((matchesWithRatings / matches.length) * 100) : null;

  const bundle = buildCoachPlayerDevelopmentBundle(rows, {
    playersUsed: playersUsed.size,
    ratedAppearanceCoveragePct: coverage,
  });

  if (options.publicTopN && options.publicTopN !== 5) {
    bundle.mostImproved = bundle.mostImproved.slice(0, options.publicTopN);
  }

  return bundle;
}

function emptyBundle(message: string): CoachPlayerDevelopmentBundle {
  return {
    modelVersion: "coach-player-development-v1",
    enoughData: false,
    message,
    playersUsed: 0,
    eligibleForDevelopment: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    insufficientData: 0,
    ratedAppearanceCoveragePct: null,
    mostImproved: [],
    allPlayers: [],
    coachDevelopmentScore: null,
    coachDevelopmentComponents: {},
  };
}

/**
 * Back-compat adapter for public profile shape used by Overview.
 */
export async function getCoachPlayerDevelopment(coachId: string) {
  const bundle = await getCoachPlayerDevelopmentBundle(coachId, { scope: "current_team" });
  return {
    enoughData: bundle.enoughData,
    matchesWithRatings: bundle.ratedAppearanceCoveragePct ?? 0,
    mostImproved: bundle.mostImproved.map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      playerSlug: r.playerSlug,
      playerImageUrl: r.playerImageUrl,
      position: r.position,
      age: r.age,
      appearances: r.appearancesUnderCoach,
      displayedChange: r.displayedChange,
      delta: r.displayedChange ?? 0,
      trend: r.trend,
      trendDelta: r.trendDelta,
      confidence: r.confidence,
      baselineRating: r.baselineRating,
      currentRating: r.currentRating,
      debutGiven: r.debutGiven,
      careerHighUnderCoach: r.careerHighUnderCoach,
      samples: r.ratedAppsUnderCoach,
      adjustedDevelopmentScore: r.adjustedDevelopmentScore,
    })),
    message: bundle.message,
    modelVersion: bundle.modelVersion,
    health: {
      playersUsed: bundle.playersUsed,
      eligibleForDevelopment: bundle.eligibleForDevelopment,
      highConfidence: bundle.highConfidence,
      mediumConfidence: bundle.mediumConfidence,
      insufficientData: bundle.insufficientData,
      ratedAppearanceCoveragePct: bundle.ratedAppearanceCoveragePct,
    },
    coachDevelopmentScore: bundle.coachDevelopmentScore,
  };
}
