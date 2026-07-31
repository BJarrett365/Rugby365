/**
 * Persist + recalculate Rugby365 Scout Intelligence / Recruitment Index.
 */

import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  playerInjuries,
  playerMarketValues,
  playerMatchRatings,
  playerRatings,
  playerScoutNotes,
  playerScoutProfiles,
  players,
  playerSuspensions,
} from "@rugby365/db";
import { getDb } from "./db";
import { calculatePlayerAge } from "./player-profile-utils";
import {
  computeScoutIntelligence,
  recommendationLabel,
  RRI_MODEL,
  type ScoutIntelligenceResult,
  type ScoutPlayerDna,
  type ScoutRecommendation,
  type ScoutRriFactor,
} from "./player-scout-intelligence-math";
import { formatGbpCompact } from "./player-value-math";

export type PublicScoutIntelligence = {
  modelVersion: string;
  rriScore: number;
  rriBand: string;
  rriGrade: string;
  recommendation: ScoutRecommendation;
  recommendationLabel: string;
  recommendationConfidence: number;
  aiSummary: string;
  overallRating: number;
  potential: number;
  currentAbility: number;
  ceiling: number;
  physicalScore: number;
  attackScore: number;
  defenceScore: number;
  setPieceScore: number;
  disciplineScore: number;
  leadershipScore: number;
  availabilityScore: number;
  riskInjury: string;
  riskContract: string;
  riskAdaptation: string;
  riskDiscipline: string;
  factors: ScoutRriFactor[];
  scorecard: ScoutIntelligenceResult["scorecard"];
  playerDna: ScoutPlayerDna;
  physicalIntelligence: ScoutIntelligenceResult["physicalIntelligence"];
  careerProjection: ScoutIntelligenceResult["careerProjection"];
  marketIntelligence: ScoutIntelligenceResult["marketIntelligence"] & {
    estimatedValueLabel: string | null;
    likelyTransferFeeLabel: string | null;
    estimatedSalaryLabel: string | null;
  };
  tacticalIntelligence: ScoutIntelligenceResult["tacticalIntelligence"];
  scoutRating: ScoutIntelligenceResult["scoutRating"];
  stars: number;
  marketValueLabel: string | null;
  calculatedAt: string | null;
  notes: Array<{
    id: string;
    observedOn: string | null;
    venue: string | null;
    matchContext: string | null;
    notes: string;
    confidence: string;
    recommendation: string | null;
    createdBy: string | null;
  }>;
};

export type AdminScoutProfile = PublicScoutIntelligence & {
  published: boolean;
  cmsNotes: string | null;
  overrides: Record<string, unknown>;
  playerId: string;
};

function monthsUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, months);
}

function toPublic(
  result: ScoutIntelligenceResult,
  calculatedAt: Date | null,
  notes: PublicScoutIntelligence["notes"],
): PublicScoutIntelligence {
  const mi = result.marketIntelligence;
  return {
    modelVersion: result.modelVersion,
    rriScore: result.rriScore,
    rriBand: result.rriBand,
    rriGrade: result.rriGrade,
    recommendation: result.recommendation,
    recommendationLabel: recommendationLabel(result.recommendation),
    recommendationConfidence: result.recommendationConfidence,
    aiSummary: result.aiSummary,
    overallRating: result.overallRating,
    potential: result.potential,
    currentAbility: result.currentAbility,
    ceiling: result.ceiling,
    physicalScore: result.physicalScore,
    attackScore: result.attackScore,
    defenceScore: result.defenceScore,
    setPieceScore: result.setPieceScore,
    disciplineScore: result.disciplineScore,
    leadershipScore: result.leadershipScore,
    availabilityScore: result.availabilityScore,
    riskInjury: result.riskInjury,
    riskContract: result.riskContract,
    riskAdaptation: result.riskAdaptation,
    riskDiscipline: result.riskDiscipline,
    factors: result.factors,
    scorecard: result.scorecard,
    playerDna: result.playerDna,
    physicalIntelligence: result.physicalIntelligence,
    careerProjection: result.careerProjection,
    marketIntelligence: {
      ...mi,
      estimatedValueLabel: mi.estimatedValueGbp != null ? formatGbpCompact(mi.estimatedValueGbp) : null,
      likelyTransferFeeLabel:
        mi.likelyTransferFeeGbp != null ? formatGbpCompact(mi.likelyTransferFeeGbp) : null,
      estimatedSalaryLabel:
        mi.estimatedSalaryGbp != null ? formatGbpCompact(mi.estimatedSalaryGbp) : null,
    },
    tacticalIntelligence: result.tacticalIntelligence,
    scoutRating: result.scoutRating,
    stars: result.scoutRating.stars,
    marketValueLabel: mi.estimatedValueGbp != null ? formatGbpCompact(mi.estimatedValueGbp) : null,
    calculatedAt: calculatedAt?.toISOString() ?? null,
    notes,
  };
}

async function loadScoutNotes(playerId: string): Promise<PublicScoutIntelligence["notes"]> {
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(playerScoutNotes)
      .where(eq(playerScoutNotes.playerId, playerId))
      .orderBy(desc(playerScoutNotes.observedOn), desc(playerScoutNotes.createdAt))
      .limit(20);
    return rows.map((r) => ({
      id: r.id,
      observedOn: r.observedOn,
      venue: r.venue,
      matchContext: r.matchContext,
      notes: r.notes,
      confidence: r.confidence,
      recommendation: r.recommendation,
      createdBy: r.createdBy,
    }));
  } catch {
    return [];
  }
}

async function gatherInputs(playerId: string) {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  const [rating] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, playerId))
    .limit(1);

  const [value] = await db
    .select()
    .from(playerMarketValues)
    .where(and(eq(playerMarketValues.playerId, playerId), eq(playerMarketValues.isCurrent, true)))
    .limit(1);

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  let daysUnavailable = 0;
  let injuryEvents = 0;
  const twoYearsAgoIso = twoYearsAgo.toISOString().slice(0, 10);
  try {
    const injuries = await db
      .select()
      .from(playerInjuries)
      .where(
        and(
          eq(playerInjuries.playerId, playerId),
          gte(playerInjuries.injuryDate, twoYearsAgoIso),
        ),
      );
    injuryEvents += injuries.length;
    for (const inj of injuries) {
      if (!inj.injuryDate) continue;
      const start = new Date(inj.injuryDate);
      const end = inj.actualReturnDate
        ? new Date(inj.actualReturnDate)
        : inj.expectedReturnDate
          ? new Date(inj.expectedReturnDate)
          : new Date();
      if (end < yearAgo) continue;
      const from = start < yearAgo ? yearAgo : start;
      daysUnavailable += Math.max(
        0,
        Math.round((Math.min(end.getTime(), Date.now()) - from.getTime()) / 86_400_000),
      );
    }
  } catch {
    /* table may be empty */
  }

  try {
    const suspensions = await db
      .select()
      .from(playerSuspensions)
      .where(
        and(
          eq(playerSuspensions.playerId, playerId),
          gte(playerSuspensions.suspensionStart, twoYearsAgoIso),
        ),
      );
    injuryEvents += suspensions.length;
  } catch {
    /* ignore */
  }

  let lastFive: number[] = [];
  if (Array.isArray(rating?.lastFiveMatchRatings)) {
    lastFive = (rating!.lastFiveMatchRatings as unknown[])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
  } else {
    try {
      const rows = await db
        .select({ rating: playerMatchRatings.rating })
        .from(playerMatchRatings)
        .where(eq(playerMatchRatings.playerId, playerId))
        .orderBy(desc(playerMatchRatings.recalculatedAt))
        .limit(5);
      lastFive = rows
        .map((r) => r.rating)
        .filter((n): n is number => n != null && Number.isFinite(n));
    } catch {
      lastFive = [];
    }
  }

  const [existing] = await db
    .select()
    .from(playerScoutProfiles)
    .where(eq(playerScoutProfiles.playerId, playerId))
    .limit(1);

  const overrides = (existing?.overrides ?? {}) as NonNullable<
    Parameters<typeof computeScoutIntelligence>[0]["overrides"]
  >;

  const agentLabel = [player.agentName, player.agentAgency].filter(Boolean).join(" · ") || null;

  return {
    player,
    existing,
    inputs: {
      currentAbility: rating?.currentAbility ?? rating?.playerRating ?? null,
      potential: rating?.potential ?? null,
      formScore: rating?.formScore ?? null,
      lastFiveMatchRatings: lastFive,
      attackRating: rating?.attackRating ?? null,
      defenceRating: rating?.defenceRating ?? null,
      disciplineRating: rating?.disciplineRating ?? null,
      reputation: rating?.reputation ?? null,
      age: calculatePlayerAge(player.birthDate),
      positionName: player.positionName,
      internationalCaps: null as number | null,
      contractMonthsRemaining: monthsUntil(player.contractExpiresOn),
      daysUnavailableLastYear: daysUnavailable,
      injuryEventsLastTwoYears: injuryEvents,
      marketValueGbp: value?.marketValueGbp ?? null,
      transferValueGbp: value?.transferValueGbp ?? null,
      contractValueGbp: value?.contractValueGbp ?? player.reportedSalaryGbp ?? null,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      isCaptain: null as boolean | null,
      agentLabel,
      overrides,
    },
  };
}

export async function recalculatePlayerScoutProfile(
  playerId: string,
): Promise<AdminScoutProfile> {
  const db = getDb();
  const { player, existing, inputs } = await gatherInputs(playerId);
  const result = computeScoutIntelligence(inputs);
  const now = new Date();

  await db
    .insert(playerScoutProfiles)
    .values({
      playerId,
      modelVersion: RRI_MODEL,
      rriScore: result.rriScore,
      rriBand: result.rriBand,
      rriGrade: result.rriGrade,
      recommendation: result.recommendation,
      recommendationConfidence: result.recommendationConfidence,
      aiSummary: result.aiSummary,
      overallRating: result.overallRating,
      potential: result.potential,
      currentAbility: result.currentAbility,
      ceiling: result.ceiling,
      physicalScore: result.physicalScore,
      attackScore: result.attackScore,
      defenceScore: result.defenceScore,
      setPieceScore: result.setPieceScore,
      disciplineScore: result.disciplineScore,
      leadershipScore: result.leadershipScore,
      availabilityScore: result.availabilityScore,
      riskInjury: result.riskInjury,
      riskContract: result.riskContract,
      riskAdaptation: result.riskAdaptation,
      riskDiscipline: result.riskDiscipline,
      factors: result.factors,
      scorecard: result.scorecard,
      playerDna: result.playerDna,
      physicalIntelligence: result.physicalIntelligence,
      careerProjection: result.careerProjection,
      marketIntelligence: result.marketIntelligence,
      tacticalIntelligence: result.tacticalIntelligence,
      scoutRating: result.scoutRating,
      overrides: existing?.overrides ?? {},
      cmsNotes: existing?.cmsNotes ?? null,
      published: existing?.published ?? true,
      calculatedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: playerScoutProfiles.playerId,
      set: {
        modelVersion: RRI_MODEL,
        rriScore: result.rriScore,
        rriBand: result.rriBand,
        rriGrade: result.rriGrade,
        recommendation: result.recommendation,
        recommendationConfidence: result.recommendationConfidence,
        aiSummary: result.aiSummary,
        overallRating: result.overallRating,
        potential: result.potential,
        currentAbility: result.currentAbility,
        ceiling: result.ceiling,
        physicalScore: result.physicalScore,
        attackScore: result.attackScore,
        defenceScore: result.defenceScore,
        setPieceScore: result.setPieceScore,
        disciplineScore: result.disciplineScore,
        leadershipScore: result.leadershipScore,
        availabilityScore: result.availabilityScore,
        riskInjury: result.riskInjury,
        riskContract: result.riskContract,
        riskAdaptation: result.riskAdaptation,
        riskDiscipline: result.riskDiscipline,
        factors: result.factors,
        scorecard: result.scorecard,
        playerDna: result.playerDna,
        physicalIntelligence: result.physicalIntelligence,
        careerProjection: result.careerProjection,
        marketIntelligence: result.marketIntelligence,
        tacticalIntelligence: result.tacticalIntelligence,
        scoutRating: result.scoutRating,
        calculatedAt: now,
        updatedAt: now,
      },
    });

  const notes = await loadScoutNotes(playerId);
  const pub = toPublic(result, now, notes);
  return {
    ...pub,
    playerId: player.id,
    published: existing?.published ?? true,
    cmsNotes: existing?.cmsNotes ?? null,
    overrides: (existing?.overrides ?? {}) as Record<string, unknown>,
  };
}

export async function getPlayerScoutProfile(
  playerId: string,
  options?: { calculateIfMissing?: boolean; includeUnpublished?: boolean },
): Promise<PublicScoutIntelligence | null> {
  const admin = await getAdminPlayerScoutProfile(playerId, options);
  if (!admin) return null;
  const { published: _p, cmsNotes: _c, overrides: _o, playerId: _id, ...pub } = admin;
  return pub;
}

export async function getAdminPlayerScoutProfile(
  playerId: string,
  options?: { calculateIfMissing?: boolean; includeUnpublished?: boolean },
): Promise<AdminScoutProfile | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(playerScoutProfiles)
    .where(eq(playerScoutProfiles.playerId, playerId))
    .limit(1);

  if (!row) {
    if (options?.calculateIfMissing) {
      const admin = await recalculatePlayerScoutProfile(playerId);
      if (!admin.published && !options.includeUnpublished) return null;
      return admin;
    }
    return null;
  }

  if (!row.published && !options?.includeUnpublished) return null;

  const notes = await loadScoutNotes(playerId);
  const result: ScoutIntelligenceResult = {
    modelVersion: row.modelVersion,
    rriScore: row.rriScore,
    rriBand: row.rriBand,
    rriGrade: row.rriGrade,
    recommendation: row.recommendation as ScoutRecommendation,
    recommendationConfidence: row.recommendationConfidence,
    aiSummary: row.aiSummary ?? "",
    overallRating: row.overallRating ?? 0,
    potential: row.potential ?? 0,
    currentAbility: row.currentAbility ?? 0,
    ceiling: row.ceiling ?? 0,
    physicalScore: row.physicalScore ?? 0,
    attackScore: row.attackScore ?? 0,
    defenceScore: row.defenceScore ?? 0,
    setPieceScore: row.setPieceScore ?? 0,
    disciplineScore: row.disciplineScore ?? 0,
    leadershipScore: row.leadershipScore ?? 0,
    availabilityScore: row.availabilityScore ?? 0,
    riskInjury: row.riskInjury as ScoutIntelligenceResult["riskInjury"],
    riskContract: row.riskContract as ScoutIntelligenceResult["riskContract"],
    riskAdaptation: row.riskAdaptation as ScoutIntelligenceResult["riskAdaptation"],
    riskDiscipline: row.riskDiscipline as ScoutIntelligenceResult["riskDiscipline"],
    factors: (Array.isArray(row.factors) ? row.factors : []) as ScoutRriFactor[],
    scorecard: row.scorecard as ScoutIntelligenceResult["scorecard"],
    playerDna: row.playerDna as ScoutPlayerDna,
    physicalIntelligence:
      row.physicalIntelligence as ScoutIntelligenceResult["physicalIntelligence"],
    careerProjection: row.careerProjection as ScoutIntelligenceResult["careerProjection"],
    marketIntelligence: row.marketIntelligence as ScoutIntelligenceResult["marketIntelligence"],
    tacticalIntelligence:
      row.tacticalIntelligence as ScoutIntelligenceResult["tacticalIntelligence"],
    scoutRating: row.scoutRating as ScoutIntelligenceResult["scoutRating"],
    notes: [],
  };

  return {
    ...toPublic(result, row.calculatedAt, notes),
    playerId,
    published: row.published,
    cmsNotes: row.cmsNotes,
    overrides: (row.overrides ?? {}) as Record<string, unknown>,
  };
}

export async function updatePlayerScoutOverrides(
  playerId: string,
  patch: {
    overrides?: Record<string, unknown>;
    cmsNotes?: string | null;
    published?: boolean;
    aiSummary?: string | null;
    recommendation?: ScoutRecommendation | null;
  },
): Promise<AdminScoutProfile> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(playerScoutProfiles)
    .where(eq(playerScoutProfiles.playerId, playerId))
    .limit(1);

  if (!existing) {
    await recalculatePlayerScoutProfile(playerId);
  }

  const [current] = await db
    .select()
    .from(playerScoutProfiles)
    .where(eq(playerScoutProfiles.playerId, playerId))
    .limit(1);

  const nextOverrides = {
    ...((current?.overrides ?? {}) as Record<string, unknown>),
    ...(patch.overrides ?? {}),
  };
  if (patch.aiSummary !== undefined) nextOverrides.aiSummary = patch.aiSummary;
  if (patch.recommendation !== undefined) nextOverrides.recommendation = patch.recommendation;

  await db
    .update(playerScoutProfiles)
    .set({
      overrides: nextOverrides,
      cmsNotes: patch.cmsNotes !== undefined ? patch.cmsNotes : current?.cmsNotes,
      published: patch.published !== undefined ? patch.published : (current?.published ?? true),
      updatedAt: new Date(),
    })
    .where(eq(playerScoutProfiles.playerId, playerId));

  return recalculatePlayerScoutProfile(playerId);
}

export async function createScoutNote(input: {
  playerId: string;
  notes: string;
  observedOn?: string | null;
  venue?: string | null;
  matchContext?: string | null;
  confidence?: string;
  recommendation?: string | null;
  createdBy?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(playerScoutNotes)
    .values({
      playerId: input.playerId,
      notes: input.notes,
      observedOn: input.observedOn || null,
      venue: input.venue || null,
      matchContext: input.matchContext || null,
      confidence: input.confidence || "medium",
      recommendation: input.recommendation || null,
      createdBy: input.createdBy || null,
    })
    .returning();
  return row;
}

export async function listTopRecruitmentTargets(limit = 40) {
  const db = getDb();
  try {
    const rows = await db
      .select({
        playerId: playerScoutProfiles.playerId,
        rriScore: playerScoutProfiles.rriScore,
        rriBand: playerScoutProfiles.rriBand,
        rriGrade: playerScoutProfiles.rriGrade,
        recommendation: playerScoutProfiles.recommendation,
        name: players.name,
        slug: players.slug,
        positionName: players.positionName,
        imageUrl: players.imageUrl,
      })
      .from(playerScoutProfiles)
      .innerJoin(players, eq(players.id, playerScoutProfiles.playerId))
      .where(eq(playerScoutProfiles.published, true))
      .orderBy(desc(playerScoutProfiles.rriScore))
      .limit(limit);
    return rows;
  } catch {
    return [];
  }
}
