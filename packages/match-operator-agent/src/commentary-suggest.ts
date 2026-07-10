import type { CommentaryFact } from "@rugby365/shared";
import { runCommentaryPipeline } from "@rugby365/commentary";
import type { AgentEventOutput, DetectedChange } from "./types";
import {
  changeMinute,
  changeTeam,
  changeToCanonicalEventType,
  incidentFacts,
} from "./diff";
import { requiresApproval, scoreConfidence } from "./confidence";

const DEFAULT_TEMPLATES = [
  { templateKey: "try_scored", body: "{minute}' TRY! {team} — {phase_count} phases pays off.", outputType: "major_event" },
  { templateKey: "score_update", body: "{home_team} {home_score}–{away_score} {away_team}.", outputType: "score_update" },
  { templateKey: "penalty_awarded", body: "{minute}' Penalty to {team} — {infringement}.", outputType: "referee_decision" },
];

const DEFAULT_RULES = [
  { id: "1", name: "Try", conditions: { event_type: "try" }, templateKeys: ["try_scored", "score_update"], maxSuggestions: 2, outputType: "major_event" },
  { id: "2", name: "Penalty", conditions: { event_type: "penalty" }, templateKeys: ["penalty_awarded"], maxSuggestions: 1, outputType: "referee_decision" },
  { id: "3", name: "Score", conditions: { event_type: "score_update" }, templateKeys: ["score_update"], maxSuggestions: 1, outputType: "score_update" },
];

function formatScoreBefore(snapshot: { homeScore: number; awayScore: number }): string {
  return `${snapshot.homeScore}-${snapshot.awayScore}`;
}

function fallbackCommentary(
  minute: number,
  eventType: string,
  team: string,
  opponent: string,
  facts: Record<string, unknown>,
): string[] {
  const lines: string[] = [];
  const player = typeof facts.player === "string" && facts.player !== "unknown" ? facts.player : null;

  switch (eventType) {
    case "try":
      lines.push(player ? `${minute}' TRY! ${player} for ${team}.` : `${minute}' TRY to ${team}.`);
      lines.push(`${minute}' ${team} cross the line — score updated.`);
      break;
    case "conversion":
      lines.push(player ? `${minute}' Conversion by ${player}.` : `${minute}' Conversion for ${team}.`);
      break;
    case "conversion_missed":
      lines.push(`${minute}' ${team} miss the conversion.`);
      break;
    case "card":
      lines.push(player ? `${minute}' Card shown to ${player} (${team}).` : `${minute}' Card for ${team}.`);
      break;
    case "substitution":
      lines.push(player ? `${minute}' Substitution for ${team}: ${player} on.` : `${minute}' Substitution for ${team}.`);
      break;
    case "penalty":
      lines.push(`${minute}' Penalty to ${team}.`);
      lines.push(`${minute}' ${team} win a penalty in ${opponent} territory.`);
      lines.push(`${minute}' The referee gives ${team} the decision.`);
      break;
    case "half_time":
      lines.push(`Half-time: ${facts.score_after ?? "score update pending"}.`);
      break;
    case "full_time":
      lines.push(`Full-time: ${facts.score_after ?? "match ended"}.`);
      break;
    case "score_update":
      lines.push(`${minute}' Score update: ${facts.score_after ?? "unknown"}.`);
      break;
    default:
      lines.push(`${minute}' ${eventType.replace(/_/g, " ")} — ${team}.`);
  }
  return lines.slice(0, 3);
}

export function buildAgentEventOutput(
  change: DetectedChange,
  mode: "observer" | "assisted" | "auto",
): AgentEventOutput {
  const eventType = changeToCanonicalEventType(change);
  const minute = changeMinute(change);
  const { team, opponent } = changeTeam(change);
  const confidence = scoreConfidence(change);
  const needsApproval = requiresApproval(eventType, confidence, mode);
  const flags: string[] = [];

  const facts: Record<string, unknown> = {
    score_after: formatScoreBefore(change.snapshot),
    source_url: change.snapshot.sourceUrl,
  };

  if (change.kind === "incident") {
    Object.assign(facts, incidentFacts(change.incident, change.snapshot));
    const prev = change.snapshot;
    if (change.incident.scoreAfter) {
      const [h, a] = change.incident.scoreAfter;
      const pts = change.incident.type === 34 ? 5 : change.incident.type === 35 ? 2 : 0;
      if (pts > 0) {
        const teamScored = change.incident.teamPos === 0;
        facts.score_before = teamScored
          ? `${h - pts}-${a}`
          : `${h}-${a - pts}`;
      }
    }
    if (!change.incident.playerName) flags.push("missing_player_attribution");
  }

  if (change.kind === "score_update" && change.previous) {
    facts.score_before = formatScoreBefore(change.previous);
    flags.push("score_change_without_new_incident");
  }

  if (change.kind === "status_change") {
    facts.status_label = change.snapshot.statusLabel;
    facts.status_text = change.snapshot.statusText ?? "unknown";
  }

  if (eventType === "penalty" && !facts.infringement) {
    facts.infringement = "unknown";
    facts.pitch_zone = "unknown";
  }

  const ctx = {
    homeTeam: change.snapshot.homeTeam,
    awayTeam: change.snapshot.awayTeam,
    homeScore: change.snapshot.homeScore,
    awayScore: change.snapshot.awayScore,
    phaseCount: 0,
  };

  const pipeline = runCommentaryPipeline(
    {
      eventType,
      minute,
      payload: facts,
      teamName: team,
      opponentName: opponent,
    },
    ctx,
    DEFAULT_RULES,
    DEFAULT_TEMPLATES,
  );

  const commentary_suggestions =
    pipeline?.renderedOptions.length
      ? pipeline.renderedOptions
      : fallbackCommentary(minute, eventType, team, opponent, facts);

  if (confidence < 0.75) flags.push("low_confidence");

  return {
    match_id: change.snapshot.matchId,
    minute,
    event_type: eventType,
    team,
    opponent,
    source: "sport365",
    confidence,
    requires_approval: needsApproval,
    facts,
    commentary_suggestions,
    flags: flags.length ? flags : undefined,
    provider_event_id: change.kind === "incident" ? change.incident.id : undefined,
  };
}
