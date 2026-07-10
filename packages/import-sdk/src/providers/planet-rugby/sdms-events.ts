export type SdmsKeyEvent = {
  type: string;
  minute: number;
  second?: number;
  period?: string;
  team_id?: string;
  player_id?: string;
  player_name?: string;
  home_score?: number | null;
  away_score?: number | null;
};

export function sdmsEventTypeToMatchEvent(type: string): string | null {
  const t = type.trim().toLowerCase();
  if (t === "try") return "try";
  if (t === "conversion") return "conversion";
  if (t === "penalty") return "penalty";
  if (t === "drop goal" || t === "drop-goal") return "drop_goal";
  if (t.includes("yellow")) return "yellow_card";
  if (t.includes("red")) return "red_card";
  if (t.includes("sub on") || t.includes("sub off") || t === "substitution") return "substitution";
  if (t.includes("half start") || t.includes("half end")) return "period";
  return null;
}

export function sdmsKeyEventPayload(event: SdmsKeyEvent, matchId: string, index: number) {
  return {
    sdms_event_id: `${matchId}:${index}`,
    type: event.type,
    period: event.period,
    player: event.player_name?.trim() || undefined,
    player_provider_id: event.player_id || undefined,
    team_provider_id: event.team_id || undefined,
    home_score: event.home_score,
    away_score: event.away_score,
  };
}
