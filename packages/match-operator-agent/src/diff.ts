import { incidentToEventType } from "./sport365-parse";
import type { DetectedChange, MatchSnapshot, ProviderIncident } from "./types";

function scoreKey(s: MatchSnapshot): string {
  return `${s.homeScore}-${s.awayScore}`;
}

function incidentIds(snapshot: MatchSnapshot): Set<string> {
  return new Set(snapshot.incidents.map((i) => i.id));
}

export function diffMatchSnapshots(
  previous: MatchSnapshot | null,
  current: MatchSnapshot,
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  if (!previous) {
    if (current.incidents.length > 0) {
      for (const incident of current.incidents) {
        changes.push({ kind: "incident", incident, snapshot: current });
      }
    } else if (current.homeScore > 0 || current.awayScore > 0) {
      changes.push({ kind: "score_update", snapshot: current });
    }
    if (current.statusLabel !== "unknown") {
      changes.push({ kind: "status_change", snapshot: current });
    }
    return changes;
  }

  if (scoreKey(previous) !== scoreKey(current)) {
    const newIncidents = current.incidents.filter((i) => !incidentIds(previous).has(i.id));
    if (newIncidents.length > 0) {
      for (const incident of newIncidents) {
        changes.push({ kind: "incident", incident, snapshot: current });
      }
    } else {
      changes.push({ kind: "score_update", snapshot: current, previous });
    }
  } else {
    const newIncidents = current.incidents.filter((i) => !incidentIds(previous).has(i.id));
    for (const incident of newIncidents) {
      changes.push({ kind: "incident", incident, snapshot: current });
    }
  }

  if (
    previous.statusLabel !== current.statusLabel ||
    previous.statusCode !== current.statusCode ||
    previous.statusText !== current.statusText
  ) {
    changes.push({ kind: "status_change", snapshot: current, previous });
  }

  return changes;
}

export function changeToCanonicalEventType(change: DetectedChange): string {
  if (change.kind === "incident") return incidentToEventType(change.incident);
  if (change.kind === "status_change") {
    const label = change.snapshot.statusLabel;
    if (label === "half_time") return "half_time";
    if (label === "full_time") return "full_time";
    return "fixture_status_change";
  }
  return "score_update";
}

export function changeMinute(change: DetectedChange): number {
  if (change.kind === "incident") {
    const inc = change.incident;
    return inc.minutePlus ? inc.minute : inc.minute;
  }
  if (change.snapshot.elapsedSeconds) {
    return Math.min(80, Math.floor(change.snapshot.elapsedSeconds / 60));
  }
  const last = change.snapshot.incidents.at(-1);
  return last?.minute ?? 0;
}

export function changeTeam(change: DetectedChange): { team: string; opponent: string } {
  const { homeTeam, awayTeam } = change.snapshot;
  if (change.kind === "incident") {
    const team = change.incident.teamName;
    const opponent = team === homeTeam ? awayTeam : homeTeam;
    return { team, opponent };
  }
  return { team: homeTeam, opponent: awayTeam };
}

export function incidentFacts(
  incident: ProviderIncident,
  snapshot: MatchSnapshot,
): Record<string, unknown> {
  const [homeScore, awayScore] = incident.scoreAfter;
  return {
    score_after: `${homeScore}-${awayScore}`,
    player: incident.playerName ?? "unknown",
    provider_type: incident.type,
    team_pos: incident.teamPos,
    competition: snapshot.competition ?? "unknown",
  };
}
