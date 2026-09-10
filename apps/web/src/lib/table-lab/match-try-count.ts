type TryCountEvent = {
  eventType: string;
  minute: number;
  teamId: string | null;
  sequenceNo?: number | null;
  sourceProvider?: string | null;
  payload?: unknown;
};

function isTryEventType(eventType: string): boolean {
  const type = eventType.toLowerCase().replace(/[\s-]+/g, "_");
  return type === "try" || type === "penalty_try";
}

function playerKey(payload: unknown): string {
  const value = (payload ?? {}) as Record<string, unknown>;
  return String(value.playerName ?? value.player ?? "")
    .trim()
    .toLowerCase();
}

function uniqueTryCount(events: TryCountEvent[]): number {
  const seen = new Set<string>();
  events.forEach((event, index) => {
    const player = playerKey(event.payload);
    const key =
      event.minute > 0
        ? `${event.minute}|${player}`
        : `${event.sequenceNo ?? index}|${player}`;
    seen.add(key);
  });
  return seen.size;
}

/**
 * Count tries for one side, ignoring duplicate Wikipedia imports
 * (`wikipedia` timed rows + `wikipedia-rugby-box` untimed copies of the same tries).
 */
export function countDedupedTriesForTeam(events: TryCountEvent[], teamId: string): number | null {
  const tries = events.filter((event) => isTryEventType(event.eventType) && event.teamId === teamId);
  if (!tries.length) return null;

  const timed = tries.filter((event) => event.minute > 0);
  const wikipedia = tries.filter((event) => (event.sourceProvider ?? "").toLowerCase() === "wikipedia");
  const wikipediaTimed = wikipedia.filter((event) => event.minute > 0);
  const source = wikipediaTimed.length
    ? wikipediaTimed
    : timed.length
      ? timed
      : wikipedia.length
        ? wikipedia
        : tries;
  return uniqueTryCount(source);
}

function firstTryCount(events: TryCountEvent[], teamIds: Array<string | null | undefined>): number | null {
  for (const teamId of teamIds) {
    if (!teamId) continue;
    const count = countDedupedTriesForTeam(events, teamId);
    if (count != null) return count;
  }
  return null;
}

/**
 * Resolve try counts for standings.
 * Prefer match events over `team_match_stats.tries` because empty/duplicate
 * stat rows are often stored as 0 and would hide Wikipedia try lists.
 * A side with no try events still counts as 0 when the fixture has try data,
 * so the 2016+ three-try-lead bonus can be applied against a blank scoreline.
 */
export function resolveFixtureTryCounts(input: {
  events: TryCountEvent[];
  teamIds: Array<string | null | undefined>;
  opponentIds: Array<string | null | undefined>;
  statTries?: number | null;
  opponentStatTries?: number | null;
}): { triesFor: number | null; triesAgainst: number | null } {
  const fixtureHasTryEvents = input.events.some((event) => isTryEventType(event.eventType));
  if (fixtureHasTryEvents) {
    return {
      triesFor: firstTryCount(input.events, input.teamIds) ?? 0,
      triesAgainst: firstTryCount(input.events, input.opponentIds) ?? 0,
    };
  }
  return {
    triesFor: input.statTries ?? null,
    triesAgainst: input.opponentStatTries ?? null,
  };
}
