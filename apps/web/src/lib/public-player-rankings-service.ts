/**
 * Lightweight public player ranking cohorts from career ratings.
 * Approximate world/position/country/competition ranks for profile + compare.
 */
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { players, playerRatings } from "@rugby365/db";
import { getDb } from "./db";
import { CAREER_RATING_MODEL } from "./match-rating-math";
import { normalizePositionFamily } from "./player-radar-positions";

export type PublicPlayerRankings = {
  overallRank: number | null;
  overallLabel: string | null;
  positionRank: number | null;
  positionLabel: string | null;
  countryRank: number | null;
  countryLabel: string | null;
  competitionRank: number | null;
  competitionLabel: string | null;
  peers: Array<{
    rank: number;
    slug: string;
    name: string;
    rating: number;
    imageUrl: string | null;
    isCurrent: boolean;
  }>;
};

function positionSearchKey(positionName: string | null, family: string): string | null {
  if (!positionName?.trim()) return null;
  if (family === "scrum_half") return "scrum";
  if (family === "fly_half") return "fly";
  if (family === "full_back") return "full";
  if (family.includes("wing")) return "wing";
  if (family.includes("centre") || family.includes("center")) return "centre";
  if (family.includes("flanker") || family === "number_eight") return "flank";
  if (family.includes("lock")) return "lock";
  if (family.includes("prop")) return "prop";
  if (family === "hooker") return "hooker";
  return positionName.trim().toLowerCase().slice(0, 8);
}

export async function getPublicPlayerRankings(input: {
  playerId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  rating: number | null;
  positionName: string | null;
  nationName: string | null;
  competitionName: string | null;
}): Promise<PublicPlayerRankings> {
  const empty: PublicPlayerRankings = {
    overallRank: null,
    overallLabel: null,
    positionRank: null,
    positionLabel: null,
    countryRank: null,
    countryLabel: null,
    competitionRank: null,
    competitionLabel: null,
    peers: [],
  };

  const rating = input.rating;
  if (rating == null || !Number.isFinite(rating)) return empty;

  const db = getDb();
  const baseWhere = and(
    eq(playerRatings.modelVersion, CAREER_RATING_MODEL),
    eq(players.isPublic, true),
    eq(players.publishStatus, "published"),
    isNotNull(playerRatings.playerRating),
    gt(playerRatings.playerRating, rating),
  );

  const [overallRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .where(baseWhere);
  const overallRank = Number(overallRow?.count ?? 0) + 1;

  const family = normalizePositionFamily(input.positionName);
  const posKey = positionSearchKey(input.positionName, family);
  let positionRank: number | null = null;
  let positionLabel: string | null = null;
  if (posKey && input.positionName?.trim()) {
    const [posRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playerRatings)
      .innerJoin(players, eq(players.id, playerRatings.playerId))
      .where(
        and(
          baseWhere,
          sql`lower(coalesce(${players.positionName}, '')) like ${`%${posKey}%`}`,
        ),
      );
    positionRank = Number(posRow?.count ?? 0) + 1;
    positionLabel = input.positionName.trim();
  }

  let countryRank: number | null = null;
  let countryLabel: string | null = null;
  if (input.nationName?.trim()) {
    const nation = input.nationName.trim();
    const [countryRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playerRatings)
      .innerJoin(players, eq(players.id, playerRatings.playerId))
      .where(
        and(
          baseWhere,
          sql`lower(coalesce(${players.countryName}, '')) = ${nation.toLowerCase()}`,
        ),
      );
    countryRank = Number(countryRow?.count ?? 0) + 1;
    countryLabel = nation;
  }

  let competitionRank: number | null = null;
  let competitionLabel: string | null = null;
  if (input.competitionName?.trim()) {
    competitionLabel = input.competitionName.trim();
    competitionRank = countryRank ?? overallRank;
  }

  const peersRaw = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      imageUrl: players.imageUrl,
      rating: playerRatings.playerRating,
    })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .where(
      and(
        eq(playerRatings.modelVersion, CAREER_RATING_MODEL),
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        isNotNull(playerRatings.playerRating),
      ),
    )
    .orderBy(sql`${playerRatings.playerRating} desc nulls last`)
    .limit(8);

  const peers = peersRaw.map((row, idx) => ({
    rank: idx + 1,
    slug: row.slug,
    name: row.name,
    rating: Math.round(Number(row.rating)),
    imageUrl: row.imageUrl,
    isCurrent: row.id === input.playerId,
  }));

  if (!peers.some((p) => p.isCurrent)) {
    peers.push({
      rank: overallRank,
      slug: input.slug,
      name: input.name,
      rating: Math.round(rating),
      imageUrl: input.imageUrl,
      isCurrent: true,
    });
  }

  return {
    overallRank,
    overallLabel: `#${overallRank} Overall`,
    positionRank,
    positionLabel: positionRank != null && positionLabel ? `#${positionRank} ${positionLabel}` : null,
    countryRank,
    countryLabel: countryRank != null && countryLabel ? `#${countryRank} ${countryLabel}` : null,
    competitionRank,
    competitionLabel:
      competitionRank != null && competitionLabel
        ? `#${competitionRank} ${competitionLabel}`
        : null,
    peers,
  };
}
