/** Bucket clock to whole minutes so second-level ticks do not force rebuilds. */
export function narrativeProgressBucket(matchMinute: number): number {
  return Math.floor(Math.max(0, matchMinute));
}

export type NarrativeRefreshState = {
  status: string;
  period: string;
  homeScore: number;
  awayScore: number;
  matchMinute: number;
  eventCount: number;
  maxSequence: number;
};

export function buildNarrativeRefreshSignature(state: NarrativeRefreshState): string {
  return [
    state.status,
    state.period || "—",
    state.homeScore,
    state.awayScore,
    narrativeProgressBucket(state.matchMinute),
    state.eventCount,
    state.maxSequence,
  ].join("|");
}
