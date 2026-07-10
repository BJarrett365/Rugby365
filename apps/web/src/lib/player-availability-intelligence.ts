import type { PlayerMatchStatsRow } from "./player-season-stats-service";
import type { PlayerRatingBadge, PlayerRatingSnapshot } from "./player-bio-types";
import {
  ACTIVE_INJURY_STATUSES,
  ACTIVE_SUSPENSION_STATUSES,
  daysBetween,
  injuryStatusLabel,
  isPlayerUnavailableInjury,
  isPlayerUnavailableSuspension,
  isRecentlyReturnedInjury,
  suspensionStatusLabel,
  type InjuryStatus,
  type SuspensionStatus,
} from "./availability-types";

export type PlayerAvailabilityInjury = {
  id: string;
  status: InjuryStatus;
  injuryType: string | null;
  bodyArea: string | null;
  injuryDate: string | null;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  matchesMissed: number;
};

export type PlayerAvailabilitySuspension = {
  id: string;
  status: SuspensionStatus;
  offence: string | null;
  cardType: string | null;
  fixtureId: string | null;
  suspensionStart: string | null;
  suspensionEnd: string | null;
  matchesRemaining: number | null;
};

export type PlayerAvailabilityContext = {
  currentInjury: PlayerAvailabilityInjury | null;
  currentSuspension: PlayerAvailabilitySuspension | null;
  injuryHistory: PlayerAvailabilityInjury[];
  suspensionHistory: PlayerAvailabilitySuspension[];
  totalMatchesMissed: number;
  isUnavailable: boolean;
  unavailableReason: string | null;
  returningPlayer: boolean;
  longAbsenceDays: number | null;
  excludedFormFixtureIds: string[];
};

const LONG_ABSENCE_DAYS = 56;

export function buildPlayerAvailabilityContext(input: {
  injuries: PlayerAvailabilityInjury[];
  suspensions: PlayerAvailabilitySuspension[];
}): PlayerAvailabilityContext {
  const currentInjury =
    input.injuries.find((row) => ACTIVE_INJURY_STATUSES.includes(row.status)) ?? null;
  const currentSuspension =
    input.suspensions.find((row) => ACTIVE_SUSPENSION_STATUSES.includes(row.status)) ?? null;

  const unavailableInjury = currentInjury && isPlayerUnavailableInjury(currentInjury.status);
  const unavailableSuspension =
    currentSuspension && isPlayerUnavailableSuspension(currentSuspension.status);

  const returningPlayer =
    (currentInjury != null && isRecentlyReturnedInjury(currentInjury.status)) ||
    currentSuspension?.status === "available_again";

  const longAbsenceDays = currentInjury
    ? daysBetween(currentInjury.injuryDate, currentInjury.actualReturnDate)
    : null;

  const excludedFormFixtureIds = currentSuspension?.fixtureId ? [currentSuspension.fixtureId] : [];

  const unavailableReason = unavailableSuspension
    ? `Suspended (${suspensionStatusLabel(currentSuspension!.status)})`
    : unavailableInjury
      ? `Injured (${injuryStatusLabel(currentInjury!.status)})`
      : currentInjury?.status === "doubtful"
        ? "Doubtful"
        : null;

  return {
    currentInjury,
    currentSuspension,
    injuryHistory: input.injuries,
    suspensionHistory: input.suspensions,
    totalMatchesMissed: input.injuries.reduce((sum, row) => sum + row.matchesMissed, 0),
    isUnavailable: Boolean(unavailableInjury || unavailableSuspension),
    unavailableReason,
    returningPlayer,
    longAbsenceDays:
      longAbsenceDays != null && longAbsenceDays >= LONG_ABSENCE_DAYS ? longAbsenceDays : null,
    excludedFormFixtureIds,
  };
}

export function filterMatchesForAvailabilityForm(
  matchStats: PlayerMatchStatsRow[],
  excludedFixtureIds: string[],
): PlayerMatchStatsRow[] {
  if (excludedFixtureIds.length === 0) return matchStats;
  const excluded = new Set(excludedFixtureIds);
  return matchStats.filter((row) => !row.fixtureId || !excluded.has(row.fixtureId));
}

export function applyAvailabilityToRatingSnapshot(
  snapshot: PlayerRatingSnapshot,
  context: PlayerAvailabilityContext,
): PlayerRatingSnapshot {
  const badges = [...snapshot.badges];

  if (context.returningPlayer) {
    if (!badges.some((badge) => badge.key === "returning_player")) {
      badges.push({
        key: "returning_player",
        label: "Returning Player",
        description: "Public availability shows the player is returning after injury or suspension.",
      });
    }
  }

  if (context.isUnavailable && (snapshot.teamImportance ?? 0) >= 78) {
    if (!badges.some((badge) => badge.key === "unavailable_key_player")) {
      badges.push({
        key: "unavailable_key_player",
        label: "Unavailable Key Player",
        description: "A key player is publicly unavailable — team selection impact is elevated.",
      });
    }
  }

  let formScore = snapshot.formScore;
  let ratingConfidence = snapshot.ratingConfidence ?? 0.5;
  const explanationParts = [snapshot.ratingExplanation ?? ""];

  if (context.longAbsenceDays != null) {
    ratingConfidence = Math.max(0.25, ratingConfidence - 0.15);
    if (formScore != null) {
      formScore = Math.max(35, formScore - 4);
    }
    explanationParts.push(
      `Form confidence is reduced after a long public absence (${context.longAbsenceDays} days). Current Ability is unchanged.`,
    );
  }

  if (context.isUnavailable) {
    explanationParts.push(
      `Public availability: ${context.unavailableReason}. Current Ability is not reduced for injury or suspension.`,
    );
  }

  if (context.currentSuspension?.cardType === "red" && context.currentSuspension.fixtureId) {
    explanationParts.push(
      "Red-card match is not double-counted against form while the linked public suspension is active.",
    );
  }

  return {
    ...snapshot,
    currentAbility: snapshot.currentAbility,
    formScore,
    ratingConfidence,
    badges,
    ratingExplanation: explanationParts.filter(Boolean).join(" "),
  };
}
