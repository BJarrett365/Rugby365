export type MatchPhase =
  | "kick_off"
  | "first_half"
  | "half_time"
  | "second_half"
  | "full_time"
  | "extra_time"
  | "match_event";

export type MatchAction =
  | "try"
  | "conversion"
  | "conversion_missed"
  | "penalty_goal"
  | "drop_goal"
  | "penalty_awarded"
  | "yellow_card"
  | "red_card"
  | "substitution";

export const MATCH_PHASE_OPTIONS: { value: MatchPhase; label: string; defaultMinute?: number }[] = [
  { value: "kick_off", label: "Kick off", defaultMinute: 0 },
  { value: "first_half", label: "First half" },
  { value: "half_time", label: "Half time", defaultMinute: 40 },
  { value: "second_half", label: "Second half", defaultMinute: 40 },
  { value: "full_time", label: "Full time", defaultMinute: 80 },
  { value: "extra_time", label: "Extra time", defaultMinute: 80 },
  { value: "match_event", label: "Match event (try, kick, card…)" },
];

export const MATCH_ACTION_OPTIONS: { value: MatchAction; label: string; needsPlayer: boolean }[] = [
  { value: "try", label: "Try", needsPlayer: true },
  { value: "conversion", label: "Conversion", needsPlayer: true },
  { value: "conversion_missed", label: "Conversion missed", needsPlayer: false },
  { value: "penalty_goal", label: "Penalty goal", needsPlayer: true },
  { value: "drop_goal", label: "Drop goal", needsPlayer: true },
  { value: "penalty_awarded", label: "Penalty awarded", needsPlayer: false },
  { value: "yellow_card", label: "Yellow card", needsPlayer: true },
  { value: "red_card", label: "Red card", needsPlayer: true },
  { value: "substitution", label: "Substitution", needsPlayer: true },
];

export type CommentaryEntryInput = {
  minute: number;
  phase: MatchPhase;
  action?: MatchAction;
  teamSide?: "home" | "away";
  homeName: string;
  awayName: string;
  homeScore?: number;
  awayScore?: number;
  venueName?: string;
  playerName?: string;
  playerRole?: string;
  opponentName?: string;
};

export function formatPlayerRole(positionName?: string, clubName?: string): string {
  const parts = [positionName, clubName].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

export function buildCommentaryBody(input: CommentaryEntryInput): {
  body: string;
  outputType: string;
  eventType: string;
} {
  const team =
    input.teamSide === "home" ? input.homeName : input.teamSide === "away" ? input.awayName : "";
  const opponent =
    input.teamSide === "home" ? input.awayName : input.teamSide === "away" ? input.homeName : "";
  const player = input.playerName?.trim() ?? "";
  const role = input.playerRole ?? "";
  const minute = Math.max(0, Math.min(120, input.minute));
  const venueSuffix = input.venueName ? ` at ${input.venueName}` : "";
  const scoreLine = `${input.homeName} ${input.homeScore ?? 0}–${input.awayScore ?? 0} ${input.awayName}`;

  if (input.phase !== "match_event") {
    switch (input.phase) {
      case "kick_off":
        return {
          body: `KICK OFF! ${input.homeName} vs ${input.awayName}${venueSuffix} gets underway.`,
          outputType: "phase_play_update",
          eventType: "kick_off",
        };
      case "first_half":
        return {
          body:
            minute > 0
              ? `${minute}' First half — ${scoreLine}.`
              : `First half underway — ${scoreLine}.`,
          outputType: "phase_play_update",
          eventType: "phase_milestone",
        };
      case "half_time":
        return {
          body: `HALF TIME — ${scoreLine}.`,
          outputType: "score_update",
          eventType: "half_time",
        };
      case "second_half":
        return {
          body:
            minute > 0
              ? `${minute}' Second half — ${opponent || input.awayName} get us back underway. ${scoreLine}.`
              : `SECOND HALF — ${scoreLine}.`,
          outputType: "phase_play_update",
          eventType: "phase_milestone",
        };
      case "full_time":
        return {
          body: `FULL TIME — ${scoreLine}.`,
          outputType: "score_update",
          eventType: "full_time",
        };
      case "extra_time":
        return {
          body: `EXTRA TIME — ${scoreLine}.`,
          outputType: "phase_play_update",
          eventType: "extra_time",
        };
      default:
        break;
    }
  }

  const action = input.action ?? "try";
  switch (action) {
    case "try":
      return {
        body: player
          ? `${minute}' TRY! ${player}${role} scores for ${team}!`
          : `${minute}' TRY! ${team} score!`,
        outputType: "major_event",
        eventType: "try",
      };
    case "conversion":
      return {
        body: player
          ? `${minute}' Conversion — ${player}${role}.`
          : `${minute}' Conversion successful — ${team}.`,
        outputType: "major_event",
        eventType: "conversion",
      };
    case "conversion_missed":
      return {
        body: `${minute}' ${team} miss the conversion.`,
        outputType: "major_event",
        eventType: "conversion_missed",
      };
    case "penalty_goal":
      return {
        body: player
          ? `${minute}' Penalty goal — ${player}${role} slots it for ${team}.`
          : `${minute}' Penalty goal — ${team}.`,
        outputType: "major_event",
        eventType: "penalty_goal",
      };
    case "drop_goal":
      return {
        body: player
          ? `${minute}' Drop goal! ${player}${role} extends the lead for ${team}.`
          : `${minute}' Drop goal — ${team}.`,
        outputType: "major_event",
        eventType: "drop_goal",
      };
    case "penalty_awarded":
      return {
        body: `${minute}' Penalty to ${team}.`,
        outputType: "referee_decision",
        eventType: "penalty",
      };
    case "yellow_card":
      return {
        body: player
          ? `${minute}' Yellow card for ${player}${role} (${team}).`
          : `${minute}' Yellow card — ${team}.`,
        outputType: "referee_decision",
        eventType: "card_yellow",
      };
    case "red_card":
      return {
        body: player
          ? `${minute}' Red card for ${player}${role} (${team}).`
          : `${minute}' Red card — ${team}.`,
        outputType: "referee_decision",
        eventType: "card_red",
      };
    case "substitution":
      return {
        body: player
          ? `${minute}' Substitution for ${team} — ${player}${role} comes on.`
          : `${minute}' Substitution for ${team}.`,
        outputType: "phase_play_update",
        eventType: "substitution",
      };
    default:
      return {
        body: `${minute}' ${team}.`,
        outputType: "phase_play_update",
        eventType: "phase_milestone",
      };
  }
}
