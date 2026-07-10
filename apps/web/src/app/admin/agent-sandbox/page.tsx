"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

const TEST_URL =
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";

type Run = {
  id: string;
  matchExternalId: string;
  homeTeam: string;
  awayTeam: string;
  mode: string;
  status: string;
  pollCount: number;
  flags: string[];
  startedAt: string;
};

type SandboxEvent = {
  id: string;
  sequenceNo: number;
  approvalStatus: string;
  eventOutput: {
    match_id: string;
    minute: number;
    event_type: string;
    team: string;
    opponent: string;
    confidence: number;
    requires_approval: boolean;
    facts: Record<string, unknown>;
    commentary_suggestions: string[];
    flags?: string[];
  };
};

export default function AgentSandboxPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<SandboxEvent[]>([]);
  const [mode, setMode] = useState<"observer" | "assisted" | "auto">("assisted");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/admin/agent-sandbox/runs");
    const data = (await res.json()) as { runs: Run[] };
    setRuns(data.runs ?? []);
    if (!selectedRunId && data.runs?.[0]) setSelectedRunId(data.runs[0].id);
  }, [selectedRunId]);

  const loadEvents = useCallback(async (runId: string) => {
    const res = await fetch(`/api/admin/agent-sandbox/events?runId=${runId}`);
    const data = (await res.json()) as { events: SandboxEvent[] };
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    loadRuns().catch(() => undefined);
  }, [loadRuns]);

  useEffect(() => {
    if (selectedRunId) loadEvents(selectedRunId).catch(() => undefined);
  }, [selectedRunId, loadEvents]);

  async function startRun() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/agent-sandbox/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: TEST_URL, mode }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Run started — ${data.eventsDetected} events detected on first poll`);
      setSelectedRunId(data.run.id);
      await loadRuns();
      await loadEvents(data.run.id);
    } else {
      setMessage(data.error ?? "Start failed");
    }
    setLoading(false);
  }

  async function pollRun() {
    if (!selectedRunId) return;
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/admin/agent-sandbox/runs/${selectedRunId}/poll`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Poll complete — ${data.eventsDetected} new events`);
      await loadRuns();
      await loadEvents(selectedRunId);
    } else {
      setMessage(data.error ?? "Poll failed");
    }
    setLoading(false);
  }

  async function approve(eventId: string, status: "approved" | "rejected") {
    setLoading(true);
    await fetch("/api/admin/agent-sandbox/events/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status }),
    });
    if (selectedRunId) await loadEvents(selectedRunId);
    setLoading(false);
  }

  async function exportReport() {
    if (!selectedRunId) return;
    const res = await fetch(`/api/admin/agent-sandbox/runs/${selectedRunId}/report`);
    const report = await res.json();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-sandbox-${selectedRunId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pending = events.filter((e) => e.approvalStatus === "pending");
  const queue = events
    .filter((e) => e.approvalStatus === "pending" || e.approvalStatus === "logged_only")
    .slice(-12)
    .reverse();

  return (
    <>
      <PageHeader
        eyebrow="Agent sandbox"
        title="Rugby Match Operator Agent"
        description="South Africa vs Barbarians — Sport365 test match (no production publish)"
        actions={
          <div className="page-header__actions">
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              Mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                className="cms-select"
              >
                <option value="observer">Observer</option>
                <option value="assisted">Assisted</option>
                <option value="auto">Auto</option>
              </select>
            </label>
            <button type="button" disabled={loading} onClick={startRun} className="cms-btn cms-btn--primary">
              Start run
            </button>
            <button
              type="button"
              disabled={loading || !selectedRunId}
              onClick={pollRun}
              className="cms-btn cms-btn--secondary"
            >
              Poll
            </button>
            <button
              type="button"
              disabled={!selectedRunId}
              onClick={exportReport}
              className="cms-btn cms-btn--secondary no-print"
            >
              Export
            </button>
          </div>
        }
      />

      {message && <p className="text-emerald-400 text-sm mb-4">{message}</p>}

      <section className="cms-split">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 m-0">Runs</h2>
          {runs.length === 0 ? (
            <p className="text-zinc-600 text-sm">No runs yet</p>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`cms-card touch-target w-full text-left ${
                  selectedRunId === run.id ? "border-violet-500" : ""
                }`}
              >
                <p className="font-medium m-0 text-sm">
                  {run.homeTeam} vs {run.awayTeam}
                </p>
                <p className="text-zinc-500 text-xs m-0 mt-1">
                  {run.mode} · {run.pollCount} polls
                </p>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 m-0">
            Approval queue ({pending.length} pending)
          </h2>
          {queue.length === 0 ? (
            <p className="text-zinc-600 text-sm">Start a run to detect events from Sport365.</p>
          ) : (
            queue.map((e) => {
              const out = e.eventOutput;
              return (
                <article key={e.id} className="cms-card space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-violet-400">{out.event_type}</span>
                    <span className="text-zinc-500">{out.minute}&apos;</span>
                    <span className="text-zinc-500">conf {out.confidence}</span>
                    {out.requires_approval && <span className="text-amber-400">needs approval</span>}
                    <span className="text-zinc-600">{e.approvalStatus}</span>
                  </div>
                  <p className="text-sm text-zinc-300 m-0">
                    {out.team} vs {out.opponent}
                  </p>
                  <div className="grid gap-2">
                    {out.commentary_suggestions.map((line, i) => (
                      <p key={i} className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3 m-0">
                        {line}
                      </p>
                    ))}
                  </div>
                  {e.approvalStatus === "pending" && (
                    <div className="flex flex-wrap gap-2 no-print">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => approve(e.id, "approved")}
                        className="cms-btn cms-btn--primary"
                        style={{ background: "#047857" }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => approve(e.id, "rejected")}
                        className="cms-btn cms-btn--secondary"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
