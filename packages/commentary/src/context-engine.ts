import type { CommentaryFact } from "@rugby365/shared";

export type MatchContext = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  phaseCount: number;
  venue?: string;
  referee?: string;
};

export function buildFactsFromEvent(
  event: {
    eventType: string;
    minute: number;
    second?: number;
    payload?: Record<string, unknown>;
    teamName?: string;
    opponentName?: string;
  },
  ctx: MatchContext,
): CommentaryFact {
  const team = event.teamName ?? ctx.homeTeam;
  const opponent = event.opponentName ?? ctx.awayTeam;
  return {
    team,
    opponent,
    minute: event.minute,
    second: event.second ?? 0,
    phase_count: Number(event.payload?.phase ?? ctx.phaseCount),
    zone: typeof event.payload?.zone === "string" ? event.payload.zone : undefined,
    event_type: event.eventType,
    home_team: ctx.homeTeam,
    away_team: ctx.awayTeam,
    home_score: ctx.homeScore,
    away_score: ctx.awayScore,
    infringement: typeof event.payload?.infringement === "string" ? event.payload.infringement : undefined,
    possession_retained: event.payload?.possession_retained === true,
    player: typeof event.payload?.player === "string" ? event.payload.player : undefined,
    player_jersey:
      typeof event.payload?.player_jersey === "number" ? event.payload.player_jersey : undefined,
    player_position:
      typeof event.payload?.player_position === "string" ? event.payload.player_position : undefined,
    player_club: typeof event.payload?.player_club === "string" ? event.payload.player_club : undefined,
    player_role: typeof event.payload?.player_role === "string" ? event.payload.player_role : undefined,
    venue: ctx.venue,
    referee: ctx.referee,
  };
}
