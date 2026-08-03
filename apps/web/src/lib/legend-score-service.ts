/**
 * Persist + recalculate Planet Rugby Legend Scores for players.
 */

import { asc, count, eq, inArray } from "drizzle-orm";
import {
  playerCareerStints,
  playerLegendScores,
  playerLegends,
  playerRatings,
  playerTitles,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import { listPlayerCollectionSlugs } from "./legend-collections-service";
import {
  computeLegendScore,
  LEGEND_SCORE_MODEL,
  type LegendScoreComponents,
  type LegendScoreResult,
} from "./legend-score-math";

export type PlayerLegendScoreRow = {
  playerId: string;
  modelVersion: string;
  overallScore: number;
  careerRating: number | null;
  peakRating: number | null;
  legacyRating: number | null;
  influenceRating: number | null;
  leadershipRating: number | null;
  trophyScore: number | null;
  internationalScore: number | null;
  clubScore: number | null;
  hallOfFameStatus: string;
  eraRank: number | null;
  allTimeRank: number | null;
  components: LegendScoreComponents | Record<string, unknown>;
  overrides: Record<string, unknown>;
  calculatedAt: string;
};

function mapScoreRow(row: typeof playerLegendScores.$inferSelect): PlayerLegendScoreRow {
  return {
    playerId: row.playerId,
    modelVersion: row.modelVersion,
    overallScore: row.overallScore,
    careerRating: row.careerRating,
    peakRating: row.peakRating,
    legacyRating: row.legacyRating,
    influenceRating: row.influenceRating,
    leadershipRating: row.leadershipRating,
    trophyScore: row.trophyScore,
    internationalScore: row.internationalScore,
    clubScore: row.clubScore,
    hallOfFameStatus: row.hallOfFameStatus,
    eraRank: row.eraRank,
    allTimeRank: row.allTimeRank,
    components: row.components as LegendScoreComponents,
    overrides: (row.overrides ?? {}) as Record<string, unknown>,
    calculatedAt: row.calculatedAt.toISOString(),
  };
}

async function countInternationalApps(playerId: string): Promise<number> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        careerType: playerCareerStints.careerType,
        apps: playerCareerStints.apps,
      })
      .from(playerCareerStints)
      .where(eq(playerCareerStints.playerId, playerId));
    const intl = rows.filter((r) => /international|test|nation/i.test(r.careerType ?? ""));
    const apps = intl.reduce((sum, r) => sum + (r.apps ?? 0), 0);
    return apps > 0 ? apps : intl.length * 20;
  } catch {
    return 0;
  }
}

export async function recalculatePlayerLegendScore(playerId: string): Promise<PlayerLegendScoreRow> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  const [rating] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, playerId))
    .limit(1);

  const [legend] = await db
    .select()
    .from(playerLegends)
    .where(eq(playerLegends.playerId, playerId))
    .limit(1);

  const [titleAgg] = await db
    .select({ n: count() })
    .from(playerTitles)
    .where(eq(playerTitles.playerId, playerId));

  const [stintAgg] = await db
    .select({ n: count() })
    .from(playerCareerStints)
    .where(eq(playerCareerStints.playerId, playerId));

  const collectionSlugs = await listPlayerCollectionSlugs(playerId);
  const intlApps = await countInternationalApps(playerId);

  const [existingScore] = await db
    .select()
    .from(playerLegendScores)
    .where(eq(playerLegendScores.playerId, playerId))
    .limit(1);

  const overrides = (existingScore?.overrides ?? {}) as Partial<LegendScoreComponents> & {
    overallScore?: number | null;
  };

  const computed: LegendScoreResult = computeLegendScore({
    careerRating: rating?.manualOverrideRating ?? rating?.playerRating ?? rating?.currentAbility ?? null,
    peakRating: rating?.careerHigh ?? rating?.playerRating ?? null,
    reputation: rating?.reputation ?? null,
    legendLevel: legend?.legendLevel ?? null,
    collectionSlugs,
    titleCount: Number(titleAgg?.n ?? 0),
    internationalApps: intlApps || null,
    clubStintCount: Number(stintAgg?.n ?? 0) || null,
    overrides,
  });

  const ts = new Date();
  const values = {
    playerId,
    modelVersion: LEGEND_SCORE_MODEL,
    overallScore: computed.overallScore,
    careerRating: computed.components.careerRating,
    peakRating: computed.components.peakRating,
    legacyRating: computed.components.legacyRating,
    influenceRating: computed.components.influenceRating,
    leadershipRating: computed.components.leadershipRating,
    trophyScore: computed.components.trophyScore,
    internationalScore: computed.components.internationalScore,
    clubScore: computed.components.clubScore,
    hallOfFameStatus: computed.hallOfFameStatus,
    components: {
      ...computed.components,
      weights: computed.weights,
      notes: computed.notes,
    },
    overrides: existingScore?.overrides ?? {},
    calculatedAt: ts,
    updatedAt: ts,
  };

  if (existingScore) {
    await db.update(playerLegendScores).set(values).where(eq(playerLegendScores.playerId, playerId));
  } else {
    await db.insert(playerLegendScores).values(values);
  }

  const [saved] = await db
    .select()
    .from(playerLegendScores)
    .where(eq(playerLegendScores.playerId, playerId))
    .limit(1);
  return mapScoreRow(saved!);
}

export async function recalculateAllLegendScores(options?: { limit?: number }) {
  const db = getDb();
  const legendPlayers = await db
    .selectDistinct({ playerId: playerLegends.playerId })
    .from(playerLegends)
    .where(eq(playerLegends.legendStatus, "active"));

  const ids = legendPlayers.map((r) => r.playerId);
  const batch = options?.limit ? ids.slice(0, options.limit) : ids;

  let updated = 0;
  let failed = 0;
  for (const playerId of batch) {
    try {
      await recalculatePlayerLegendScore(playerId);
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  await refreshLegendScoreRanks();
  return { total: ids.length, processed: batch.length, updated, failed };
}

/** Assign all-time ranks by overall score among scored legends. */
export async function refreshLegendScoreRanks() {
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerLegendScores.playerId,
      overallScore: playerLegendScores.overallScore,
    })
    .from(playerLegendScores)
    .orderBy(asc(playerLegendScores.overallScore));

  // Highest score = rank 1
  const sorted = [...rows].sort((a, b) => b.overallScore - a.overallScore);
  for (let i = 0; i < sorted.length; i++) {
    await db
      .update(playerLegendScores)
      .set({ allTimeRank: i + 1, updatedAt: new Date() })
      .where(eq(playerLegendScores.playerId, sorted[i]!.playerId));
  }
  return { ranked: sorted.length };
}

export async function getPlayerLegendScore(playerId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(playerLegendScores)
    .where(eq(playerLegendScores.playerId, playerId))
    .limit(1);
  return row ? mapScoreRow(row) : null;
}

export async function getLegendScoresForPlayers(playerIds: string[]) {
  if (playerIds.length === 0) return new Map<string, PlayerLegendScoreRow>();
  const db = getDb();
  const rows = await db
    .select()
    .from(playerLegendScores)
    .where(inArray(playerLegendScores.playerId, playerIds));
  return new Map(rows.map((r) => [r.playerId, mapScoreRow(r)]));
}

export async function updateLegendScoreOverrides(
  playerId: string,
  overrides: Record<string, number | null>,
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(playerLegendScores)
    .where(eq(playerLegendScores.playerId, playerId))
    .limit(1);
  const next = { ...(existing?.overrides as Record<string, unknown> | undefined), ...overrides };
  if (!existing) {
    await db.insert(playerLegendScores).values({
      playerId,
      overrides: next,
      overallScore: 0,
      modelVersion: LEGEND_SCORE_MODEL,
    });
  } else {
    await db
      .update(playerLegendScores)
      .set({ overrides: next, updatedAt: new Date() })
      .where(eq(playerLegendScores.playerId, playerId));
  }
  return recalculatePlayerLegendScore(playerId);
}
