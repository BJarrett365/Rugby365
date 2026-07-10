export type FirstScoreEventType = "try" | "penalty_try" | "penalty" | "drop_goal";

export type FirstScoreTypeFilter = "any" | "try" | "penalty" | "drop_goal";

export type MatchEventForFirstScore = {
  id?: string;
  eventType: string;
  minute: number;
  second?: number;
  sequenceNo?: number;
  teamId: string | null;
};

export type FirstScoreResolution = {
  teamId: string | null;
  eventType: FirstScoreEventType | null;
  minute: number | null;
  verified: boolean;
};

export const OPENING_SCORE_EVENT_TYPES = new Set([
  "try",
  "penalty_try",
  "penalty",
  "drop_goal",
]);

export function normalizeFirstScoreEventType(eventType: string): FirstScoreEventType | null {
  const normalized = eventType.trim().toLowerCase();
  if (normalized === "try") return "try";
  if (normalized === "penalty_try") return "penalty_try";
  if (normalized === "penalty") return "penalty";
  if (normalized === "drop_goal") return "drop_goal";
  return null;
}

export function parseFirstScoreTypeFilter(
  value: string | null | undefined,
): FirstScoreTypeFilter {
  const normalized = (value ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "try") return "try";
  if (normalized === "penalty") return "penalty";
  if (normalized === "drop_goal" || normalized === "dropgoal") return "drop_goal";
  return "any";
}

export function firstScoreTypeFilterLabel(filter: FirstScoreTypeFilter): string {
  if (filter === "try") return "Try";
  if (filter === "penalty") return "Penalty";
  if (filter === "drop_goal") return "Drop goal";
  return "Any score";
}

export function matchesFirstScoreTypeFilter(
  eventType: FirstScoreEventType | null | undefined,
  filter: FirstScoreTypeFilter,
): boolean {
  if (filter === "any") return true;
  if (!eventType) return false;
  if (filter === "try") return eventType === "try" || eventType === "penalty_try";
  if (filter === "penalty") return eventType === "penalty";
  return eventType === "drop_goal";
}

function compareOpeningScoreEvents(a: MatchEventForFirstScore, b: MatchEventForFirstScore): number {
  if (a.minute !== b.minute) return a.minute - b.minute;
  const aSecond = a.second ?? 0;
  const bSecond = b.second ?? 0;
  if (aSecond !== bSecond) return aSecond - bSecond;
  const aSeq = a.sequenceNo ?? 0;
  const bSeq = b.sequenceNo ?? 0;
  if (aSeq !== bSeq) return aSeq - bSeq;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

export function resolveFirstScoringEvent(events: MatchEventForFirstScore[]): FirstScoreResolution {
  const candidates = events
    .filter((event) => OPENING_SCORE_EVENT_TYPES.has(event.eventType))
    .sort(compareOpeningScoreEvents);

  if (candidates.length === 0) {
    return { teamId: null, eventType: null, minute: null, verified: true };
  }

  const first = candidates[0]!;
  const teamsAtFirstMinute = new Set(
    candidates
      .filter((event) => event.minute === first.minute)
      .map((event) => event.teamId)
      .filter((teamId): teamId is string => Boolean(teamId)),
  );

  if (teamsAtFirstMinute.size !== 1) {
    return { teamId: null, eventType: null, minute: null, verified: false };
  }

  const atSameInstant = candidates.filter(
    (event) =>
      event.minute === first.minute &&
      (event.second ?? 0) === (first.second ?? 0) &&
      (event.sequenceNo ?? 0) === (first.sequenceNo ?? 0),
  );
  const teamsAtInstant = new Set(
    atSameInstant.map((event) => event.teamId).filter((teamId): teamId is string => Boolean(teamId)),
  );

  if (teamsAtInstant.size !== 1) {
    return { teamId: null, eventType: null, minute: null, verified: false };
  }

  const eventType = normalizeFirstScoreEventType(first.eventType);
  if (!first.teamId || !eventType) {
    return { teamId: null, eventType: null, minute: null, verified: false };
  }

  return {
    teamId: first.teamId,
    eventType,
    minute: first.minute,
    verified: true,
  };
}
