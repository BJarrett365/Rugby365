import { attackScore, defenceScore, type AggregatedPerformanceStats } from "@rugby365/import-sdk";
import type { PlayerAgeProfile, PlayerRatingBadge, PlayerRatingSnapshot } from "./player-bio-types";
import { calculatePlayerAge } from "./player-profile-utils";
import type { PlayerMatchStatsRow, PlayerSeasonStatsRow } from "./player-season-stats-service";
import { CAREER_RATING_MODEL } from "./match-rating-math";

/** career-v1 lives here — do not replace with Match Rating; keep both systems. */
export { CAREER_RATING_MODEL };

export type RatingInput = {
  playerId: string;
  birthDate: string | null;
  internationalTeamId: string | null;
  seasonStats: PlayerSeasonStatsRow[];
  matchStats: PlayerMatchStatsRow[];
  fixtureCount: number;
  hasLegend: boolean;
  previous?: PlayerRatingSnapshot | null;
  manualOverrideRating?: number | null;
  manualOverrideReason?: string | null;
};

const MATERIAL_RATING_CHANGE = 5;
const MATERIAL_FORM_CHANGE = 8;

export function ageProfileForAge(age: number | null): PlayerAgeProfile | null {
  if (age == null) return null;
  if (age < 21) return "development";
  if (age < 24) return "emerging";
  if (age <= 30) return "prime";
  return "veteran";
}

function clampRating(value: number): number {
  return Math.max(35, Math.min(99, Math.round(value)));
}

function toPerformanceStats(row: {
  appearances?: number;
  minutesPlayed: number;
  tries: number;
  points: number;
  carries: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  tryAssists: number;
  lineBreaks: number;
  defendersBeaten: number;
  touches: number;
  postContactMetres: number;
  ruckArrivalEffectiveness: number;
}): AggregatedPerformanceStats {
  return {
    appearances: row.appearances ?? 1,
    minutesPlayed: row.minutesPlayed,
    tries: row.tries,
    points: row.points,
    carries: row.carries,
    metresCarried: row.metresCarried,
    tacklesMade: row.tacklesMade,
    tacklesCompleted: row.tacklesCompleted,
    missedTackles: 0,
    dominantTackles: row.dominantTackles,
    turnoversWon: row.turnoversWon,
    tryAssists: row.tryAssists,
    lineBreaks: row.lineBreaks,
    defendersBeaten: row.defendersBeaten,
    touches: row.touches,
    postContactMetres: row.postContactMetres,
    ruckArrivalEffectiveness: row.ruckArrivalEffectiveness,
    passes: 0,
    offloads: 0,
    kicks: 0,
    kicksFromHand: 0,
    kickFromHandMetres: 0,
    kickPossessionRetained: 0,
    badPasses: 0,
    droppedCatch: 0,
    handlingError: 0,
    turnoversConceded: 0,
    runs: 0,
    gainLine: 0,
    carriesMetres: 0,
    carriesCrossedGainLine: 0,
    carriesNotMadeGainLine: 0,
  };
}

function matchRating(row: PlayerMatchStatsRow): number {
  const stats = toPerformanceStats(row);
  const attack = attackScore(stats);
  const defence = defenceScore(stats);
  const minutesFactor = row.minutesPlayed > 0 ? Math.min(1, row.minutesPlayed / 80) : 0.4;
  return clampRating(48 + attack * 0.35 + defence * 0.25 + minutesFactor * 12);
}

export function buildPlayerRatingSnapshot(input: RatingInput): PlayerRatingSnapshot {
  const age = calculatePlayerAge(input.birthDate);
  const ageProfile = ageProfileForAge(age);
  const recentMatches = [...input.matchStats]
    .sort((a, b) => String(b.kickoffAt ?? "").localeCompare(String(a.kickoffAt ?? "")))
    .slice(0, 5);
  const lastFiveMatchRatings = recentMatches.map((row) => matchRating(row));
  const formScore =
    lastFiveMatchRatings.length > 0
      ? Math.round(
          lastFiveMatchRatings.reduce((sum, rating) => sum + rating, 0) / lastFiveMatchRatings.length,
        )
      : null;

  const currentSeason = input.seasonStats[0];
  const attackRating = currentSeason
    ? clampRating(50 + attackScore(toPerformanceStats(currentSeason)) * 0.45)
    : null;
  const defenceRating = currentSeason
    ? clampRating(50 + defenceScore(toPerformanceStats(currentSeason)) * 0.45)
    : null;

  const currentAbility =
    attackRating != null && defenceRating != null
      ? Math.round(attackRating * 0.52 + defenceRating * 0.48)
      : formScore;

  const seasonRating = currentAbility;
  const appearances = currentSeason?.appearances ?? input.fixtureCount;
  const teamImportance = appearances > 0 ? clampRating(55 + Math.min(30, appearances * 2)) : null;
  const potential =
    age != null
      ? clampRating((currentAbility ?? 60) + Math.max(0, 24 - age) * 1.5)
      : null;
  const reputation = clampRating(
    50 + Math.min(25, appearances) + (input.hasLegend ? 12 : 0) + (input.internationalTeamId ? 8 : 0),
  );

  const matchRatings = input.matchStats.map((row) => matchRating(row));
  const careerHigh = matchRatings.length ? Math.max(...matchRatings) : formScore;
  const careerLow = matchRatings.length ? Math.min(...matchRatings) : formScore;
  const previousForm = input.previous?.formScore ?? formScore;
  const formMovement =
    formScore != null && previousForm != null ? formScore - previousForm : null;
  const calculatedRating =
    currentAbility != null && formScore != null && teamImportance != null
      ? Math.round(currentAbility * 0.45 + formScore * 0.35 + teamImportance * 0.2)
      : currentAbility ?? formScore ?? teamImportance ?? reputation;

  const dataPoints = input.matchStats.length + input.seasonStats.length + (input.fixtureCount > 0 ? 1 : 0);
  const ratingConfidence = Math.max(
    0.2,
    Math.min(0.95, 0.25 + dataPoints * 0.04 + (currentSeason ? 0.15 : 0)),
  );

  const displayRating = input.manualOverrideRating ?? calculatedRating;
  const previousDisplay = input.previous?.displayRating ?? input.previous?.playerRating;
  const ratingMovement =
    displayRating != null && previousDisplay != null ? displayRating - previousDisplay : null;

  const badges = buildBadges({
    formMovement,
    ratingMovement,
    ageProfile,
    teamImportance,
    internationalTeamId: input.internationalTeamId,
    previousBadges: input.previous?.badges ?? [],
  });

  const ratingExplanation = buildRatingExplanation({
    displayRating,
    calculatedRating,
    formScore,
    formMovement,
    attackRating,
    defenceRating,
    teamImportance,
    ratingConfidence,
    manualOverrideRating: input.manualOverrideRating ?? null,
    lastFiveMatchRatings,
    badges,
  });

  return {
    playerRating: displayRating,
    displayRating,
    calculatedRating,
    currentAbility,
    formScore,
    teamImportance,
    potential,
    reputation,
    attackRating,
    defenceRating,
    disciplineRating: null,
    ageProfile,
    ratingConfidence,
    ratingExplanation,
    seasonRating,
    careerHigh: careerHigh ?? null,
    careerLow: careerLow ?? null,
    formMovement,
    ratingMovement,
    lastFiveMatchRatings,
    badges,
    manualOverrideRating: input.manualOverrideRating ?? null,
    manualOverrideReason: input.manualOverrideReason ?? null,
    dataPoints,
  };
}

function buildBadges(input: {
  formMovement: number | null;
  ratingMovement: number | null;
  ageProfile: PlayerAgeProfile | null;
  teamImportance: number | null;
  internationalTeamId: string | null;
  previousBadges: PlayerRatingBadge[];
}): PlayerRatingBadge[] {
  const badges: PlayerRatingBadge[] = [];
  if ((input.formMovement ?? 0) >= MATERIAL_FORM_CHANGE) {
    badges.push({
      key: "in_form",
      label: "In Form",
      description: "Form score has risen materially across recent matches.",
    });
  }
  if ((input.ratingMovement ?? 0) >= MATERIAL_RATING_CHANGE) {
    badges.push({
      key: "rising_star",
      label: "Rising Star",
      description: "Player rating has increased across recent verified performances.",
    });
  }
  if ((input.teamImportance ?? 0) >= 78) {
    badges.push({
      key: "key_player",
      label: "Key Player",
      description: "High team importance based on verified selection and minutes.",
    });
  }
  if (input.internationalTeamId) {
    badges.push({
      key: "international",
      label: "International",
      description: "Linked to an international team in Rugby365.",
    });
  }
  if (input.ageProfile === "development" || input.ageProfile === "emerging") {
    badges.push({
      key: "development_profile",
      label: "Development Profile",
      description: "Player sits in a development or emerging age band.",
    });
  }

  for (const previous of input.previousBadges) {
    if (!badges.some((badge) => badge.key === previous.key)) {
      badges.push(previous);
    }
  }
  return badges;
}

export function buildRatingExplanation(input: {
  displayRating: number | null;
  calculatedRating: number | null;
  formScore: number | null;
  formMovement: number | null;
  attackRating: number | null;
  defenceRating: number | null;
  teamImportance: number | null;
  ratingConfidence: number;
  manualOverrideRating: number | null;
  lastFiveMatchRatings: number[];
  badges: PlayerRatingBadge[];
}): string {
  const parts: string[] = [];
  if (input.manualOverrideRating != null && input.calculatedRating != null) {
    parts.push(
      `Public rating ${input.displayRating} is editor-overridden; calculated rating is ${input.calculatedRating}.`,
    );
  } else if (input.displayRating != null) {
    parts.push(`Rugby365 Player Rating is ${input.displayRating}.`);
  }

  if (input.formScore != null) {
    parts.push(`Form score is ${input.formScore}.`);
  }
  if (input.formMovement != null && Math.abs(input.formMovement) >= 3) {
    parts.push(
      `Form has ${input.formMovement > 0 ? "risen" : "fallen"} by ${Math.abs(input.formMovement)} across recent matches.`,
    );
  }
  if (input.attackRating != null && input.defenceRating != null) {
    parts.push(`Attack rating ${input.attackRating}, defence rating ${input.defenceRating}.`);
  }
  if (input.teamImportance != null) {
    parts.push(`Team importance score is ${input.teamImportance}.`);
  }
  if (input.lastFiveMatchRatings.length >= 2) {
    const first = input.lastFiveMatchRatings.at(-1)!;
    const last = input.lastFiveMatchRatings[0]!;
    if (last - first >= MATERIAL_RATING_CHANGE) {
      parts.push(
        `Rating has risen from ${first} to ${last} across the last ${input.lastFiveMatchRatings.length} verified matches.`,
      );
    }
  }
  if (input.badges.length) {
    parts.push(`Badges: ${input.badges.map((badge) => badge.label).join(", ")}.`);
  }
  if (input.ratingConfidence < 0.45) {
    parts.push("Profile is based on limited verified match data.");
  }
  return parts.join(" ");
}

export function shouldTriggerBioRefresh(input: {
  previousPacket: { rating: PlayerRatingSnapshot; currentClub: string | null; position: string | null; isInternational: boolean } | null;
  nextPacket: { rating: PlayerRatingSnapshot; currentClub: string | null; position: string | null; isInternational: boolean };
  trigger: import("./player-bio-types").BioRefreshTrigger;
}): { shouldRefresh: boolean; reason: string | null } {
  if (!input.previousPacket) {
    return { shouldRefresh: true, reason: "Initial bio suggestion" };
  }

  if (input.trigger === "weekly_refresh") {
    return { shouldRefresh: true, reason: "Weekly scheduled bio refresh" };
  }

  if (
    input.trigger === "injury_confirmed" ||
    input.trigger === "injury_return_updated" ||
    input.trigger === "player_returned_to_training" ||
    input.trigger === "player_returned_to_selection" ||
    input.trigger === "suspension_began" ||
    input.trigger === "suspension_ended"
  ) {
    return { shouldRefresh: true, reason: triggerLabel(input.trigger) };
  }

  if (input.previousPacket.currentClub !== input.nextPacket.currentClub) {
    return { shouldRefresh: true, reason: "Player changed club" };
  }
  if (input.previousPacket.position !== input.nextPacket.position) {
    return { shouldRefresh: true, reason: "Player position changed" };
  }
  if (input.previousPacket.isInternational !== input.nextPacket.isInternational) {
    return { shouldRefresh: true, reason: "International status changed" };
  }

  const formDelta = Math.abs(
    (input.nextPacket.rating.formScore ?? 0) - (input.previousPacket.rating.formScore ?? 0),
  );
  if (formDelta >= MATERIAL_FORM_CHANGE) {
    return {
      shouldRefresh: true,
      reason: `Form Rating ${formDelta > 0 ? "increased" : "changed"} by ${formDelta >= 0 ? "+" : ""}${(input.nextPacket.rating.formScore ?? 0) - (input.previousPacket.rating.formScore ?? 0)}`,
    };
  }

  const ratingDelta = Math.abs(
    (input.nextPacket.rating.displayRating ?? 0) - (input.previousPacket.rating.displayRating ?? 0),
  );
  if (ratingDelta >= MATERIAL_RATING_CHANGE) {
    return {
      shouldRefresh: true,
      reason: `Player Rating changed by ${(input.nextPacket.rating.displayRating ?? 0) - (input.previousPacket.rating.displayRating ?? 0) >= 0 ? "+" : ""}${(input.nextPacket.rating.displayRating ?? 0) - (input.previousPacket.rating.displayRating ?? 0)}`,
    };
  }

  const previousBadges = new Set(input.previousPacket.rating.badges.map((badge) => badge.key));
  const newBadge = input.nextPacket.rating.badges.find((badge) => !previousBadges.has(badge.key));
  if (newBadge) {
    return { shouldRefresh: true, reason: `Player received ${newBadge.label} badge` };
  }

  if (input.previousPacket.rating.ageProfile !== input.nextPacket.rating.ageProfile) {
    return {
      shouldRefresh: true,
      reason: `Player moved from ${input.previousPacket.rating.ageProfile ?? "unknown"} to ${input.nextPacket.rating.ageProfile ?? "unknown"} age profile`,
    };
  }

  if (input.trigger === "match_stats_imported" || input.trigger === "transfer_added") {
    return { shouldRefresh: true, reason: triggerLabel(input.trigger) };
  }

  return { shouldRefresh: false, reason: null };
}

function triggerLabel(trigger: import("./player-bio-types").BioRefreshTrigger): string {
  switch (trigger) {
    case "match_stats_imported":
      return "New match stats imported";
    case "transfer_added":
      return "Transfer added";
    case "club_changed":
      return "Club changed";
    case "international_status_changed":
      return "International status changed";
    case "rating_changed":
      return "Player rating changed materially";
    case "badge_added":
      return "New player badge added";
    case "age_band_changed":
      return "Player age profile changed";
    case "weekly_refresh":
      return "Weekly scheduled refresh";
    case "manual":
      return "Manual bio refresh requested";
    case "injury_confirmed":
      return "Major public injury confirmed";
    case "injury_return_updated":
      return "Public expected return date changed";
    case "player_returned_to_training":
      return "Player returned to training";
    case "player_returned_to_selection":
      return "Player returned to match selection";
    case "suspension_began":
      return "Public suspension began";
    case "suspension_ended":
      return "Public suspension ended";
    default:
      return "Bio refresh triggered";
  }
}

export { MATERIAL_FORM_CHANGE, MATERIAL_RATING_CHANGE };
