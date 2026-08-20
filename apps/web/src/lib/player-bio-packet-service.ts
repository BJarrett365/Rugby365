import { eq } from "drizzle-orm";
import { playerRatings } from "@rugby365/db";
import { getPlayerDetail } from "./entity-admin-service";
import { getPlayerLegends } from "./legend-admin-service";
import type { PlayerBioPacket } from "./player-bio-types";
import { getDb } from "./db";
import { calculatePlayerAge } from "./player-profile-utils";
import {
  getPlayerMatchStatsHistory,
  getPlayerSeasonStats,
} from "./player-season-stats-service";
import {
  applyAvailabilityToRatingSnapshot,
  filterMatchesForAvailabilityForm,
} from "./player-availability-intelligence";
import { getPlayerAvailabilityContext } from "./player-availability-service";
import { buildPlayerRatingSnapshot } from "./player-rating-service";
import { detectProfileConflicts, detectMissingFields } from "./ai-source-context";
import type { AiSourceSnapshot } from "./ai-enrichment-types";

export async function buildPlayerBioPacket(playerId: string): Promise<PlayerBioPacket> {
  const detail = await getPlayerDetail(playerId);
  if (!detail) throw new Error("Player not found");

  const [seasonStats, matchStatsResult, legends, previousRatingRow, availabilityContext] =
    await Promise.all([
      getPlayerSeasonStats(playerId),
      getPlayerMatchStatsHistory(playerId, {}),
      getPlayerLegends(playerId),
      getDb()
        .select()
        .from(playerRatings)
        .where(eq(playerRatings.playerId, playerId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      getPlayerAvailabilityContext(playerId),
    ]);

  const matchStats = filterMatchesForAvailabilityForm(
    matchStatsResult.stats,
    availabilityContext.excludedFormFixtureIds,
  );

  const age = calculatePlayerAge(detail.player.birthDate);
  const previousSnapshot = previousRatingRow
    ? {
        playerRating: previousRatingRow.playerRating,
        displayRating: previousRatingRow.manualOverrideRating ?? previousRatingRow.playerRating,
        calculatedRating: previousRatingRow.playerRating,
        currentAbility: previousRatingRow.currentAbility,
        formScore: previousRatingRow.formScore,
        teamImportance: previousRatingRow.teamImportance,
        potential: previousRatingRow.potential,
        reputation: previousRatingRow.reputation,
        attackRating: previousRatingRow.attackRating,
        defenceRating: previousRatingRow.defenceRating,
        disciplineRating: previousRatingRow.disciplineRating,
        ageProfile: previousRatingRow.ageProfile as PlayerBioPacket["rating"]["ageProfile"],
        ratingConfidence: previousRatingRow.ratingConfidence,
        ratingExplanation: previousRatingRow.ratingExplanation,
        seasonRating: previousRatingRow.seasonRating,
        careerHigh: previousRatingRow.careerHigh,
        careerLow: previousRatingRow.careerLow,
        formMovement: previousRatingRow.formMovement,
        ratingMovement: previousRatingRow.ratingMovement,
        lastFiveMatchRatings: (previousRatingRow.lastFiveMatchRatings as number[]) ?? [],
        badges: (previousRatingRow.badges as PlayerBioPacket["rating"]["badges"]) ?? [],
        manualOverrideRating: previousRatingRow.manualOverrideRating,
        manualOverrideReason: previousRatingRow.manualOverrideReason,
        dataPoints: previousRatingRow.dataPoints ?? 0,
      }
    : null;

  const rating = applyAvailabilityToRatingSnapshot(
    buildPlayerRatingSnapshot({
      playerId,
      birthDate: detail.player.birthDate,
      internationalTeamId: detail.player.internationalTeamId,
      seasonStats,
      matchStats,
      fixtureCount: detail.squads.length,
      hasLegend: legends.length > 0,
      previous: previousSnapshot,
      manualOverrideRating: previousRatingRow?.manualOverrideRating ?? null,
      manualOverrideReason: previousRatingRow?.manualOverrideReason ?? null,
    }),
    availabilityContext,
  );

  const previousClubs = [
    ...new Set(
      [
        ...detail.transfers.map((row) => row.fromClub),
        ...detail.transfers.map((row) => row.toClub),
        ...detail.careerStints.map((row) => row.teamName),
      ].filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].filter((club) => club !== detail.player.clubName);

  const sourceUrls = [
    detail.player.wikipediaUrl
      ? { label: "Wikipedia", url: detail.player.wikipediaUrl }
      : null,
    detail.player.rugbypassUrl ? { label: "RugbyPass", url: detail.player.rugbypassUrl } : null,
    detail.player.wikidataId
      ? { label: "Wikidata", url: `https://www.wikidata.org/wiki/${detail.player.wikidataId}` }
      : null,
  ].filter((row): row is { label: string; url: string } => Boolean(row));

  const snapshot: AiSourceSnapshot = {
    entityType: "player",
    entityId: playerId,
    entityName: detail.player.name,
    database: {
      birthDate: detail.player.birthDate,
      heightCm: detail.player.heightCm,
      weightKg: detail.player.weightKg,
      positionName: detail.player.positionName,
      clubName: detail.player.clubName,
      countryName: detail.player.countryName,
    },
    sources: {
      wikipediaUrl: detail.player.wikipediaUrl,
      rugbypassUrl: detail.player.rugbypassUrl,
      squadPositionName: detail.squads[0]?.positionName ?? null,
      clubTeamName: detail.clubTeam?.name ?? null,
      internationalTeamName: detail.internationalTeam?.name ?? null,
    },
    context: {},
  };

  const missingFields = detectMissingFields("player", {
    bioSummary: detail.player.bioSummary,
    positionName: detail.player.positionName,
    countryName: detail.player.countryName,
    birthDate: detail.player.birthDate,
    heightCm: detail.player.heightCm,
    weightKg: detail.player.weightKg,
    clubName: detail.player.clubName,
    fullName: detail.player.fullName,
    birthPlace: detail.player.birthPlace,
    imageUrl: detail.player.imageUrl,
  });

  const conflicts = detectProfileConflicts(snapshot).map((conflict) => ({
    field: conflict.field,
    label: conflict.label,
    values: conflict.values.map((value) => ({
      source: value.source,
      value: value.value,
    })),
  }));

  const confidenceScore = Math.max(
    0.2,
    Math.min(0.95, rating.ratingConfidence ?? 0.35 + sourceUrls.length * 0.05 - missingFields.length * 0.03),
  );

  return {
    playerId,
    name: detail.player.name,
    fullName: detail.player.fullName,
    birthDate: detail.player.birthDate,
    age,
    nationality: detail.player.countryName,
    nationCode: detail.player.nationCode,
    heightCm: detail.player.heightCm,
    weightKg: detail.player.weightKg,
    position: detail.player.positionName,
    currentClub: detail.player.clubName ?? detail.clubTeam?.name ?? null,
    internationalTeam: detail.internationalTeam?.name ?? null,
    isInternational: Boolean(detail.player.internationalTeamId || detail.internationalTeam),
    previousClubs,
    transferHistory: detail.transfers.map((row) => ({
      fromClub: row.fromClub,
      toClub: row.toClub,
      movementType: row.movementType ?? row.transferType,
      effectiveDate: row.effectiveDate ? String(row.effectiveDate) : null,
      seasonLabel: null,
    })),
    careerStints: detail.careerStints.map((row) => ({
      teamName: row.teamName,
      yearsLabel: row.yearsLabel,
      apps: row.apps,
      points: row.points,
      careerType: row.careerType,
    })),
    recentMatches: matchStats.slice(0, 5).map((row) => ({
      fixtureSlug: row.fixtureSlug,
      kickoffAt: row.kickoffAt,
      teamName: row.teamName,
      opponentName: row.opponentName,
      competitionName: row.competitionName,
      tries: row.tries,
      points: row.points,
      minutesPlayed: row.minutesPlayed,
    })),
    seasonStats: seasonStats.map((row) => ({
      seasonLabel: row.seasonLabel,
      competitionName: row.competitionName,
      teamName: row.teamName,
      appearances: row.appearances,
      tries: row.tries,
      points: row.points,
      carries: row.carries,
      metresCarried: row.metresCarried,
      tacklesCompleted: row.tacklesCompleted,
      attackRank: row.attackRank,
      defenceRank: row.defenceRank,
    })),
    scoringStats: detail.stats,
    rating,
    availability: {
      currentStatus: availabilityContext.isUnavailable
        ? (availabilityContext.unavailableReason ?? "Unavailable")
        : availabilityContext.returningPlayer
          ? "Returning"
          : "Available",
      isUnavailable: availabilityContext.isUnavailable,
      unavailableReason: availabilityContext.unavailableReason,
      returningPlayer: availabilityContext.returningPlayer,
      totalMatchesMissed: availabilityContext.totalMatchesMissed,
      expectedReturnDate:
        availabilityContext.currentInjury?.expectedReturnDate ??
        availabilityContext.currentSuspension?.suspensionEnd ??
        null,
      currentInjuryType: availabilityContext.currentInjury?.injuryType ?? null,
      currentSuspensionOffence: availabilityContext.currentSuspension?.offence ?? null,
      injuryHistoryCount: availabilityContext.injuryHistory.length,
      suspensionHistoryCount: availabilityContext.suspensionHistory.length,
    },
    legends: legends.map((legend) => ({
      level: legend.legendLevelLabel,
      reason: legend.reason,
      careerSummary: legend.careerSummary,
    })),
    sourceUrls,
    confidenceScore,
    missingFields,
    conflicts,
    generatedAt: new Date().toISOString(),
  };
}

export async function calculateAndPersistPlayerRating(playerId: string) {
  const packet = await buildPlayerBioPacket(playerId);
  await persistPlayerRating(playerId, packet);
  return packet.rating;
}

export async function persistPlayerRating(playerId: string, packet: PlayerBioPacket) {
  const db = getDb();
  const rating = packet.rating;
  await db
    .insert(playerRatings)
    .values({
      playerId,
      playerRating: rating.displayRating,
      currentAbility: rating.currentAbility,
      formScore: rating.formScore,
      teamImportance: rating.teamImportance,
      potential: rating.potential,
      reputation: rating.reputation,
      attackRating: rating.attackRating,
      defenceRating: rating.defenceRating,
      disciplineRating: rating.disciplineRating,
      ageProfile: rating.ageProfile,
      ratingConfidence: rating.ratingConfidence,
      ratingExplanation: rating.ratingExplanation,
      seasonRating: rating.seasonRating,
      careerHigh: rating.careerHigh,
      careerLow: rating.careerLow,
      formMovement: rating.formMovement,
      ratingMovement: rating.ratingMovement,
      lastFiveMatchRatings: rating.lastFiveMatchRatings,
      badges: rating.badges,
      manualOverrideRating: rating.manualOverrideRating,
      manualOverrideReason: rating.manualOverrideReason,
      calculatedAt: new Date(),
      dataPoints: rating.dataPoints,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: playerRatings.playerId,
      set: {
        playerRating: rating.displayRating,
        currentAbility: rating.currentAbility,
        formScore: rating.formScore,
        teamImportance: rating.teamImportance,
        potential: rating.potential,
        reputation: rating.reputation,
        attackRating: rating.attackRating,
        defenceRating: rating.defenceRating,
        disciplineRating: rating.disciplineRating,
        ageProfile: rating.ageProfile,
        ratingConfidence: rating.ratingConfidence,
        ratingExplanation: rating.ratingExplanation,
        seasonRating: rating.seasonRating,
        careerHigh: rating.careerHigh,
        careerLow: rating.careerLow,
        formMovement: rating.formMovement,
        ratingMovement: rating.ratingMovement,
        lastFiveMatchRatings: rating.lastFiveMatchRatings,
        badges: rating.badges,
        calculatedAt: new Date(),
        dataPoints: rating.dataPoints,
        updatedAt: new Date(),
      },
    });

  // Persist overall-ability history on material rating writes — never on public page load.
  if (
    rating.displayRating != null &&
    Number.isFinite(rating.displayRating) &&
    rating.displayRating > 10
  ) {
    try {
      const { ensureCurrentRatingHistorySnapshot } = await import("./player-rating-history-service");
      await ensureCurrentRatingHistorySnapshot({
        playerId,
        overallRating: rating.displayRating,
        attack: rating.attackRating,
        defence: rating.defenceRating,
        form: rating.formScore,
        confidence: rating.ratingConfidence,
        modelVersion: "player-rating-v1",
      });
    } catch {
      // History is best-effort — player_ratings row is the lineup source of truth.
    }
  }
}
