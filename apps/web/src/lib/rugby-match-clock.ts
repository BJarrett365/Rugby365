/**
 * Public rugby union match clock labels (1H / HT / 2H / FT).
 * Regulation: 2 × 40 minutes. Clock may run past 40' / 80' until the ball is dead.
 */

export type RugbyMatchClockPeriod =
  | "not_started"
  | "first_half"
  | "half_time"
  | "second_half"
  | "full_time"
  | "unknown";

export type RugbyMatchClockInput = {
  status?: string | null;
  period?: string | null;
  matchMinute?: number | null;
  matchSecond?: number | null;
  /** Latest event minute as a fallback when CMS clock is stale. */
  eventMinute?: number | null;
};

export type RugbyMatchClock = {
  period: RugbyMatchClockPeriod;
  minute: number;
  second: number;
  /** Public label: 24' · 40+2' · HT · 80+3' · FT · Live */
  label: string;
  isLive: boolean;
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
}

/** Map SDMS / CMS status or period strings into a clock period. */
export function resolveRugbyMatchPeriod(
  status?: string | null,
  period?: string | null,
): RugbyMatchClockPeriod {
  const s = normalizeToken(status);
  const p = normalizeToken(period);

  if (
    s === "full_time" ||
    s === "fulltime" ||
    s === "result" ||
    s === "finished" ||
    s === "complete" ||
    s === "ft" ||
    p === "full_time" ||
    p === "fulltime" ||
    p === "ft"
  ) {
    return "full_time";
  }
  if (
    s === "half_time" ||
    s === "halftime" ||
    s === "ht" ||
    p === "half_time" ||
    p === "halftime" ||
    p === "ht"
  ) {
    return "half_time";
  }
  if (
    p === "second_half" ||
    s === "second_half" ||
    s.includes("second_half") ||
    /\bsecond\b/.test(s)
  ) {
    return "second_half";
  }
  if (
    p === "first_half" ||
    s === "first_half" ||
    s.includes("first_half") ||
    /\bfirst\b/.test(s) ||
    s === "live" ||
    p === "live"
  ) {
    return "first_half";
  }
  if (s === "scheduled" || s === "fixture" || s === "upcoming" || p === "not_started") {
    return "not_started";
  }
  return "unknown";
}

/**
 * Format regulation + stoppage time for public UI.
 * Past 40' in first half → 40+N' ; past 80' in second half → 80+N'.
 */
export function formatRugbyMatchClockLabel(
  minute: number,
  period: RugbyMatchClockPeriod,
): string {
  if (period === "half_time") return "HT";
  if (period === "full_time") return "FT";
  if (period === "not_started") return "—";

  const m = Math.max(0, Math.floor(minute));
  if (period === "first_half" && m > 40) {
    return `40+${m - 40}'`;
  }
  if (period === "second_half" && m > 80) {
    return `80+${m - 80}'`;
  }
  if (m > 0) return `${m}'`;
  if (period === "first_half" || period === "second_half") return "1'";
  return "Live";
}

export function resolveRugbyMatchClock(input: RugbyMatchClockInput): RugbyMatchClock {
  const period = resolveRugbyMatchPeriod(input.status, input.period);
  const cmsMinute = Number(input.matchMinute ?? 0);
  const eventMinute = Number(input.eventMinute ?? 0);
  const minute = Math.max(
    0,
    Math.floor(
      Number.isFinite(cmsMinute) && cmsMinute > 0
        ? cmsMinute
        : Number.isFinite(eventMinute) && eventMinute > 0
          ? eventMinute
          : 0,
    ),
  );
  const second = Math.max(0, Math.min(59, Math.floor(Number(input.matchSecond ?? 0) || 0)));
  const isLive = period === "first_half" || period === "second_half" || period === "half_time";

  return {
    period,
    minute: period === "half_time" ? Math.max(minute, 40) : minute,
    second,
    label: formatRugbyMatchClockLabel(
      period === "half_time" ? Math.max(minute, 40) : minute,
      period,
    ),
    isLive,
  };
}

/** Map SDMS status text onto CMS fixture period column. */
export function sdmsStatusToPeriod(status: string): string {
  const period = resolveRugbyMatchPeriod(status, status);
  if (period === "unknown") return "not_started";
  return period;
}
