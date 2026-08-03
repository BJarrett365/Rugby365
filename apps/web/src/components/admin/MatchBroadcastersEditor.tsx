"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BROADCASTER_PLATFORMS,
  BROADCASTER_REGIONS,
  PRIMARY_BROADCASTER_REGIONS,
  RUGBY_BROADCASTER_PRESETS,
  defaultRegionPackRows,
  presetsForRegion,
  type BroadcasterPlatform,
  type BroadcasterRegionCode,
} from "@/lib/rugby-broadcaster-presets";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Row = {
  key: string;
  broadcasterName: string;
  channelName: string;
  region: string;
  platform: BroadcasterPlatform;
  url: string;
  startAt: string;
};

function emptyRow(region: string = "UK"): Row {
  return {
    key: `new-${Math.random().toString(36).slice(2, 9)}`,
    broadcasterName: "",
    channelName: "",
    region,
    platform: "tv",
    url: "",
    startAt: "",
  };
}

export function MatchBroadcastersEditor({ fixtureId }: { fixtureId: string }) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const presetOptions = useMemo(() => {
    if (!filterRegion) return [...RUGBY_BROADCASTER_PRESETS];
    return presetsForRegion(filterRegion);
  }, [filterRegion]);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/matches/${fixtureId}/broadcasters`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load broadcasters");
      setLoading(false);
      return;
    }
    const loaded = (data.broadcasters ?? []) as Array<{
      id: string;
      broadcasterName: string;
      channelName: string | null;
      region: string | null;
      platform: BroadcasterPlatform;
      url: string | null;
      startAt: string | null;
    }>;
    setRows(
      loaded.length
        ? loaded.map((b) => ({
            key: b.id,
            broadcasterName: b.broadcasterName,
            channelName: b.channelName ?? "",
            region: b.region ?? "",
            platform: b.platform,
            url: b.url ?? "",
            startAt: b.startAt ? toDatetimeLocalValue(b.startAt) : "",
          }))
        : [emptyRow()],
    );
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on fixture change
  }, [fixtureId]);

  function applyPreset(index: number, presetName: string) {
    const preset = RUGBY_BROADCASTER_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              broadcasterName: preset.name,
              region: preset.region,
              platform: preset.platform as BroadcasterPlatform,
            }
          : row,
      ),
    );
  }

  function addRegionPack(region: BroadcasterRegionCode) {
    const pack = presetsForRegion(region);
    if (!pack.length) return;
    setRows((prev) => {
      const existing = new Set(
        prev.map((r) => `${r.region.trim().toUpperCase()}::${r.broadcasterName.trim().toLowerCase()}`),
      );
      const next = [...prev.filter((r) => r.broadcasterName.trim())];
      for (const p of pack) {
        const key = `${p.region}::${p.name.toLowerCase()}`;
        if (existing.has(key)) continue;
        next.push({
          key: `new-${Math.random().toString(36).slice(2, 9)}`,
          broadcasterName: p.name,
          channelName: "",
          region: p.region,
          platform: p.platform as BroadcasterPlatform,
          url: "",
          startAt: "",
        });
        existing.add(key);
      }
      return next.length ? next : [emptyRow(region)];
    });
    setMessage(`Added ${region} broadcaster pack — edit channels then save.`);
  }

  function addCoreTerritories() {
    const pack = defaultRegionPackRows();
    setRows((prev) => {
      const existing = new Set(
        prev.map((r) => `${r.region.trim().toUpperCase()}::${r.broadcasterName.trim().toLowerCase()}`),
      );
      const next = [...prev.filter((r) => r.broadcasterName.trim())];
      for (const p of pack) {
        const key = `${p.region}::${p.broadcasterName.toLowerCase()}`;
        if (existing.has(key)) continue;
        next.push({
          key: `new-${Math.random().toString(36).slice(2, 9)}`,
          broadcasterName: p.broadcasterName,
          channelName: "",
          region: p.region,
          platform: p.platform,
          url: "",
          startAt: "",
        });
        existing.add(key);
      }
      return next.length ? next : [emptyRow()];
    });
    setMessage("Added UK / SA / Aus / NZ / France starters — edit then save.");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    const payload = rows
      .filter((r) => r.broadcasterName.trim())
      .map((r, index) => ({
        broadcasterName: r.broadcasterName.trim(),
        channelName: r.channelName.trim() || null,
        region: r.region.trim() || null,
        platform: r.platform,
        url: r.url.trim() || null,
        startAt: r.startAt ? new Date(r.startAt).toISOString() : null,
        sourceProvider: "manual",
        sortOrder: index,
      }));
    const res = await fetch(`/api/admin/matches/${fixtureId}/broadcasters`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcasters: payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
    } else {
      setMessage(
        payload.length
          ? `Saved ${payload.length} broadcaster${payload.length === 1 ? "" : "s"}.`
          : "Cleared broadcasters for this match.",
      );
      await load();
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 m-0">Loading broadcasters…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 m-0">
        Where to watch — cover <strong className="text-zinc-300">UK, South Africa, Australia, New
        Zealand, France</strong> for rugby. Manual for now; Gracenote / PA Media can fill later from{" "}
        <a href="/admin/keys/tv-schedule" className="text-emerald-400 hover:underline">
          TV Schedule keys
        </a>
        .
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-zinc-500">Quick add:</span>
        <button type="button" className="cms-btn cms-btn--secondary text-xs" onClick={addCoreTerritories}>
          UK · SA · Aus · NZ · FR
        </button>
        {PRIMARY_BROADCASTER_REGIONS.map((code) => {
          const label = BROADCASTER_REGIONS.find((r) => r.code === code)?.label ?? code;
          return (
            <button
              key={code}
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => addRegionPack(code)}
              title={`Add all ${label} presets`}
            >
              + {code}
            </button>
          );
        })}
      </div>

      <label className="block text-xs text-zinc-500 max-w-xs">
        Filter presets by region
        <select
          className="cms-select w-full mt-1"
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
        >
          <option value="">All regions</option>
          {BROADCASTER_REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label} ({r.code})
            </option>
          ))}
        </select>
      </label>

      {rows.map((row, index) => (
        <div
          key={row.key}
          className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-2"
        >
          <div className="flex flex-wrap gap-2 items-end">
            <label className="block text-xs text-zinc-500 min-w-[10rem] flex-1">
              Preset
              <select
                className="cms-select w-full mt-1"
                value=""
                onChange={(e) => {
                  if (e.target.value) applyPreset(index, e.target.value);
                }}
              >
                <option value="">Choose…</option>
                {presetOptions.map((p) => (
                  <option key={`${p.region}-${p.name}`} value={p.name}>
                    {p.name} ({p.region})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-500 min-w-[10rem] flex-1">
              Broadcaster
              <input
                className="cms-input w-full mt-1"
                value={row.broadcasterName}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, broadcasterName: e.target.value } : r,
                    ),
                  )
                }
                placeholder="TNT Sports"
              />
            </label>
            <label className="block text-xs text-zinc-500 min-w-[8rem] flex-1">
              Channel
              <input
                className="cms-input w-full mt-1"
                value={row.channelName}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, channelName: e.target.value } : r,
                    ),
                  )
                }
                placeholder="TNT Sports 1"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="block text-xs text-zinc-500 w-44">
              Region
              <select
                className="cms-select w-full mt-1"
                value={
                  BROADCASTER_REGIONS.some((r) => r.code === row.region) ? row.region : "__custom"
                }
                onChange={(e) => {
                  const next = e.target.value === "__custom" ? "" : e.target.value;
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, region: next } : r)),
                  );
                }}
              >
                {BROADCASTER_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                  </option>
                ))}
                <option value="__custom">Other…</option>
              </select>
            </label>
            {!BROADCASTER_REGIONS.some((r) => r.code === row.region) ? (
              <label className="block text-xs text-zinc-500 w-28">
                Custom code
                <input
                  className="cms-input w-full mt-1"
                  value={row.region}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, region: e.target.value } : r)),
                    )
                  }
                  placeholder="e.g. JP"
                />
              </label>
            ) : null}
            <label className="block text-xs text-zinc-500 w-32">
              Platform
              <select
                className="cms-select w-full mt-1"
                value={row.platform}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? { ...r, platform: e.target.value as BroadcasterPlatform }
                        : r,
                    ),
                  )
                }
              >
                {BROADCASTER_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-500 min-w-[12rem] flex-1">
              URL (optional)
              <input
                className="cms-input w-full mt-1"
                value={row.url}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, url: e.target.value } : r)),
                  )
                }
                placeholder="https://…"
              />
            </label>
            <label className="block text-xs text-zinc-500 min-w-[11rem]">
              On air time
              <input
                type="datetime-local"
                className="cms-input w-full mt-1"
                value={row.startAt}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, startAt: e.target.value } : r)),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-red-400"
              onClick={() =>
                setRows((prev) =>
                  prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index),
                )
              }
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          onClick={() => setRows((prev) => [...prev, emptyRow(filterRegion || "UK")])}
        >
          Add broadcaster
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save TV schedule"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
      {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
    </div>
  );
}
