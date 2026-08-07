"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrackerSettings = {
  trackerActivated: boolean;
  publicAnimationEnabled: boolean;
  publicReplayEnabled: boolean;
  countdownHeld: boolean;
  countdownCancelled: boolean;
  kickOffDelayed: boolean;
  revisedKickoffAt: string | null;
  previewMode: boolean;
  matchStartedAt: string | null;
};

type SaResultOption = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  result: "won" | "lost" | "draw" | null;
  status: string;
};

function formatResult(row: SaResultOption) {
  const date = row.kickoffAt
    ? new Date(row.kickoffAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const letter =
    row.result === "won" ? "W" : row.result === "lost" ? "L" : row.result === "draw" ? "D" : row.status;
  return `${date} · ${letter} ${row.teamScore}–${row.opponentScore} vs ${row.opponentName}`;
}

export function MatchTrackerSettingsPanel({ fixtureId }: { fixtureId: string }) {
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [revisedLocal, setRevisedLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saResults, setSaResults] = useState<SaResultOption[]>([]);
  const SA_ID = "b0000000-0000-4000-8000-000000000001";

  async function load() {
    const res = await fetch(`/api/admin/matches/${fixtureId}/tracker`);
    if (!res.ok) return;
    const body = (await res.json()) as { settings: TrackerSettings & { revisedKickoffAt?: string | Date | null } };
    const s = body.settings;
    setSettings({
      ...s,
      revisedKickoffAt: s.revisedKickoffAt ? new Date(s.revisedKickoffAt).toISOString() : null,
    });
    if (s.revisedKickoffAt) {
      const d = new Date(s.revisedKickoffAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      setRevisedLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    }
  }

  useEffect(() => {
    void load();
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/teams/${SA_ID}`);
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const fixtures = (data.fixtures ?? []) as Array<{
          id: string;
          slug: string;
          kickoffAt: string | null;
          opponentName: string;
          teamScore: number;
          opponentScore: number;
          result: "won" | "lost" | "draw" | null;
          status: string;
        }>;
        setSaResults(
          fixtures
            .filter((f) => f.status === "full_time" || f.status === "live")
            .slice(0, 80)
            .map((f) => ({
              id: f.id,
              slug: f.slug,
              kickoffAt: f.kickoffAt,
              opponentName: f.opponentName,
              teamScore: f.teamScore,
              opponentScore: f.opponentScore,
              result: f.result,
              status: f.status,
            })),
        );
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/tracker`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setMessage("Could not save tracker settings.");
        return;
      }
      setMessage(okMsg);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-zinc-500">Loading tracker settings…</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded border border-zinc-800 bg-zinc-950/40 p-3 space-y-2">
        <label className="block text-xs uppercase tracking-wide text-zinc-500 m-0">
          Jump to Springboks result (animation)
        </label>
        <select
          className="cms-select w-full"
          value={fixtureId}
          onChange={(e) => {
            const next = e.target.value;
            if (next && next !== fixtureId) {
              window.location.href = `/admin/matches/${next}/animation`;
            }
          }}
        >
          {saResults.length === 0 ? <option value={fixtureId}>Current fixture</option> : null}
          {saResults.map((row) => (
            <option key={row.id} value={row.id}>
              {formatResult(row)}
            </option>
          ))}
        </select>
        <p className="m-0 text-xs text-zinc-600">
          Prefer results over the calendar when rehearsing Springboks match animations.{" "}
          <Link href={`/admin/teams/${SA_ID}/edit`} className="text-emerald-400 hover:underline">
            Team fixtures
          </Link>
        </p>
      </div>

      <p className="m-0 text-zinc-400">
        Controls public Match Animation countdown, activation, and kick-off. Preview mode never publishes
        test events.
      </p>
      {settings.previewMode ? (
        <p className="m-0 rounded border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-amber-200" role="status">
          Preview mode is on — public pages stay unchanged unless using an authorised preview link.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.publicAnimationEnabled}
            disabled={saving}
            onChange={(e) => void patch({ publicAnimationEnabled: e.target.checked }, "Public animation updated.")}
          />
          Public animation enabled
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.publicReplayEnabled}
            disabled={saving}
            onChange={(e) => void patch({ publicReplayEnabled: e.target.checked }, "Replay setting updated.")}
          />
          Public replay enabled
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.previewMode}
            disabled={saving}
            onChange={(e) => void patch({ previewMode: e.target.checked }, "Preview mode updated.")}
          />
          Preview mode
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={saving}
          onClick={() => void patch({ countdownHeld: !settings.countdownHeld }, "Countdown hold toggled.")}
        >
          {settings.countdownHeld ? "Release countdown" : "Hold countdown"}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={saving}
          onClick={() =>
            void patch(
              { kickOffDelayed: true, revisedKickoffAt: revisedLocal ? new Date(revisedLocal).toISOString() : null },
              "Kick-off marked delayed.",
            )
          }
        >
          Mark delayed
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={saving}
          onClick={() => void patch({ kickOffDelayed: false, revisedKickoffAt: null }, "Delay cleared.")}
        >
          Clear delay
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={saving}
          onClick={() => void patch({ confirmKickOff: true, startMatch: true }, "Match started.")}
        >
          Start match
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={saving}
          onClick={() => void patch({ confirmFullTime: true }, "Full-time confirmed.")}
        >
          Confirm full-time
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-zinc-400">Revised kick-off (local)</span>
        <input
          type="datetime-local"
          className="cms-input"
          value={revisedLocal}
          onChange={(e) => setRevisedLocal(e.target.value)}
        />
      </label>
      {message ? <p className="m-0 text-emerald-400">{message}</p> : null}
      {settings.matchStartedAt ? (
        <p className="m-0 text-zinc-500">Started at {new Date(settings.matchStartedAt).toLocaleString("en-GB")}</p>
      ) : null}
    </div>
  );
}
