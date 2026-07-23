"use client";

import { useEffect, useState } from "react";

type ChartSettings = {
  enabled?: boolean;
  showRollingAverage?: boolean;
  showSeasonAverage?: boolean;
  showCareerAverage?: boolean;
  minMinutes?: number;
};

export function PlayerDevelopmentChartCmsPanel({
  playerId,
  playerSlug,
}: {
  playerId: string;
  playerSlug?: string | null;
}) {
  const [settings, setSettings] = useState<ChartSettings>({
    enabled: true,
    showRollingAverage: true,
    showSeasonAverage: false,
    showCareerAverage: false,
    minMinutes: 0,
  });
  const [summaryOverride, setSummaryOverride] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/players/${playerId}/development-chart`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const s = (data.settings ?? {}) as ChartSettings;
        setSettings({
          enabled: s.enabled !== false,
          showRollingAverage: s.showRollingAverage !== false,
          showSeasonAverage: s.showSeasonAverage === true,
          showCareerAverage: s.showCareerAverage === true,
          minMinutes: typeof s.minMinutes === "number" ? s.minMinutes : 0,
        });
        setSummaryOverride(typeof data.summaryOverride === "string" ? data.summaryOverride : "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/development-chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          summaryOverride: summaryOverride.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved development chart settings.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cms-card mb-4">
      <h3 className="font-semibold m-0">Public development timeline</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-3">
        Controls the Development Timeline on public Stats, Career and Overview. Match ratings are
        calculated in Rating Lab.
      </p>
      {!loaded ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      <div className="grid gap-2 text-sm">
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={settings.enabled !== false}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
          />
          Enable development chart
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={settings.showRollingAverage !== false}
            onChange={(e) => setSettings((s) => ({ ...s, showRollingAverage: e.target.checked }))}
          />
          Show five-match rolling average by default
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={settings.showSeasonAverage === true}
            onChange={(e) => setSettings((s) => ({ ...s, showSeasonAverage: e.target.checked }))}
          />
          Show season average by default
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={settings.showCareerAverage === true}
            onChange={(e) => setSettings((s) => ({ ...s, showCareerAverage: e.target.checked }))}
          />
          Show career average by default
        </label>
        <label className="flex flex-col gap-1 max-w-xs">
          Minimum minutes for rated chart points
          <input
            type="number"
            min={0}
            className="cms-input"
            value={settings.minMinutes ?? 0}
            onChange={(e) =>
              setSettings((s) => ({ ...s, minMinutes: Number.parseInt(e.target.value, 10) || 0 }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          Written summary override (leave blank to auto-generate)
          <textarea
            className="cms-input min-h-[5rem]"
            value={summaryOverride}
            onChange={(e) => setSummaryOverride(e.target.value)}
            placeholder="Approved factual summary…"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button type="button" className="cms-btn cms-btn--primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save chart settings"}
        </button>
        {playerSlug ? (
          <a
            className="cms-btn cms-btn--secondary"
            href={`/players/${playerSlug}?preview=1&tab=stats`}
            target="_blank"
            rel="noreferrer"
          >
            Preview public chart
          </a>
        ) : null}
        <a className="cms-btn cms-btn--secondary" href="/admin/rating-lab">
          Open Rating Lab
        </a>
      </div>
      {status ? <p className="text-sm text-zinc-400 mt-2">{status}</p> : null}
    </div>
  );
}
