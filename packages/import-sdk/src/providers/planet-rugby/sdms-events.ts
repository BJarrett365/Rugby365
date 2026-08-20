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
  if (t.includes("missed conversion") || t === "conversion_missed") return "conversion_missed";
  if (t === "conversion") return "conversion";
  if (t.includes("missed penalty") || t === "penalty_missed" || t === "penalty_goal_missed") {
    return "penalty_missed";
  }
  // Store as penalty_goal so fixture_players / career points count kicks.
  if (t === "penalty" || t === "penalty goal" || t === "penalty_goal") return "penalty_goal";
  if (t.includes("missed drop")) return "drop_goal_missed";
  if (t === "drop goal" || t === "drop-goal" || t === "drop_goal") return "drop_goal";
  if (t.includes("yellow")) return "yellow_card";
  if (t.includes("red")) return "red_card";
  if (t.includes("sub on") || t.includes("sub off") || t === "substitution") return "substitution";
  if (t.includes("half start") || t.includes("half end")) return "period";
  return null;
}

/**
 * Stable SDMS event identity. Index-based ids (`matchId:0`) break when the
 * key_events array grows/reorders mid-match or on re-fetch, which drops
 * conversions and misattributes scorers.
 */
export function buildSdmsEventId(event: SdmsKeyEvent, matchId: string, index: number): string {
  const type = (event.type ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const minute = Number.isFinite(event.minute) ? event.minute : 0;
  const second = Number.isFinite(event.second) ? Number(event.second) : 0;
  const player = (event.player_id ?? "").trim() || "no-player";
  const team = (event.team_id ?? "").trim() || "no-team";
  return `${matchId}:${type}:${minute}:${second}:${player}:${team}:${index}`;
}

export function sdmsKeyEventPayload(event: SdmsKeyEvent, matchId: string, index: number) {
  return {
    sdms_event_id: buildSdmsEventId(event, matchId, index),
    type: event.type,
    period: event.period,
    player: event.player_name?.trim() || undefined,
    player_provider_id: event.player_id || undefined,
    team_provider_id: event.team_id || undefined,
    home_score: event.home_score,
    away_score: event.away_score,
  };
}
