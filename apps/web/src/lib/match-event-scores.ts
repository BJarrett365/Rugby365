export type MatchEventForScore = {
  id: string;
  eventType: string;
  teamId?: string | null;
  payload?: Record<string, unknown> | null;
};

const SCORING_POINTS: Record<string, number> = {
  try: 5,
  conversion: 2,
  penalty: 3,
  penalty_goal: 3,
  drop_goal: 3,
};

function readScorePair(payload: Record<string, unknown>): [number, number] | null {
  const scoreAfter = payload.score_after;
  if (Array.isArray(scoreAfter) && scoreAfter.length >= 2) {
    const home = Number(scoreAfter[0]);
    const away = Number(scoreAfter[1]);
    if (Number.isFinite(home) && Number.isFinite(away)) return [home, away];
  }

  const homeScore = payload.home_score;
  const awayScore = payload.away_score;
  if (typeof homeScore === "number" && typeof awayScore === "number") {
    return [homeScore, awayScore];
  }

  return null;
}

export function buildRunningScoresForEvents(
  events: MatchEventForScore[],
  homeTeamId?: string | null,
  awayTeamId?: string | null,
): Map<string, [number, number]> {
  const scores = new Map<string, [number, number]>();
  let home = 0;
  let away = 0;
  let hasScore = false;

  for (const event of events) {
    const payload = event.payload ?? {};
    const explicit = readScorePair(payload);

    if (explicit) {
      home = explicit[0];
      away = explicit[1];
      hasScore = true;
    } else {
      const points = SCORING_POINTS[event.eventType];
      if (points && event.teamId && homeTeamId && awayTeamId) {
        if (event.teamId === homeTeamId) home += points;
        else if (event.teamId === awayTeamId) away += points;
        hasScore = true;
      }
    }

    if (hasScore) scores.set(event.id, [home, away]);
  }

  return scores;
}
