/**
 * Persist + load Rugby365 Value Score (player-value-score-v1).
 * Public pages read stored rows — never recalculate on page load.
 */
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { playerRatings, playerValueScoreHistory, players } from "@rugby365/db";
import { getDb } from "./db";
import { calculatePlayerAge, normalizeSocialAccounts } from "./player-profile-utils";
import {
  computePlayerValueScore,
  VALUE_SCORE_MODEL,
  type PlayerValueScoreResult,
  type ValueScoreFactorContribution,
  type ValueScoreStatus,
  type DemandClass,
  type ValueTrendClass,
} from "./player-value-score-engine";
import { classifyValueTrend90d } from "./player-market-value-trend-utils";
import { getValueHistory } from "./player-value-history-service";
import { computePlayerPotential } from "./player-potential";

export type StoredPlayerValueScore = {
  id: string;
  playerId: string;
  valueScore: number | null;
  confidence: number;
  coverage: number;
  status: ValueScoreStatus;
  modelVersion: string;
  factors: ValueScoreFactorContribution[];
  valueTrend: ValueTrendClass;
  marketDemand: DemandClass;
  transferInterest: DemandClass;
  calculatedAt: string;
  isCurrent: boolean;
};

function mapRow(row: {
  id: string;
  playerId: string;
  valueScore: number | null;
  confidence: number;
  coverage: number;
  status: string;
  modelVersion: string;
  factorScores: unknown;
  display: unknown;
  calculatedAt: Date;
  isCurrent: boolean;
}): StoredPlayerValueScore {
  const display =
    row.display && typeof row.display === "object"
      ? (row.display as {
          valueTrend?: ValueTrendClass;
          marketDemand?: DemandClass;
          transferInterest?: DemandClass;
        })
      : {};
  return {
    id: row.id,
    playerId: row.playerId,
    valueScore: row.valueScore,
    confidence: row.confidence,
    coverage: row.coverage,
    status: row.status as ValueScoreStatus,
    modelVersion: row.modelVersion,
    factors: Array.isArray(row.factorScores)
      ? (row.factorScores as ValueScoreFactorContribution[])
      : [],
    valueTrend: display.valueTrend ?? null,
    marketDemand: display.marketDemand ?? null,
    transferInterest: display.transferInterest ?? null,
    calculatedAt: row.calculatedAt.toISOString(),
    isCurrent: row.isCurrent,
  };
}

export async function getLatestPlayerValueScore(
  playerId: string,
): Promise<StoredPlayerValueScore | null> {
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(playerValueScoreHistory)
      .where(
        and(
          eq(playerValueScoreHistory.playerId, playerId),
          eq(playerValueScoreHistory.isCurrent, true),
        ),
      )
      .orderBy(desc(playerValueScoreHistory.calculatedAt))
      .limit(1);

    if (row) return mapRow(row);

    const [any] = await db
      .select()
      .from(playerValueScoreHistory)
      .where(eq(playerValueScoreHistory.playerId, playerId))
      .orderBy(desc(playerValueScoreHistory.calculatedAt))
      .limit(1);

    return any ? mapRow(any) : null;
  } catch {
    // Table may not exist until migration 0079 is applied.
    return null;
  }
}

export async function calculateAndPersistPlayerValueScore(
  playerId: string,
  options: {
    calculationReason?: string;
    competitionKey?: string | null;
  } = {},
): Promise<PlayerValueScoreResult> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const [rating] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, playerId))
    .limit(1);

  const history = await getValueHistory(playerId, 6);
  const trend90d = classifyValueTrend90d({
    snapshots: history.map((r) => ({
      snapshotAt: r.snapshotDate,
      marketValueGbp: r.estimatedValue,
      confidence: r.confidence,
      overallRating: r.overallRating,
      clubName: r.clubName,
      modelVersion: r.modelVersion,
      snapshotType: r.snapshotType,
      coverage: r.coverage,
    })),
    now: new Date(),
    toleranceDays: 15,
  });

  let contractMonthsRemaining: number | null = null;
  if (player.contractExpiresOn) {
    const end = new Date(String(player.contractExpiresOn));
    if (!Number.isNaN(end.getTime())) {
      contractMonthsRemaining = Math.max(
        0,
        Math.round((end.getTime() - Date.now()) / (30.44 * 86_400_000)),
      );
    }
  }

  const overall = rating?.manualOverrideRating ?? rating?.playerRating ?? null;
  const age = calculatePlayerAge(player.birthDate);
  const potential = computePlayerPotential({
    overallRating: overall,
    age,
    verifiedCaps: player.verifiedInternationalCaps,
    careerHigh: rating?.careerHigh ?? null,
  });

  const social = normalizeSocialAccounts(player.socialAccounts);
  const hasSocial = Boolean(
    social.twitter || social.instagram || social.facebook || social.website,
  );
  // Commercial stays UNKNOWN without a social footprint — never invent.
  const commercialScore = hasSocial ? 62 : null;

  // Availability UNKNOWN by default (no injury feed wired here) — UNKNOWN ≠ 0.
  const availabilityScore: number | null = null;

  // Transfer interest: never invent High without evidence.
  const transferInterestEvidence = false;

  const now = new Date();
  const result = computePlayerValueScore({
    overallRating: overall,
    potential: potential.potential,
    valueChangePct90d: trend90d.changePct,
    formScore: rating?.formScore ?? null,
    contractMonthsRemaining,
    verifiedCaps: player.verifiedInternationalCaps,
    competitionKey: options.competitionKey ?? null,
    positionName: player.positionName,
    availabilityScore,
    commercialScore,
    transferInterestEvidence,
    calculatedAt: now,
  });

  await db
    .update(playerValueScoreHistory)
    .set({ isCurrent: false })
    .where(
      and(
        eq(playerValueScoreHistory.playerId, playerId),
        eq(playerValueScoreHistory.isCurrent, true),
      ),
    );

  await db.insert(playerValueScoreHistory).values({
    playerId,
    valueScore: result.valueScore,
    confidence: result.confidence / 100,
    coverage: result.coverage,
    status: result.status,
    modelVersion: VALUE_SCORE_MODEL,
    factorScores: result.factors,
    display: {
      valueTrend: result.valueTrend,
      marketDemand: result.marketDemand,
      transferInterest: result.transferInterest,
      marketDemandScore: result.marketDemandScore,
      transferInterestScore: result.transferInterestScore,
      valueTrendChangePct: result.valueTrendChangePct,
      rawScore: result.rawScore,
      excludedKeys: result.excludedKeys,
      reweighted: result.reweighted,
    },
    calculationReason: options.calculationReason ?? "value_score_recalculation",
    isCurrent: true,
    calculatedAt: now,
  });

  return result;
}

/** Best-effort: used from market-value recalc / data-change hooks. */
export async function tryCalculateAndPersistPlayerValueScore(
  playerId: string,
  options: { calculationReason?: string; competitionKey?: string | null } = {},
): Promise<PlayerValueScoreResult | null> {
  try {
    return await calculateAndPersistPlayerValueScore(playerId, options);
  } catch {
    return null;
  }
}

export function storedToOverviewValueScore(stored: StoredPlayerValueScore | null): {
  score: number | null;
  confidence: number;
  coverage: number;
  status: ValueScoreStatus;
  modelVersion: string;
  valueTrend: ValueTrendClass;
  marketDemand: DemandClass;
  transferInterest: DemandClass;
  factors: ValueScoreFactorContribution[];
  calculatedAt: string | null;
} {
  if (!stored) {
    return {
      score: null,
      confidence: 0,
      coverage: 0,
      status: "UNDER_REVIEW",
      modelVersion: VALUE_SCORE_MODEL,
      valueTrend: null,
      marketDemand: null,
      transferInterest: null,
      factors: [],
      calculatedAt: null,
    };
  }
  return {
    score: stored.status === "UNDER_REVIEW" ? null : stored.valueScore,
    confidence: stored.confidence <= 1 ? stored.confidence * 100 : stored.confidence,
    coverage: stored.coverage,
    status: stored.status,
    modelVersion: stored.modelVersion,
    valueTrend: stored.valueTrend,
    marketDemand: stored.marketDemand,
    transferInterest: stored.transferInterest,
    factors: stored.factors,
    calculatedAt: stored.calculatedAt,
  };
}
