import { AgentEventOutputSchema } from "./types";
import type { AgentEventOutput, AgentMode, MatchSnapshot } from "./types";
import { diffMatchSnapshots } from "./diff";
import { buildAgentEventOutput } from "./commentary-suggest";
import { pollMatchSnapshot } from "./poll";

export type RunCycleResult = {
  snapshot: MatchSnapshot;
  events: AgentEventOutput[];
  flags: string[];
  pollNumber: number;
};

export type RunCycleOptions = {
  sourceUrl: string;
  mode: AgentMode;
  previousSnapshot: MatchSnapshot | null;
  pollNumber: number;
  html?: string;
};

export async function runCycle(options: RunCycleOptions): Promise<RunCycleResult> {
  const snapshot = await pollMatchSnapshot({
    sourceUrl: options.sourceUrl,
    html: options.html,
  });

  const changes = diffMatchSnapshots(options.previousSnapshot, snapshot);
  const flags: string[] = [];
  const events: AgentEventOutput[] = [];

  if (!snapshot.incidents.length && snapshot.homeScore === 0 && snapshot.awayScore === 0) {
    flags.push("missing_incident_data");
  }

  if (snapshot.statusLabel === "unknown") {
    flags.push("unclear_match_status");
  }

  for (const change of changes) {
    const output = buildAgentEventOutput(change, options.mode);
    events.push(AgentEventOutputSchema.parse(output));
  }

  return {
    snapshot,
    events,
    flags,
    pollNumber: options.pollNumber,
  };
}

export function buildMatchReport(
  snapshot: MatchSnapshot,
  events: AgentEventOutput[],
  runMeta: { mode: AgentMode; runId: string; pollCount: number },
): Record<string, unknown> {
  return {
    run_id: runMeta.runId,
    mode: runMeta.mode,
    poll_count: runMeta.pollCount,
    match_id: snapshot.matchId,
    teams: { home: snapshot.homeTeam, away: snapshot.awayTeam },
    score: { home: snapshot.homeScore, away: snapshot.awayScore },
    status: snapshot.statusLabel,
    competition: snapshot.competition,
    incident_count: snapshot.incidents.length,
    events_detected: events.length,
    events,
    generated_at: new Date().toISOString(),
  };
}
