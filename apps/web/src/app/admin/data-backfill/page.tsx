"use client";

import { useCallback, useEffect, useState } from "react";

type Layer = {
  key: string;
  label: string;
  have: number;
  of: number;
  status: string;
};

type Health = {
  entityType: string;
  entityId: string;
  label: string;
  profileHealthPct: number;
  layers: Layer[];
};

type Snapshot = {
  team: Health;
  coaches: Health[];
  queue: Record<string, { stale: number; failed: number; calculating: number; partial: number }>;
};

function Progress({ have, of }: { have: number; of: number }) {
  const pct = of > 0 ? Math.round((100 * have) / of) : 0;
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
      <div className="h-full rounded bg-emerald-500/80" style={{ width: `${pct}%` }} />
    </div>
  );
}

function HealthCard({ health }: { health: Health }) {
  return (
    <div className="rounded border border-zinc-800 px-3 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-xs uppercase text-zinc-500">{health.entityType}</div>
          <div className="font-semibold text-zinc-100">{health.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">PROFILE HEALTH</div>
          <div className="text-lg font-semibold text-emerald-300">{health.profileHealthPct}%</div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {health.layers.map((layer) => (
          <div key={layer.key} className="rounded border border-zinc-900 px-2 py-1.5">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wide">{layer.label}</div>
            <div className="text-sm text-zinc-100">
              {layer.have} / {layer.of}{" "}
              <span className="text-[10px] text-zinc-500">{layer.status}</span>
            </div>
            <Progress have={layer.have} of={layer.of} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DataBackfillAdminPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const res = await fetch("/api/admin/data-backfill?view=sa");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setSnapshot(data.snapshot);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function processQueue() {
    setBusy("queue");
    try {
      const res = await fetch("/api/admin/data-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process-queue", limit: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Process failed");
      setMessage(`Processed ${data.processed ?? 0} queued entities`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="cms-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="m-0 text-xl font-semibold">Data Backfill</h1>
          <p className="mt-1 mb-0 text-sm text-zinc-500 max-w-2xl">
            Build for complete data. Operate with partial data. Live and historic share one model —
            every new record marks affected profiles STALE and queues recalculation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={Boolean(busy)}
            onClick={() => void load()}
          >
            {busy === "load" ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary text-xs"
            disabled={Boolean(busy)}
            onClick={() => void processQueue()}
          >
            {busy === "queue" ? "Processing…" : "Process recalc queue"}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-amber-300 mb-3">{message}</p> : null}

      {!snapshot ? (
        <p className="text-sm text-zinc-500">Loading South Africa snapshot…</p>
      ) : (
        <div className="grid gap-4">
          <section className="cms-card border border-zinc-700">
            <h2 className="m-0 mb-3 text-base font-semibold">Priority 1 — South Africa</h2>
            <HealthCard health={snapshot.team} />
          </section>

          <section className="cms-card border border-zinc-700">
            <h2 className="m-0 mb-3 text-base font-semibold">South Africa coaches</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {snapshot.coaches.map((c) => (
                <HealthCard key={c.entityId} health={c} />
              ))}
              {snapshot.coaches.length === 0 ? (
                <p className="text-sm text-zinc-500 m-0">No coaching staff linked.</p>
              ) : null}
            </div>
          </section>

          <section className="cms-card border border-zinc-700">
            <h2 className="m-0 mb-3 text-base font-semibold">Profiles needing attention (queue)</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {["player", "team", "coach", "referee"].map((type) => {
                const q = snapshot.queue[type] ?? {
                  stale: 0,
                  failed: 0,
                  calculating: 0,
                  partial: 0,
                };
                return (
                  <div key={type} className="rounded border border-zinc-800 px-3 py-2">
                    <div className="text-xs uppercase text-zinc-500">{type}s</div>
                    <div className="text-zinc-100 font-semibold">
                      {q.stale + q.failed} needing work
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      stale {q.stale} · failed {q.failed} · partial {q.partial} · calculating{" "}
                      {q.calculating}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="cms-card border border-zinc-700">
            <h2 className="m-0 mb-2 text-base font-semibold">
              Player value history — bulk backfill (stub)
            </h2>
            <p className="text-sm text-zinc-500 mt-0 mb-3">
              Filters ready for a future bulk runner. Production writes currently run per player from
              Player CMS → Market value → History.
            </p>
            <div className="grid gap-2 sm:grid-cols-4 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-500">Range</span>
                <select className="cms-select w-full mt-1" disabled defaultValue="6">
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                  <option value="24">24 months</option>
                  <option value="career">Career</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">Position</span>
                <input className="cms-input w-full mt-1" disabled placeholder="e.g. Fly-half" />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">Competition</span>
                <input className="cms-input w-full mt-1" disabled placeholder="Competition ID" />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">Limit</span>
                <input className="cms-input w-full mt-1" disabled defaultValue={50} />
              </label>
            </div>
            <button type="button" className="cms-btn cms-btn--secondary text-xs mt-3" disabled>
              Bulk run (coming soon)
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
