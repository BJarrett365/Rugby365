"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  BROADCASTER_REGIONS,
  PRIMARY_BROADCASTER_REGIONS,
} from "@/lib/rugby-broadcaster-presets";

type Config = {
  provider: "none" | "gracenote" | "pa_media";
  hasGracenoteApiKey: boolean;
  gracenoteApiKeyMasked?: string;
  gracenoteBaseUrl: string;
  gracenoteLineupId: string;
  hasPaApiKey: boolean;
  paApiKeyMasked?: string;
  defaultRegion: string;
  configured: boolean;
  gracenoteKeySource: string;
  paKeySource: string;
  docs?: { gracenote: string; paMedia: string };
  note?: string;
  envOverride?: { gracenote: boolean; paMedia: boolean };
};

export default function TvScheduleKeysPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [provider, setProvider] = useState<"none" | "gracenote" | "pa_media">("none");
  const [gracenoteApiKey, setGracenoteApiKey] = useState("");
  const [gracenoteBaseUrl, setGracenoteBaseUrl] = useState("");
  const [gracenoteLineupId, setGracenoteLineupId] = useState("");
  const [paApiKey, setPaApiKey] = useState("");
  const [defaultRegion, setDefaultRegion] = useState("UK");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/tv-schedule");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
      setProvider(data.provider ?? "none");
      setGracenoteBaseUrl(data.gracenoteBaseUrl ?? "");
      setGracenoteLineupId(data.gracenoteLineupId ?? "");
      setDefaultRegion(data.defaultRegion ?? "UK");
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/tv-schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        gracenoteApiKey: gracenoteApiKey || undefined,
        gracenoteBaseUrl: gracenoteBaseUrl || undefined,
        gracenoteLineupId: gracenoteLineupId || undefined,
        paApiKey: paApiKey || undefined,
        defaultRegion,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? "Save failed");
    } else {
      setMessage("TV schedule settings saved.");
      setGracenoteApiKey("");
      setPaApiKey("");
      setConfig(data);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/tv-schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Connection test failed");
    } else {
      setMessage(data.message ?? "Connected.");
    }
    setTesting(false);
  }

  async function clearKeys() {
    if (!confirm("Clear stored TV schedule API keys from the CMS?")) return;
    const res = await fetch("/api/admin/integrations/tv-schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Stored keys cleared.");
      setConfig(data);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="TV Schedule"
        description="EPG providers for rugby union where-to-watch — Gracenote or PA Media. Manual CMS broadcasters work without a key."
        actions={
          <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
            Admin dashboard
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Planet Rugby / SDMS do not include TV listings. Add broadcasters per match under{" "}
          <strong className="text-zinc-300 font-medium">TV / streaming schedule</strong>, or store an
          EPG API key here for future automated sync.
        </p>
        {config?.note ? <p className="text-sm text-zinc-500 m-0">{config.note}</p> : null}

        {config?.envOverride?.gracenote || config?.envOverride?.paMedia ? (
          <p className="text-sm text-amber-400 m-0 cms-status cms-status--warning">
            Environment override active
            {config.envOverride.gracenote ? " (GRACENOTE_API_KEY)" : ""}
            {config.envOverride.paMedia ? " (PA_MEDIA_TV_API_KEY)" : ""}.
          </p>
        ) : null}

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-1">
              <p className="m-0 text-zinc-300">
                Status:{" "}
                <span className={config?.configured ? "text-emerald-400" : "text-zinc-500"}>
                  {config?.configured
                    ? `Configured (${config.provider})`
                    : "Manual CMS only (no EPG key)"}
                </span>
              </p>
              <p className="m-0 text-zinc-500">
                Gracenote:{" "}
                {config?.hasGracenoteApiKey
                  ? `${config.gracenoteApiKeyMasked} (${config.gracenoteKeySource})`
                  : "not set"}
              </p>
              <p className="m-0 text-zinc-500">
                PA Media:{" "}
                {config?.hasPaApiKey
                  ? `${config.paApiKeyMasked} (${config.paKeySource})`
                  : "not set"}
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-zinc-400">Preferred provider</span>
              <select
                className="cms-select w-full mt-1"
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as "none" | "gracenote" | "pa_media")
                }
              >
                <option value="none">None — CMS manual only</option>
                <option value="gracenote">Gracenote OnConnect</option>
                <option value="pa_media">PA Media TV / EPG</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">Default region</span>
              <select
                className="cms-select w-full mt-1"
                value={defaultRegion}
                onChange={(e) => setDefaultRegion(e.target.value)}
              >
                {BROADCASTER_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                    {PRIMARY_BROADCASTER_REGIONS.includes(r.code) ? " · primary" : ""}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-zinc-500 mt-1">
                Primary rugby markets: UK, South Africa, Australia, New Zealand, France.
              </span>
            </label>

            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <p className="text-sm text-zinc-300 m-0">Gracenote</p>
              <p className="text-xs text-zinc-500 m-0">
                Sports airings API —{" "}
                <a
                  href={
                    config?.docs?.gracenote ??
                    "https://developer.tmsapi.com/docs/data_v1_1/sports/Sports_events_airings"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  docs
                </a>
                .
              </p>
              <label className="block text-sm">
                <span className="text-zinc-400">API key</span>
                <input
                  type="password"
                  className="cms-input w-full mt-1"
                  value={gracenoteApiKey}
                  onChange={(e) => setGracenoteApiKey(e.target.value)}
                  placeholder={config?.hasGracenoteApiKey ? "•••• leave blank to keep" : "api_key"}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">Base URL</span>
                <input
                  className="cms-input w-full mt-1"
                  value={gracenoteBaseUrl}
                  onChange={(e) => setGracenoteBaseUrl(e.target.value)}
                  placeholder="https://data.tmsapi.com/v1.1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">UK lineup ID (optional)</span>
                <input
                  className="cms-input w-full mt-1"
                  value={gracenoteLineupId}
                  onChange={(e) => setGracenoteLineupId(e.target.value)}
                  placeholder="From Gracenote lineups by postal code"
                />
              </label>
            </div>

            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <p className="text-sm text-zinc-300 m-0">PA Media</p>
              <p className="text-xs text-zinc-500 m-0">
                UK EPG / streaming deep links —{" "}
                <a
                  href={config?.docs?.paMedia ?? "https://pa.media/pa-tv-metadata/epg-widget/"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  product page
                </a>
                . Endpoint details come with a commercial deal.
              </p>
              <label className="block text-sm">
                <span className="text-zinc-400">API key</span>
                <input
                  type="password"
                  className="cms-input w-full mt-1"
                  value={paApiKey}
                  onChange={(e) => setPaApiKey(e.target.value)}
                  placeholder={config?.hasPaApiKey ? "•••• leave blank to keep" : "PA API key"}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary touch-target"
                disabled={saving}
                onClick={() => void saveSettings()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary touch-target"
                disabled={testing}
                onClick={() => void testConnection()}
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary touch-target text-red-400"
                onClick={() => void clearKeys()}
              >
                Clear keys
              </button>
            </div>
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>
    </>
  );
}
