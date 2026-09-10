/** Deduped match-event scoring for team_match_stats rollups. */

export type TeamScoringBucket = "try" | "conversion" | "penalty" | "drop_goal";

export type TeamScoringEvent = {
  eventType: string;
  minute: number;
  teamId: string | null;
  sequenceNo?: number | null;
  sourceProvider?: string | null;
  payload?: unknown;
};

export type TeamMatchScoringTotals = {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
};

function playerKey(payload: unknown): string {
  const value = (payload ?? {}) as Record<string, unknown>;
  return String(value.playerName ?? value.player ?? "")
    .trim()
    .toLowerCase();
}

export function teamScoringBucket(eventType: string | null | undefined): TeamScoringBucket | null {
  const type = (eventType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (type === "try" || type === "penalty_try") return "try";
  if (type === "conversion") return "conversion";
  if (type === "penalty") return "penalty";
  if (type === "drop_goal" || type === "dropgoal") return "drop_goal";
  return null;
}

function uniqueEventCount(events: TeamScoringEvent[]): number {
  const seen = new Set<string>();
  events.forEach((event, index) => {
    const player = playerKey(event.payload);
    const key =
      event.minute > 0
        ? `t|${event.minute}|${player}`
        : `u|${event.sequenceNo ?? index}|${player}`;
    seen.add(key);
  });
  return seen.size;
}

/**
 * Prefer timed Wikipedia rows over untimed rugby-box copies of the same scores.
 * Never sum both sources — that doubles Championship try/conversion totals.
 */
export function preferredScoringEvents(events: TeamScoringEvent[]): TeamScoringEvent[] {
  if (!events.length) return [];
  const timed = events.filter((event) => event.minute > 0);
  const wikipedia = events.filter((event) => (event.sourceProvider ?? "").toLowerCase() === "wikipedia");
  const wikipediaTimed = wikipedia.filter((event) => event.minute > 0);
  const wikipediaUntimed = wikipedia.filter((event) => event.minute <= 0);
  const rugbyBox = events.filter(
    (event) => (event.sourceProvider ?? "").toLowerCase() === "wikipedia-rugby-box",
  );
  /**
   * Timed Wikipedia rows can omit a score whose minute failed to parse (minute 0).
   * Keep those untimed Wikipedia rows when the player is not already in the timed set.
   * Never fall through to rugby-box as well — that doubles Championship totals.
   */
  if (wikipediaTimed.length) {
    const timedPlayers = new Set(wikipediaTimed.map((event) => playerKey(event.payload)));
    const extra = wikipediaUntimed.filter((event) => !timedPlayers.has(playerKey(event.payload)));
    return extra.length ? [...wikipediaTimed, ...extra] : wikipediaTimed;
  }
  if (timed.length) {
    const timedPlayers = new Set(timed.map((event) => playerKey(event.payload)));
    const extra = wikipediaUntimed.filter((event) => !timedPlayers.has(playerKey(event.payload)));
    return extra.length ? [...timed, ...extra] : timed;
  }
  if (wikipedia.length) return wikipedia;
  if (rugbyBox.length) return rugbyBox;
  return events;
}

export function countDedupedScoringForTeam(
  events: TeamScoringEvent[],
  teamId: string,
): TeamMatchScoringTotals {
  const forTeam = events.filter((event) => event.teamId === teamId);
  const totals: TeamMatchScoringTotals = {
    tries: 0,
    conversions: 0,
    penalties: 0,
    dropGoals: 0,
  };
  const buckets: TeamScoringBucket[] = ["try", "conversion", "penalty", "drop_goal"];
  for (const bucket of buckets) {
    const ofKind = forTeam.filter((event) => teamScoringBucket(event.eventType) === bucket);
    if (!ofKind.length) continue;
    const count = uniqueEventCount(preferredScoringEvents(ofKind));
    if (bucket === "try") totals.tries = count;
    else if (bucket === "conversion") totals.conversions = count;
    else if (bucket === "penalty") totals.penalties = count;
    else totals.dropGoals = count;
  }
  return totals;
}
