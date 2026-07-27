/** Server-anchored kick-off countdown helpers (no client-clock drift). */

export type CountdownParts = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
};

export function remainingMs(targetUtcMs: number, serverNowMs: number): number {
  return targetUtcMs - serverNowMs;
}

export function parseCountdownParts(totalMs: number): CountdownParts {
  const isPast = totalMs <= 0;
  const abs = Math.max(0, totalMs);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs, days, hours, minutes, seconds, isPast };
}

/** Format for display: `2 DAYS 04:18:32` or `00:18:32`. */
export function formatCountdownDisplay(parts: CountdownParts): string {
  const hh = String(parts.hours).padStart(2, "0");
  const mm = String(parts.minutes).padStart(2, "0");
  const ss = String(parts.seconds).padStart(2, "0");
  if (parts.days > 0) {
    const dayLabel = parts.days === 1 ? "DAY" : "DAYS";
    return `${parts.days} ${dayLabel} ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

export function countdownUrgency(totalMs: number): "normal" | "under_10m" | "under_1m" | "zero" {
  if (totalMs <= 0) return "zero";
  if (totalMs < 60_000) return "under_1m";
  if (totalMs < 600_000) return "under_10m";
  return "normal";
}

/**
 * Effective kick-off for countdown: revised time when delayed, else scheduled.
 * Returns null when delayed with no revised time (awaiting update).
 */
export function effectiveKickoffIso(input: {
  scheduledKickoffAt: string | null | undefined;
  kickOffDelayed: boolean;
  revisedKickoffAt: string | null | undefined;
}): string | null {
  if (input.kickOffDelayed) {
    return input.revisedKickoffAt?.trim() || null;
  }
  return input.scheduledKickoffAt?.trim() || null;
}

/**
 * Estimate current server time from an anchor pair so hidden-tab / sleep
 * does not accumulate 1-second errors.
 */
export function estimateServerNowMs(anchor: {
  serverNowIso: string;
  clientReceivedAtMs: number;
  nowMs?: number;
}): number {
  const serverAtReceive = Date.parse(anchor.serverNowIso);
  if (!Number.isFinite(serverAtReceive)) return anchor.nowMs ?? Date.now();
  const clientNow = anchor.nowMs ?? Date.now();
  const elapsed = Math.max(0, clientNow - anchor.clientReceivedAtMs);
  return serverAtReceive + elapsed;
}
