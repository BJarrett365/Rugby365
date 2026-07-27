/** Map published match events onto a unit pitch (0–100 x/y) for public replay. */

export type AnimationPitchEvent = {
  id: string;
  minute: number;
  second: number;
  label: string;
  eventType: string;
  teamSide: "home" | "away" | "neutral";
  /** Pitch X: 0 home try-line → 100 away try-line */
  x: number;
  /** Pitch Y: 0 left touch → 100 right touch */
  y: number;
  scoreHome?: number | null;
  scoreAway?: number | null;
  playerId?: string | null;
  playerName?: string | null;
  playerOff?: string | null;
  playerOn?: string | null;
  playerOffJersey?: number | null;
  playerOnJersey?: number | null;
  assistPlayerName?: string | null;
  jerseyNumber?: number | null;
  imageUrl?: string | null;
};

function normalizeType(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Heuristic ball spot from event type + side (no unpublished CMS coords). */
export function pitchPositionForEvent(input: {
  eventType: string;
  teamSide: "home" | "away" | "neutral";
  index: number;
}): { x: number; y: number } {
  const t = normalizeType(input.eventType);
  const yBase = 35 + (input.index % 5) * 8;
  const y = Math.min(85, Math.max(15, yBase));

  if (t.includes("lineout") || t.includes("line_out")) {
    const touchY = input.index % 2 === 0 ? 4 : 96;
    const x =
      input.teamSide === "home" ? 35 + (input.index % 4) * 8 : 65 - (input.index % 4) * 8;
    return { x: Math.min(85, Math.max(15, x)), y: touchY };
  }
  if (t.includes("scrum")) {
    return {
      x: input.teamSide === "home" ? 45 : input.teamSide === "away" ? 55 : 50,
      y: 50,
    };
  }
  if (t.includes("try") || t.includes("penalty_try")) {
    return { x: input.teamSide === "away" ? 8 : 92, y };
  }
  if (t.includes("conversion") || t.includes("penalty") || t.includes("drop")) {
    return { x: input.teamSide === "away" ? 18 : 82, y: 50 };
  }
  if (t.includes("card") || t.includes("sin_bin") || t.includes("red") || t.includes("yellow")) {
    return { x: 50, y: input.teamSide === "home" ? 25 : 75 };
  }
  if (t.includes("sub") || t.includes("replacement")) {
    return { x: input.teamSide === "home" ? 30 : 70, y: 12 };
  }
  if (t.includes("kick_off") || t.includes("kickoff") || t.includes("start")) {
    return { x: 50, y: 50 };
  }
  if (t.includes("half") || t.includes("full_time") || t.includes("ft")) {
    return { x: 50, y: 50 };
  }
  return {
    x: input.teamSide === "home" ? 40 : input.teamSide === "away" ? 60 : 50,
    y,
  };
}

export type AnimationEventInput = {
  id?: string | number | null;
  match_event_id?: string | number | null;
  time?: string | number | null;
  minute?: number | null;
  second?: number | null;
  type?: string | null;
  event_type?: string | null;
  type_string?: string | null;
  player_id?: string | null;
  player_name?: string | null;
  player_off?: string | null;
  player_on?: string | null;
  assist_player_name?: string | null;
  jersey_number?: number | null;
  image_url?: string | null;
  team_id?: string | number | null;
  home_team?: boolean | null;
  score_home?: number | null;
  score_away?: number | null;
  home_score?: number | null;
  away_score?: number | null;
};

export function mapKeyEventsToAnimation(
  events: AnimationEventInput[],
  homeTeamId: string | number | null,
): AnimationPitchEvent[] {
  const homeId = homeTeamId != null ? String(homeTeamId) : null;

  return events.map((ev, index) => {
    const rawType = String(ev.type_string || ev.event_type || ev.type || "event");
    const minute =
      typeof ev.minute === "number"
        ? ev.minute
        : Number.parseInt(String(ev.time ?? "0").replace(/[^\d]/g, ""), 10) || 0;
    const teamId = ev.team_id != null ? String(ev.team_id) : null;
    let teamSide: "home" | "away" | "neutral" = "neutral";
    if (typeof ev.home_team === "boolean") {
      teamSide = ev.home_team ? "home" : "away";
    } else if (homeId && teamId) {
      teamSide = teamId === homeId ? "home" : "away";
    }
    const pos = pitchPositionForEvent({ eventType: rawType, teamSide, index });
    const player = ev.player_name?.trim() || null;
    const playerOff = ev.player_off?.trim() || null;
    const playerOn = ev.player_on?.trim() || null;
    const assist = ev.assist_player_name?.trim() || null;
    const typeLabel = rawType.replace(/_/g, " ");
    let label = typeLabel;
    if (playerOff || playerOn) {
      label = `${typeLabel} — ${[playerOn ? `${playerOn} On` : null, playerOff ? `${playerOff} Off` : null].filter(Boolean).join(" · ")}`;
    } else if (player) {
      label = `${typeLabel} — ${player}`;
      if (assist) label += ` (assist ${assist})`;
    }

    return {
      id: String(ev.match_event_id ?? ev.id ?? `${minute}-${index}`),
      minute,
      second: typeof ev.second === "number" ? ev.second : 0,
      label,
      eventType: rawType,
      teamSide,
      x: pos.x,
      y: pos.y,
      scoreHome: ev.score_home ?? ev.home_score ?? null,
      scoreAway: ev.score_away ?? ev.away_score ?? null,
      playerId: ev.player_id?.trim() || null,
      playerName: player,
      playerOff,
      playerOn,
      assistPlayerName: assist,
      jerseyNumber: ev.jersey_number ?? null,
      imageUrl: ev.image_url ?? null,
    };
  });
}
