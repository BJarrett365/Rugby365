/**
 * Pure helpers for 1× match-clock (normal time) audio commentary playback.
 */

import type { MatchAnimationAudioCaption } from "./match-animation-public-audio";
import { captionSpeechKey } from "./match-commentary-speech";

export type NormalTimePhase = "idle" | "playing" | "paused";

/** Lag threshold (match seconds) before skipping stale bursts to the latest due. */
export const NORMAL_TIME_CATCH_UP_SECONDS = 20;

export function captionMatchSeconds(caption: MatchAnimationAudioCaption): number {
  return (
    Math.max(0, caption.minute) * 60 + Math.max(0, Math.min(59, caption.second))
  );
}

export function clockFromMatchSeconds(totalSeconds: number): {
  minute: number;
  second: number;
} {
  const s = Math.max(0, Math.floor(totalSeconds));
  return { minute: Math.floor(s / 60), second: s % 60 };
}

export function formatMatchClock(minute: number, second: number): string {
  return `${String(Math.max(0, minute)).padStart(2, "0")}:${String(
    Math.max(0, Math.min(59, second)),
  ).padStart(2, "0")}`;
}

/** Captions due at or before the clock that have not been played/skipped. */
export function dueCaptionsForClock(
  captions: MatchAnimationAudioCaption[],
  clockSeconds: number,
  handledKeys: ReadonlySet<string>,
): MatchAnimationAudioCaption[] {
  return captions
    .filter((c) => captionMatchSeconds(c) <= clockSeconds)
    .filter((c) => !handledKeys.has(captionSpeechKey(c)))
    .sort((a, b) => captionMatchSeconds(a) - captionMatchSeconds(b));
}

/**
 * Choose the next burst for normal-time play.
 * - If speech is busy: wait (null).
 * - If lag on the earliest due exceeds catch-up threshold with a backlog: take latest.
 * - Otherwise play earliest due in order.
 */
export function selectNormalTimeBurst(input: {
  captions: MatchAnimationAudioCaption[];
  clockSeconds: number;
  handledKeys: ReadonlySet<string>;
  speechBusy: boolean;
  catchUpSeconds?: number;
}): {
  play: MatchAnimationAudioCaption | null;
  skipKeys: string[];
} {
  if (input.speechBusy) {
    return { play: null, skipKeys: [] };
  }

  const due = dueCaptionsForClock(
    input.captions,
    input.clockSeconds,
    input.handledKeys,
  );
  if (!due.length) return { play: null, skipKeys: [] };

  const threshold = input.catchUpSeconds ?? NORMAL_TIME_CATCH_UP_SECONDS;
  const earliest = due[0]!;
  const latest = due[due.length - 1]!;
  const lagEarliest = input.clockSeconds - captionMatchSeconds(earliest);

  if (due.length > 1 && lagEarliest > threshold) {
    const skipKeys = due
      .slice(0, -1)
      .map((c) => captionSpeechKey(c));
    return { play: latest, skipKeys };
  }

  return { play: earliest, skipKeys: [] };
}

/** End of normal-time window from captions (at least 80:00). */
export function normalTimeEndSeconds(
  captions: MatchAnimationAudioCaption[],
  minMinute = 80,
): number {
  if (!captions.length) return minMinute * 60;
  const last = Math.max(...captions.map((c) => captionMatchSeconds(c)));
  return Math.max(minMinute * 60, last);
}

export function normalTimeStatusLabel(input: {
  phase: NormalTimePhase;
  minute: number;
  second: number;
}): string {
  const clock = formatMatchClock(input.minute, input.second);
  if (input.phase === "playing") return `Normal time ${clock}`;
  if (input.phase === "paused") return `Normal time paused ${clock}`;
  return "Normal time";
}
