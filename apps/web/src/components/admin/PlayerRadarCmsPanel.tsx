"use client";

import { useEffect, useState } from "react";

type RadarSettings = {
  enabled?: boolean;
  defaultType?: string;
  minMinutes?: number;
};

const RADAR_TYPES = [
  { value: "overall", label: "Overall Player DNA" },
  { value: "attack", label: "Attack" },
  { value: "defence", label: "Defence" },
  { value: "carrying", label: "Ball carrying" },
  { value: "set_piece", label: "Set piece" },
  { value: "physical", label: "Physical" },
  { value: "kicking", label: "Kicking" },
  { value: "discipline", label: "Discipline" },
];

export function PlayerRadarCmsPanel({
  playerId,
  playerSlug,
}: {
  playerId: string;
  playerSlug?: string | null;
}) {
  const [settings, setSettings] = useState<RadarSettings>({
    enabled: true,
    defaultType: "overall",
    minMinutes: 400,
  });
  const [summaryOverride, setSummaryOverride] = useState("");
  const [summaryApproved, setSummaryApproved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/players/${playerId}/radar`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const s = (data.settings ?? {}) as RadarSettings;
        setSettings({
          enabled: s.enabled !== false,
          defaultType: typeof s.defaultType === "string" ? s.defaultType : "overall",
          minMinutes: typeof s.minMinutes === "number" ? s.minMinutes : 400,
        });
        setSummaryOverride(typeof data.summaryOverride === "string" ? data.summaryOverride : "");
        setSummaryApproved(Boolean(data.summaryApproved));
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
      const res = await fetch(`/api/admin/players/${playerId}/radar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          summaryOverride: summaryOverride.trim() || null,
          summaryApproved,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved radar settings.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const previewHref = playerSlug
    ? `/players/${playerSlug}?tab=stats&preview=1`
    : null;

  return (
    <div className="cms-card mb-4">
      <h3 className="font-semibold m-0">Public performance radar</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-3">
        Position-percentile radar from Rugby365 season stats. Compared only with the same
        position family. Kicking and discipline spokes appear when those metrics exist in match
        data.
      </p>
      {!loaded ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      <div className="grid gap-2 text-sm">
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={settings.enabled !== false}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
          />
          Enable radar on public profile
        </label>
        <label className="flex flex-col gap-1 max-w-xs">
          Default radar type
          <select
            value={settings.defaultType ?? "overall"}
            onChange={(e) => setSettings((s) => ({ ...s, defaultType: e.target.value }))}
          >
            {RADAR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 max-w-xs">
          Minimum minutes (cohort)
          <input
            type="number"
            min={0}
            step={50}
            value={settings.minMinutes ?? 400}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                minMinutes: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
              }))
            }
          />
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={summaryApproved}
            onChange={(e) => setSummaryApproved(e.target.checked)}
          />
          Approve data-generated summary
        </label>
        <label className="flex flex-col gap-1">
          Override summary (optional)
          <textarea
            rows={3}
            value={summaryOverride}
            onChange={(e) => setSummaryOverride(e.target.value)}
            placeholder="Leave blank to use the structured percentile summary."
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save radar settings"}
        </button>
        {previewHref ? (
          <a className="btn btn-secondary" href={previewHref} target="_blank" rel="noreferrer">
            Preview radar
          </a>
        ) : null}
        {status ? <span className="text-sm text-zinc-600">{status}</span> : null}
      </div>
    </div>
  );
}
