/**
 * Player Comparison card payload — intelligence dims, default peer, selectable peer.
 */
import "server-only";

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { playerRatings, players } from "@rugby365/db";
import { getDb } from "./db";
import {
  buildPlayerComparisonMetrics,
  comparisonPeerSubtitle,
  pickDefaultComparisonPeer,
  type PlayerComparisonMetricRow,
  type PlayerComparisonScores,
} from "./player-comparison-engine";
import {
  getPositionIntelligenceConfig,
  resolveIntelligencePositionGroup,
} from "./player-intelligence-position-config";

export type PlayerComparisonSide = {
  playerId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  positionName: string | null;
  scores: PlayerComparisonScores;
  modelVersion: string | null;
};

export type PlayerComparisonCardModel = {
  left: PlayerComparisonSide;
  right: PlayerComparisonSide | null;
  metrics: PlayerComparisonMetricRow[];
  peerSubtitle: string;
  fullCompareHref: string;
  modelVersion: string | null;
};

function scoresFromRatingRow(row: {
  playerRating: number | null;
  kickingRating: number | null;
  playmakingRating: number | null;
  gameManagementRating: number | null;
  attackRating: number | null;
  defenceRating: number | null;
  physicalRating: number | null;
} | null): PlayerComparisonScores {
  if (!row) {
    return {
      kicking: null,
      playmaking: null,
      gameManagement: null,
      attack: null,
      defence: null,
      physical: null,
      overall: null,
    };
  }
  return {
    kicking: row.kickingRating,
    playmaking: row.playmakingRating,
    gameManagement: row.gameManagementRating,
    attack: row.attackRating,
    defence: row.defenceRating,
    physical: row.physicalRating,
    overall: row.playerRating,
  };
}

async function loadSideBySlug(slug: string): Promise<PlayerComparisonSide | null> {
  const db = getDb();
  const [row] = await db
    .select({
      playerId: players.id,
      slug: players.slug,
      name: players.name,
      fullName: players.fullName,
      knownAs: players.knownAs,
      imageUrl: players.imageUrl,
      positionName: players.positionName,
      playerRating: playerRatings.playerRating,
      kickingRating: playerRatings.kickingRating,
      playmakingRating: playerRatings.playmakingRating,
      gameManagementRating: playerRatings.gameManagementRating,
      attackRating: playerRatings.attackRating,
      defenceRating: playerRatings.defenceRating,
      physicalRating: playerRatings.physicalRating,
      modelVersion: playerRatings.modelVersion,
    })
    .from(players)
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(and(eq(players.slug, slug), eq(players.isPublic, true)))
    .limit(1);
  if (!row) return null;
  return {
    playerId: row.playerId,
    slug: row.slug,
    name: row.knownAs?.trim() || row.name?.trim() || row.fullName?.trim() || row.slug,
    imageUrl: row.imageUrl,
    positionName: row.positionName,
    scores: scoresFromRatingRow(row),
    modelVersion: row.modelVersion,
  };
}

async function loadSideById(playerId: string): Promise<PlayerComparisonSide | null> {
  const db = getDb();
  const [row] = await db
    .select({
      playerId: players.id,
      slug: players.slug,
      name: players.name,
      fullName: players.fullName,
      knownAs: players.knownAs,
      imageUrl: players.imageUrl,
      positionName: players.positionName,
      playerRating: playerRatings.playerRating,
      kickingRating: playerRatings.kickingRating,
      playmakingRating: playerRatings.playmakingRating,
      gameManagementRating: playerRatings.gameManagementRating,
      attackRating: playerRatings.attackRating,
      defenceRating: playerRatings.defenceRating,
      physicalRating: playerRatings.physicalRating,
      modelVersion: playerRatings.modelVersion,
    })
    .from(players)
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(eq(players.id, playerId))
    .limit(1);
  if (!row) return null;
  return {
    playerId: row.playerId,
    slug: row.slug,
    name: row.knownAs?.trim() || row.name?.trim() || row.fullName?.trim() || row.slug,
    imageUrl: row.imageUrl,
    positionName: row.positionName,
    scores: scoresFromRatingRow(row),
    modelVersion: row.modelVersion,
  };
}

/**
 * Default peer: highest relevance among public same-position rated players.
 * Never hardcodes a specific opponent.
 */
export async function resolveDefaultComparisonPeer(input: {
  playerId: string;
  positionName: string | null;
  subjectRating: number | null;
  competitionName?: string | null;
  nationName?: string | null;
}): Promise<PlayerComparisonSide | null> {
  if (!input.positionName) return null;
  const group = resolveIntelligencePositionGroup(input.positionName);
  const db = getDb();

  // Broad SQL filter by position token, then score in engine.
  const token =
    group === "fly_half"
      ? "%fly%"
      : group === "scrum_half"
        ? "%scrum%"
        : group === "back_row"
          ? "%flank%|%number 8%|%back row%"
          : group === "fullback"
            ? "%full%"
            : `%${input.positionName.split(/\s+/)[0]?.toLowerCase() ?? "player"}%`;

  const likeToken = group === "fly_half" ? "%fly%" : token.includes("|") ? "%flank%" : token;

  const rows = await db
    .select({
      playerId: players.id,
      slug: players.slug,
      name: players.name,
      fullName: players.fullName,
      knownAs: players.knownAs,
      imageUrl: players.imageUrl,
      positionName: players.positionName,
      nationName: players.countryName,
      playerRating: playerRatings.playerRating,
      kickingRating: playerRatings.kickingRating,
      playmakingRating: playerRatings.playmakingRating,
      gameManagementRating: playerRatings.gameManagementRating,
      attackRating: playerRatings.attackRating,
      defenceRating: playerRatings.defenceRating,
      physicalRating: playerRatings.physicalRating,
      modelVersion: playerRatings.modelVersion,
    })
    .from(players)
    .innerJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        ne(players.id, input.playerId),
        sql`lower(coalesce(${players.positionName}, '')) like ${likeToken}`,
        sql`${playerRatings.playerRating} is not null`,
      ),
    )
    .orderBy(desc(playerRatings.playerRating))
    .limit(40);

  // If position token was too narrow, re-query looser and filter by group in engine.
  let candidates = rows;
  if (!candidates.length) {
    candidates = await db
      .select({
        playerId: players.id,
        slug: players.slug,
        name: players.name,
        fullName: players.fullName,
        knownAs: players.knownAs,
        imageUrl: players.imageUrl,
        positionName: players.positionName,
        nationName: players.countryName,
        playerRating: playerRatings.playerRating,
        kickingRating: playerRatings.kickingRating,
        playmakingRating: playerRatings.playmakingRating,
        gameManagementRating: playerRatings.gameManagementRating,
        attackRating: playerRatings.attackRating,
        defenceRating: playerRatings.defenceRating,
        physicalRating: playerRatings.physicalRating,
        modelVersion: playerRatings.modelVersion,
      })
      .from(players)
      .innerJoin(playerRatings, eq(playerRatings.playerId, players.id))
      .where(
        and(
          eq(players.isPublic, true),
          eq(players.publishStatus, "published"),
          ne(players.id, input.playerId),
          sql`${playerRatings.playerRating} is not null`,
        ),
      )
      .orderBy(desc(playerRatings.playerRating))
      .limit(60);
  }

  const scored = candidates
    .map((r) => {
      const peerGroup = resolveIntelligencePositionGroup(r.positionName);
      return {
        id: r.playerId,
        samePosition: peerGroup === group,
        rating: r.playerRating,
        subjectRating: input.subjectRating,
        sameCompetition: false,
        sameNation:
          Boolean(input.nationName) &&
          Boolean(r.nationName) &&
          input.nationName!.toLowerCase() === r.nationName!.toLowerCase(),
        row: r,
      };
    })
    .filter((c) => c.samePosition);

  const pick = pickDefaultComparisonPeer(scored);
  if (!pick) return null;
  const r = pick.row;
  return {
    playerId: r.playerId,
    slug: r.slug,
    name: r.knownAs?.trim() || r.name?.trim() || r.fullName?.trim() || r.slug,
    imageUrl: r.imageUrl,
    positionName: r.positionName,
    scores: scoresFromRatingRow(r),
    modelVersion: r.modelVersion,
  };
}

export async function getPlayerComparisonCard(input: {
  leftPlayerId: string;
  leftSlug: string;
  leftName: string;
  leftImageUrl: string | null;
  leftPositionName: string | null;
  leftScores: PlayerComparisonScores;
  leftModelVersion: string | null;
  /** URL ?compare=slug override. */
  compareSlug?: string | null;
  nationName?: string | null;
  competitionName?: string | null;
}): Promise<PlayerComparisonCardModel> {
  const left: PlayerComparisonSide = {
    playerId: input.leftPlayerId,
    slug: input.leftSlug,
    name: input.leftName,
    imageUrl: input.leftImageUrl,
    positionName: input.leftPositionName,
    scores: input.leftScores,
    modelVersion: input.leftModelVersion,
  };

  let right: PlayerComparisonSide | null = null;
  if (input.compareSlug && input.compareSlug !== input.leftSlug) {
    right = await loadSideBySlug(input.compareSlug);
  }
  if (!right) {
    right = await resolveDefaultComparisonPeer({
      playerId: input.leftPlayerId,
      positionName: input.leftPositionName,
      subjectRating: input.leftScores.overall ?? null,
      competitionName: input.competitionName,
      nationName: input.nationName,
    });
  }

  const metrics = buildPlayerComparisonMetrics(left.scores, right?.scores ?? {});
  const config = getPositionIntelligenceConfig(input.leftPositionName);
  const peerSubtitle = comparisonPeerSubtitle(config.peerLabel);
  const fullCompareHref = right
    ? `/players/compare?player1=${encodeURIComponent(left.slug)}&player2=${encodeURIComponent(right.slug)}`
    : `/players/compare?player1=${encodeURIComponent(left.slug)}`;

  return {
    left,
    right,
    metrics,
    peerSubtitle,
    fullCompareHref,
    modelVersion: left.modelVersion ?? right?.modelVersion ?? null,
  };
}

export async function getComparisonSideBySlug(slug: string) {
  return loadSideBySlug(slug);
}

export async function getComparisonSideById(playerId: string) {
  return loadSideById(playerId);
}
