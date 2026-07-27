/** Build progressive, exclusive possession buckets for Match Momentum. */

export type MomentumBucket = {
  minute: number;
  /** 0–1 bar height for home; 0 when away has possession or bucket not yet played. */
  home: number;
  /** 0–1 bar height for away; 0 when home has possession or bucket not yet played. */
  away: number;
  label: string;
  /** Which side owns this slice (null = blank / contested / not played). */
  possession: "home" | "away" | null;
};

export const MOMENTUM_BUCKETS = 40; // 2-minute buckets across 80'
export const MOMENTUM_MATCH_MINUTES = 80;

export function resolveMomentumElapsedMinute(input: {
  matchMinute?: number | null;
  status?: string | null;
  eventMinutes?: number[];
}): number {
  const status = (input.status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const finished = ["finished", "full_time", "ft", "completed", "result", "complete"].includes(
    status,
  );
  const maxEvent = (input.eventMinutes ?? []).reduce((m, n) => Math.max(m, n || 0), 0);

  if (finished) {
    return Math.min(100, Math.max(MOMENTUM_MATCH_MINUTES, maxEvent || MOMENTUM_MATCH_MINUTES));
  }

  if (
    ["scheduled", "not_started", "ns", "fixture", "upcoming", "postponed", "cancelled"].includes(
      status,
    )
  ) {
    return 0;
  }

  const clock =
    input.matchMinute != null && Number.isFinite(Number(input.matchMinute))
      ? Math.max(0, Number(input.matchMinute))
      : 0;
  return Math.min(100, Math.max(clock, maxEvent));
}

/** Turn shared possession into exclusive home/away bar heights. */
export function exclusivePossessionBars(
  homeShare: number,
  awayShare: number,
): Pick<MomentumBucket, "home" | "away" | "possession"> {
  const home = Math.max(0, homeShare);
  const away = Math.max(0, awayShare);
  if (home <= 0 && away <= 0) {
    return { home: 0, away: 0, possession: null };
  }
  if (home === away) {
    return { home: 0, away: 0, possession: null };
  }
  const total = home + away;
  const winnerShare = Math.max(home, away) / total;
  // Stronger share → taller bar; keep a visible minimum when one side owns the slice.
  const intensity = Math.max(0.28, Math.min(1, 0.2 + winnerShare * 0.8));
  if (home > away) return { home: intensity, away: 0, possession: "home" };
  return { home: 0, away: intensity, possession: "away" };
}

export function buildMomentumBuckets(input: {
  homeFirst: number;
  awayFirst: number;
  homeSecond: number;
  awaySecond: number;
  elapsedMinute: number;
  eventBoosts?: Array<{ minuteStart: number; minuteEnd: number; home: number; away: number }>;
}): MomentumBucket[] {
  const buckets: MomentumBucket[] = [];
  const elapsed = Math.max(0, input.elapsedMinute);

  for (let i = 0; i < MOMENTUM_BUCKETS; i++) {
    const minuteStart = (i / MOMENTUM_BUCKETS) * MOMENTUM_MATCH_MINUTES;
    const minuteEnd = ((i + 1) / MOMENTUM_BUCKETS) * MOMENTUM_MATCH_MINUTES;
    const label = `${Math.round(minuteStart)}'–${Math.round(minuteEnd)}'`;

    // Not played yet — stay blank so the chart builds as the match progresses.
    if (minuteStart >= elapsed) {
      buckets.push({
        minute: Math.round(minuteEnd),
        home: 0,
        away: 0,
        label,
        possession: null,
      });
      continue;
    }

    const firstHalf = minuteStart < 40;
    let home = firstHalf ? input.homeFirst : input.homeSecond;
    let away = firstHalf ? input.awayFirst : input.awaySecond;
    const sum = home + away;
    if (sum > 0) {
      home /= sum;
      away /= sum;
    } else {
      home = 0;
      away = 0;
    }

    const boost = input.eventBoosts?.find(
      (b) => b.minuteStart === minuteStart && b.minuteEnd === minuteEnd,
    );
    if (boost) {
      home = Math.min(0.95, home + boost.home);
      away = Math.min(0.95, away + boost.away);
      const renorm = home + away;
      if (renorm > 0) {
        home /= renorm;
        away /= renorm;
      }
    }

    // Event-only ownership when half possession is missing.
    if (home === 0 && away === 0 && boost) {
      home = boost.home;
      away = boost.away;
    }

    const exclusive = exclusivePossessionBars(home, away);
    buckets.push({
      minute: Math.round(minuteEnd),
      home: exclusive.home,
      away: exclusive.away,
      label,
      possession: exclusive.possession,
    });
  }

  return buckets;
}
