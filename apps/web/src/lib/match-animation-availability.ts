import { effectiveKickoffIso, remainingMs } from "./match-animation-countdown";
import { isFullTimeConfirmed } from "./match-animation-fulltime";

/** Public Match Animation lifecycle states. */
export type MatchAnimationPhase =
  | "scheduled"
  | "countdown"
  | "introduction"
  | "kick_off_delayed"
  | "waiting_confirmation"
  | "live"
  | "half_time"
  | "second_half"
  | "full_time"
  | "replay"
  | "not_activated"
  | "no_data"
  | "temporarily_unavailable"
  | "postponed"
  | "cancelled"
  | "abandoned"
  | "awarded";

export type MatchAnimationTabBadge = "LIVE" | "REPLAY" | "SOON" | "Unavailable" | null;

export type AnimationSettingsSnapshot = {
  trackerActivated: boolean;
  publicAnimationEnabled: boolean;
  publicReplayEnabled: boolean;
  countdownHeld: boolean;
  countdownCancelled: boolean;
  kickOffDelayed: boolean;
  revisedKickoffAt: string | null;
  kickOffConfirmedAt: string | null;
  matchStartedAt: string | null;
  fullTimeConfirmedAt: string | null;
};

export type ResolveAnimationInput = {
  fixtureStatus: string;
  period?: string | null;
  scheduledKickoffAt: string | null;
  serverNowIso: string;
  settings: AnimationSettingsSnapshot | null;
  /** Published key events available for public replay (no drafts). */
  publishedEventCount: number;
  /**
   * Squads / player stats / events detailed enough to power Match Animation.
   * When true, live + finished matches unlock without manual CMS activation.
   */
  hasDetailedPlayerData?: boolean;
  hasFullTimeEvent?: boolean;
};

export type ResolvedAnimationAvailability = {
  phase: MatchAnimationPhase;
  tabBadge: MatchAnimationTabBadge;
  effectiveKickoffAt: string | null;
  message: string | null;
  showIntroCountdown: boolean;
  showLiveControls: boolean;
  showReplayControls: boolean;
  /** Full-time (or abandoned/awarded) result screen is the default public view. */
  showFullTimeResult: boolean;
  fullTimeConfirmed: boolean;
};

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function isFinishedStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "result" ||
    s === "finished" ||
    s === "complete" ||
    s === "ft" ||
    s === "full_time" ||
    s === "full-time"
  );
}

function isLiveStatus(status: string, period?: string | null): boolean {
  const s = normalizeStatus(status);
  const p = (period ?? "").toLowerCase();
  if (s.includes("live") || s === "first half" || s === "second half" || s === "half time") return true;
  if (p === "first_half" || p === "second_half" || p === "half_time" || p === "live") return true;
  return false;
}

function isScheduledStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "fixture" ||
    s === "scheduled" ||
    s === "upcoming" ||
    s === "not_started" ||
    s === "" ||
    s === "pre_match"
  );
}

function defaultSettings(): AnimationSettingsSnapshot {
  return {
    trackerActivated: false,
    publicAnimationEnabled: false,
    publicReplayEnabled: false,
    countdownHeld: false,
    countdownCancelled: false,
    kickOffDelayed: false,
    revisedKickoffAt: null,
    kickOffConfirmedAt: null,
    matchStartedAt: null,
    fullTimeConfirmedAt: null,
  };
}

function baseFlags(partial: Omit<ResolvedAnimationAvailability, "showFullTimeResult" | "fullTimeConfirmed"> & {
  showFullTimeResult?: boolean;
  fullTimeConfirmed?: boolean;
}): ResolvedAnimationAvailability {
  return {
    ...partial,
    showFullTimeResult: partial.showFullTimeResult ?? false,
    fullTimeConfirmed: partial.fullTimeConfirmed ?? false,
  };
}

export function resolveMatchAnimationAvailability(
  input: ResolveAnimationInput,
): ResolvedAnimationAvailability {
  const settings = input.settings ?? defaultSettings();
  const status = normalizeStatus(input.fixtureStatus);

  if (status.includes("postpone")) {
    return baseFlags({
      phase: "postponed",
      tabBadge: "Unavailable",
      effectiveKickoffAt: input.scheduledKickoffAt,
      message: "Match postponed.",
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: false,
    });
  }

  if (status.includes("cancel")) {
    return baseFlags({
      phase: "cancelled",
      tabBadge: "Unavailable",
      effectiveKickoffAt: input.scheduledKickoffAt,
      message: "Match cancelled.",
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: false,
      showFullTimeResult: true,
      fullTimeConfirmed: true,
    });
  }

  if (status.includes("abandon")) {
    return baseFlags({
      phase: "abandoned",
      tabBadge: "REPLAY",
      effectiveKickoffAt: input.scheduledKickoffAt,
      message: null,
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: input.publishedEventCount > 0,
      showFullTimeResult: true,
      fullTimeConfirmed: true,
    });
  }

  if (status.includes("award")) {
    return baseFlags({
      phase: "awarded",
      tabBadge: "REPLAY",
      effectiveKickoffAt: input.scheduledKickoffAt,
      message: null,
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: input.publishedEventCount > 0,
      showFullTimeResult: true,
      fullTimeConfirmed: true,
    });
  }

  if (settings.countdownCancelled) {
    return baseFlags({
      phase: "cancelled",
      tabBadge: "Unavailable",
      effectiveKickoffAt: input.scheduledKickoffAt,
      message: "Match animation countdown has been cancelled.",
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: false,
    });
  }

  const effectiveKickoffAt = effectiveKickoffIso({
    scheduledKickoffAt: input.scheduledKickoffAt,
    kickOffDelayed: settings.kickOffDelayed,
    revisedKickoffAt: settings.revisedKickoffAt,
  });

  if (settings.kickOffDelayed && !effectiveKickoffAt) {
    return baseFlags({
      phase: "kick_off_delayed",
      tabBadge: "SOON",
      effectiveKickoffAt: null,
      message: "Kick-off delayed — awaiting an updated start time.",
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: false,
    });
  }

  const ftConfirmed = isFullTimeConfirmed({
    fixtureStatus: input.fixtureStatus,
    period: input.period,
    fullTimeConfirmedAt: settings.fullTimeConfirmedAt,
    hasFullTimeEvent: input.hasFullTimeEvent,
  });

  const detailed =
    Boolean(input.hasDetailedPlayerData) || input.publishedEventCount > 0;

  if (ftConfirmed || isFinishedStatus(status)) {
    const canReplay = input.publishedEventCount > 0;
    const canShow =
      canReplay ||
      detailed ||
      settings.publicAnimationEnabled ||
      settings.publicReplayEnabled;
    return baseFlags({
      phase: "full_time",
      tabBadge: canShow ? (canReplay ? "REPLAY" : null) : "Unavailable",
      effectiveKickoffAt,
      message: canShow
        ? null
        : "No detailed player data is available for this fixture.",
      showIntroCountdown: false,
      showLiveControls: false,
      showReplayControls: canReplay,
      showFullTimeResult: canShow,
      fullTimeConfirmed: true,
    });
  }

  if (isLiveStatus(status, input.period)) {
    // Manual CMS activation OR detailed player/event data unlocks live animation.
    // SDMS matches often have squads/stats/events before an operator hits "Start match".
    const liveUnlocked =
      settings.publicAnimationEnabled ||
      Boolean(settings.matchStartedAt) ||
      detailed;
    if (!liveUnlocked) {
      return baseFlags({
        phase: "not_activated",
        tabBadge: "Unavailable",
        effectiveKickoffAt,
        message: "Match animation has not been activated for this fixture.",
        showIntroCountdown: false,
        showLiveControls: false,
        showReplayControls: false,
      });
    }
    const period = (input.period ?? "").toLowerCase();
    if (period === "half_time" || status === "half time") {
      return baseFlags({
        phase: "half_time",
        tabBadge: "LIVE",
        effectiveKickoffAt,
        message: null,
        showIntroCountdown: false,
        showLiveControls: true,
        showReplayControls: false,
      });
    }
    if (period === "second_half" || status === "second half") {
      return baseFlags({
        phase: "second_half",
        tabBadge: "LIVE",
        effectiveKickoffAt,
        message: null,
        showIntroCountdown: false,
        showLiveControls: true,
        showReplayControls: false,
      });
    }
    return baseFlags({
      phase: "live",
      tabBadge: "LIVE",
      effectiveKickoffAt,
      message: null,
      showIntroCountdown: false,
      showLiveControls: true,
      showReplayControls: false,
    });
  }

  // Pre-match / scheduled path — countdown does not require activation.
  if (isScheduledStatus(status) || !isLiveStatus(status, input.period)) {
    if (settings.kickOffDelayed && effectiveKickoffAt) {
      return baseFlags({
        phase: "kick_off_delayed",
        tabBadge: "SOON",
        effectiveKickoffAt,
        message: "Kick-off delayed.",
        showIntroCountdown: !settings.countdownHeld,
        showLiveControls: false,
        showReplayControls: false,
      });
    }

    const serverNow = Date.parse(input.serverNowIso);
    const kickMs = effectiveKickoffAt ? Date.parse(effectiveKickoffAt) : NaN;
    if (Number.isFinite(kickMs) && Number.isFinite(serverNow)) {
      const left = remainingMs(kickMs, serverNow);
      if (left <= 0 && !settings.matchStartedAt && !settings.kickOffConfirmedAt) {
        return baseFlags({
          phase: "waiting_confirmation",
          tabBadge: "SOON",
          effectiveKickoffAt,
          message: "Waiting for kick-off confirmation.",
          showIntroCountdown: false,
          showLiveControls: false,
          showReplayControls: false,
        });
      }
      if (left > 0) {
        return baseFlags({
          phase: settings.countdownHeld ? "scheduled" : "countdown",
          tabBadge: "SOON",
          effectiveKickoffAt,
          message: settings.countdownHeld
            ? "Countdown is held by the match operator."
            : "Match animation will begin when tracking starts.",
          showIntroCountdown: !settings.countdownHeld,
          showLiveControls: false,
          showReplayControls: false,
        });
      }
    }

    return baseFlags({
      phase: "scheduled",
      tabBadge: "SOON",
      effectiveKickoffAt,
      message: "Match animation will begin when tracking starts.",
      showIntroCountdown: Boolean(effectiveKickoffAt) && !settings.countdownHeld,
      showLiveControls: false,
      showReplayControls: false,
    });
  }

  return baseFlags({
    phase: "temporarily_unavailable",
    tabBadge: "Unavailable",
    effectiveKickoffAt,
    message: "Match animation is temporarily unavailable.",
    showIntroCountdown: false,
    showLiveControls: false,
    showReplayControls: false,
  });
}

export const PUBLIC_MATCH_TAB_ORDER = [
  "details",
  "animation",
  "audio",
  "watchalong",
  "highlights",
  "stats",
  "player-stats",
  "lineups",
  "tables",
  "head-to-head",
  "betting",
] as const;
