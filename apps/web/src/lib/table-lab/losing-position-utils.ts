import { scoringPointsFromMatchEvent } from "./first-half-table-service";
import {
  resolveScoreAtSixty,
  type MatchEventLike,
} from "./final-twenty-minutes-table-service";
import { resolveFirstHalfScores } from "./first-half-table-service";

const SCORING_EVENT_TYPES = new Set([
  "try",
  "penalty_try",
  "conversion",
  "penalty",
  "penalty_goal",
  "drop_goal",
]);

const DEFAULT_EVENT_POINTS: Record<string, number> = {
  try: 5,
  penalty_try: 5,
  conversion: 2,
  penalty: 3,
  penalty_goal: 3,
  drop_goal: 3,
};

export type LosingPositionTimelineEvent = {
  eventType: string;
  teamId: string | null;
  minute: number;
  second?: number | null;
  sequenceNo?: number | null;
  payload?: Record<string, unknown> | null;
};

export type FixtureLosingPositionState = {
  homeEverTrailing: boolean;
  awayEverTrailing: boolean;
  homeBehindAtHalfTime: boolean | null;
  awayBehindAtHalfTime: boolean | null;
  homeBehindAfterSixty: boolean | null;
  awayBehindAfterSixty: boolean | null;
  homeMinuteFirstBehind: number | null;
  awayMinuteFirstBehind: number | null;
  homeMaxDeficit: number;
  awayMaxDeficit: number;
  homeEverLeading: boolean;
  awayEverLeading: boolean;
  homeAheadAtHalfTime: boolean | null;
  awayAheadAtHalfTime: boolean | null;
  homeAheadAfterSixty: boolean | null;
  awayAheadAfterSixty: boolean | null;
  homeMinuteFirstAhead: number | null;
  awayMinuteFirstAhead: number | null;
  homeMaxLead: number;
  awayMaxLead: number;
  homeLatestLeadLostMinute: number | null;
  awayLatestLeadLostMinute: number | null;
  homeLeadLostMinutes: number[];
  awayLeadLostMinutes: number[];
  homeMinuteLastTookLead: number | null;
  awayMinuteLastTookLead: number | null;
  scoreTimelineVerified: boolean;
  halfTimeScoreVerified: boolean;
  sixtyMinuteScoreVerified: boolean;
};

function readScorePair(payload: Record<string, unknown>): [number, number] | null {
  const scoreAfter = payload.score_after;
  if (Array.isArray(scoreAfter) && scoreAfter.length >= 2) {
    const home = Number(scoreAfter[0]);
    const away = Number(scoreAfter[1]);
    if (Number.isFinite(home) && Number.isFinite(away)) return [home, away];
  }

  const homeScore = payload.home_score ?? payload.homeScore;
  const awayScore = payload.away_score ?? payload.awayScore;
  if (homeScore != null && awayScore != null) {
    const home = Number(homeScore);
    const away = Number(awayScore);
    if (Number.isFinite(home) && Number.isFinite(away)) return [home, away];
  }

  return null;
}

function sortTimelineEvents(events: LosingPositionTimelineEvent[]): LosingPositionTimelineEvent[] {
  return [...events].sort(
    (a, b) =>
      a.minute - b.minute ||
      (a.second ?? 0) - (b.second ?? 0) ||
      (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0),
  );
}

function pointsForEvent(event: LosingPositionTimelineEvent): number {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const fromPayload = scoringPointsFromMatchEvent(payload);
  if (fromPayload > 0) return fromPayload;
  return DEFAULT_EVENT_POINTS[event.eventType] ?? 0;
}

function applyScoreUpdate(
  event: LosingPositionTimelineEvent,
  homeTeamId: string,
  awayTeamId: string,
  home: number,
  away: number,
): [number, number] | null {
  const explicit = readScorePair((event.payload ?? {}) as Record<string, unknown>);
  if (explicit) return explicit;

  if (!SCORING_EVENT_TYPES.has(event.eventType) || !event.teamId) return null;
  const points = pointsForEvent(event);
  if (points <= 0) return null;
  if (event.teamId === homeTeamId) return [home + points, away];
  if (event.teamId === awayTeamId) return [home, away + points];
  return null;
}

export function resolveFixtureLosingPositionState(input: {
  events: LosingPositionTimelineEvent[];
  homeTeamId: string;
  awayTeamId: string;
}): FixtureLosingPositionState {
  let home = 0;
  let away = 0;
  let homeEverTrailing = false;
  let awayEverTrailing = false;
  let homeMinuteFirstBehind: number | null = null;
  let awayMinuteFirstBehind: number | null = null;
  let homeMaxDeficit = 0;
  let awayMaxDeficit = 0;
  let homeEverLeading = false;
  let awayEverLeading = false;
  let homeMinuteFirstAhead: number | null = null;
  let awayMinuteFirstAhead: number | null = null;
  let homeMaxLead = 0;
  let awayMaxLead = 0;
  let homeLatestLeadLostMinute: number | null = null;
  let awayLatestLeadLostMinute: number | null = null;
  const homeLeadLostMinutes: number[] = [];
  const awayLeadLostMinutes: number[] = [];
  let homeMinuteLastTookLead: number | null = null;
  let awayMinuteLastTookLead: number | null = null;
  let scoreTimelineVerified = false;

  for (const event of sortTimelineEvents(input.events)) {
    const homeBefore = home;
    const awayBefore = away;
    const wasHomeLeading = homeBefore > awayBefore;
    const wasAwayLeading = awayBefore > homeBefore;

    const updated = applyScoreUpdate(event, input.homeTeamId, input.awayTeamId, home, away);
    if (!updated) continue;

    [home, away] = updated;
    scoreTimelineVerified = true;

    if (home < away) {
      homeEverTrailing = true;
      if (homeMinuteFirstBehind == null) homeMinuteFirstBehind = event.minute;
      homeMaxDeficit = Math.max(homeMaxDeficit, away - home);
    }
    if (away < home) {
      awayEverTrailing = true;
      if (awayMinuteFirstBehind == null) awayMinuteFirstBehind = event.minute;
      awayMaxDeficit = Math.max(awayMaxDeficit, home - away);
    }
    if (home > away) {
      homeEverLeading = true;
      if (homeMinuteFirstAhead == null) homeMinuteFirstAhead = event.minute;
      homeMaxLead = Math.max(homeMaxLead, home - away);
      if (homeBefore <= awayBefore) {
        homeMinuteLastTookLead = event.minute;
      }
    }
    if (away > home) {
      awayEverLeading = true;
      if (awayMinuteFirstAhead == null) awayMinuteFirstAhead = event.minute;
      awayMaxLead = Math.max(awayMaxLead, away - home);
      if (awayBefore <= homeBefore) {
        awayMinuteLastTookLead = event.minute;
      }
    }
    if (wasHomeLeading && home <= away) {
      homeLeadLostMinutes.push(event.minute);
      homeLatestLeadLostMinute = event.minute;
    }
    if (wasAwayLeading && away <= home) {
      awayLeadLostMinutes.push(event.minute);
      awayLatestLeadLostMinute = event.minute;
    }
  }

  const firstHalf = resolveFirstHalfScores({
    events: input.events as MatchEventLike[],
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
  });
  const halfTimeScoreVerified = firstHalf.source != null;
  const homeBehindAtHalfTime =
    firstHalf.homeScore != null && firstHalf.awayScore != null
      ? firstHalf.homeScore < firstHalf.awayScore
      : null;
  const awayBehindAtHalfTime =
    firstHalf.homeScore != null && firstHalf.awayScore != null
      ? firstHalf.awayScore < firstHalf.homeScore
      : null;

  const homeAheadAtHalfTime =
    firstHalf.homeScore != null && firstHalf.awayScore != null
      ? firstHalf.homeScore > firstHalf.awayScore
      : null;
  const awayAheadAtHalfTime =
    firstHalf.homeScore != null && firstHalf.awayScore != null
      ? firstHalf.awayScore > firstHalf.homeScore
      : null;

  const scoreAtSixty = resolveScoreAtSixty({
    events: input.events as MatchEventLike[],
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
  });
  const sixtyMinuteScoreVerified = scoreAtSixty != null;
  const homeBehindAfterSixty = scoreAtSixty
    ? scoreAtSixty.homeScore < scoreAtSixty.awayScore
    : null;
  const awayBehindAfterSixty = scoreAtSixty
    ? scoreAtSixty.awayScore < scoreAtSixty.homeScore
    : null;

  const homeAheadAfterSixty = scoreAtSixty
    ? scoreAtSixty.homeScore > scoreAtSixty.awayScore
    : null;
  const awayAheadAfterSixty = scoreAtSixty
    ? scoreAtSixty.awayScore > scoreAtSixty.homeScore
    : null;

  if (!scoreTimelineVerified) {
    return {
      homeEverTrailing: false,
      awayEverTrailing: false,
      homeBehindAtHalfTime,
      awayBehindAtHalfTime,
      homeBehindAfterSixty,
      awayBehindAfterSixty,
      homeMinuteFirstBehind: null,
      awayMinuteFirstBehind: null,
      homeMaxDeficit: 0,
      awayMaxDeficit: 0,
      homeEverLeading: false,
      awayEverLeading: false,
      homeAheadAtHalfTime,
      awayAheadAtHalfTime,
      homeAheadAfterSixty,
      awayAheadAfterSixty,
      homeMinuteFirstAhead: null,
      awayMinuteFirstAhead: null,
      homeMaxLead: 0,
      awayMaxLead: 0,
      homeLatestLeadLostMinute: null,
      awayLatestLeadLostMinute: null,
      homeLeadLostMinutes: [],
      awayLeadLostMinutes: [],
      homeMinuteLastTookLead: null,
      awayMinuteLastTookLead: null,
      scoreTimelineVerified: false,
      halfTimeScoreVerified,
      sixtyMinuteScoreVerified,
    };
  }

  return {
    homeEverTrailing,
    awayEverTrailing,
    homeBehindAtHalfTime,
    awayBehindAtHalfTime,
    homeBehindAfterSixty,
    awayBehindAfterSixty,
    homeMinuteFirstBehind,
    awayMinuteFirstBehind,
    homeMaxDeficit,
    awayMaxDeficit,
    homeEverLeading,
    awayEverLeading,
    homeAheadAtHalfTime,
    awayAheadAtHalfTime,
    homeAheadAfterSixty,
    awayAheadAfterSixty,
    homeMinuteFirstAhead,
    awayMinuteFirstAhead,
    homeMaxLead,
    awayMaxLead,
    homeLatestLeadLostMinute,
    awayLatestLeadLostMinute,
    homeLeadLostMinutes,
    awayLeadLostMinutes,
    homeMinuteLastTookLead,
    awayMinuteLastTookLead,
    scoreTimelineVerified: true,
    halfTimeScoreVerified,
    sixtyMinuteScoreVerified,
  };
}
