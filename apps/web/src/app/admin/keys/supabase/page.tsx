"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SecretKeyField } from "@/components/admin/SecretKeyField";
import { PageHeader } from "@/components/shell/PageHeader";

type IntegrationStatus = {
  configured: boolean;
  buckets: string[];
  liveFixturesCount: number | null;
  error?: string;
};

type Config = {
  projectUrl: string;
  projectUrlHost?: string;
  hasAnonKey: boolean;
  anonKeyMasked?: string;
  hasServiceRoleKey: boolean;
  serviceRoleKeyMasked?: string;
  configured: boolean;
  anonConfigured?: boolean;
  projectUrlSource: "environment" | "admin" | "none";
  anonKeySource: "environment" | "admin" | "none";
  serviceRoleKeySource: "environment" | "admin" | "none";
  docsUrl?: string;
  envProjectUrlOverride?: boolean;
  envAnonKeyOverride?: boolean;
  envServiceRoleOverride?: boolean;
  integration?: IntegrationStatus | null;
};

export default function SupabaseKeysPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [projectUrl, setProjectUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [mirroring, setMirroring] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [mirrorDate, setMirrorDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/supabase");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
      setProjectUrl(data.projectUrl ?? "");
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
    const res = await fetch("/api/admin/integrations/supabase", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectUrl: projectUrl || undefined,
        anonKey: anonKey || undefined,
        serviceRoleKey: serviceRoleKey || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? "Save failed");
    } else {
      setMessage("Supabase settings saved.");
      setAnonKey("");
      setServiceRoleKey("");
      setConfig(data);
      if (data.projectUrl) setProjectUrl(data.projectUrl);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/supabase", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test",
        projectUrl: projectUrl.trim() || undefined,
        serviceRoleKey: serviceRoleKey.trim() || undefined,
        anonKey: anonKey.trim() || undefined,
      }),
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
    if (
      !confirm(
        "Remove stored Supabase URL and keys from the CMS? Environment variables are not cleared.",
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/integrations/supabase", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clear",
        clearProjectUrl: true,
        clearAnonKey: true,
        clearServiceRoleKey: true,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setAnonKey("");
      setServiceRoleKey("");
      setMessage("Stored Supabase URL and keys cleared.");
      setConfig(data);
      setProjectUrl(data.projectUrl ?? "");
    }
  }

  async function bootstrap() {
    setBootstrapping(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/supabase", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bootstrap" }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setError((data.messages ?? [data.error ?? data.message ?? "Bootstrap failed"]).join(" · "));
    } else {
      setMessage((data.messages ?? ["Bootstrap complete"]).join(" · "));
      setConfig((prev) => (prev ? { ...prev, integration: data.integration ?? prev.integration } : prev));
    }
    setBootstrapping(false);
    await load();
  }

  async function mirrorDay() {
    setMirroring(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/supabase", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mirror-day", date: mirrorDate }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setError(
        (data.errors ?? [data.error ?? data.message ?? "Mirror failed"]).join(" · ") || "Mirror failed",
      );
    } else {
      setMessage(
        `Mirrored ${data.dateKey}: ${data.upserted ?? 0} rows` +
          (data.storagePath ? ` · storage ${data.storagePath}` : ""),
      );
    }
    setMirroring(false);
    await load();
  }

  async function syncAllData() {
    if (
      !confirm(
        "Upsert all mapped Rugby365 tables into Supabase? This can take several minutes and overwrites matching rows by primary key.",
      )
    ) {
      return;
    }
    setSyncingAll(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/supabase", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-all" }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setError(
        (data.errors ?? [data.error ?? data.message ?? "Full sync failed"]).join(" · ") ||
          "Full sync failed",
      );
    } else {
      const synced = Array.isArray(data.tables)
        ? data.tables.filter((t: { skipped?: boolean; error?: string }) => !t.skipped && !t.error)
            .length
        : 0;
      setMessage(
        `Mapped ${data.totalUpserted ?? 0} rows across ${synced} tables to Supabase` +
          (data.finishedAt ? ` · finished ${data.finishedAt}` : ""),
      );
    }
    setSyncingAll(false);
    await load();
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="Supabase (advanced)"
        description="Anon key, bootstrap buckets, fixture mirror and full CMS sync. Primary URL + service_role live on the API keys hub."
        actions={
          <>
            <Link href="/admin/keys#supabase" className="cms-btn cms-btn--primary touch-target">
              API keys hub
            </Link>
            <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
              Admin dashboard
            </Link>
          </>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Use values from <strong className="text-zinc-300">Project Settings → API</strong> (not Account →
          Access Tokens). Project URL looks like{" "}
          <code className="text-zinc-500">https://YOUR_REF.supabase.co</code>; anon/service keys usually
          start with <code className="text-zinc-500">eyJ</code>. Do not paste{" "}
          <code className="text-zinc-500">sbp_</code> personal tokens here.{" "}
          <code className="text-zinc-500">SUPABASE_*</code> env vars override CMS values. Service role
          bypasses RLS — never use <code className="text-zinc-500">NEXT_PUBLIC_*</code> for it.
          {config?.docsUrl ? (
            <>
              {" "}
              <a href={config.docsUrl} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">
                Open project API settings
              </a>
            </>
          ) : null}
        </p>

        {config?.envProjectUrlOverride || config?.envAnonKeyOverride || config?.envServiceRoleOverride ? (
          <p className="text-sm text-amber-400 m-0 cms-status cms-status--warning">
            Environment override active
            {config.envProjectUrlOverride ? " (project URL)" : ""}
            {config.envAnonKeyOverride ? " (anon key)" : ""}
            {config.envServiceRoleOverride ? " (service role)" : ""}.
          </p>
        ) : null}

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-1">
              <p className="m-0 text-zinc-300">
                Status:{" "}
                <span
                  className={
                    config?.configured || config?.anonConfigured
                      ? "text-emerald-400"
                      : "text-zinc-500"
                  }
                >
                  {config?.configured
                    ? "Configured (URL + service_role)"
                    : config?.anonConfigured
                      ? "Partial (URL + anon)"
                      : "Not configured"}
                </span>
              </p>
              <p className="m-0 text-zinc-500 break-all">
                Project URL: {config?.projectUrl || "—"}
                {config?.projectUrlSource === "environment" ? " (from .env)" : ""}
              </p>
              <p className="m-0 text-zinc-500">
                Anon key:{" "}
                {config?.anonKeyMasked
                  ? `${config.anonKeyMasked} (${config.anonKeySource})`
                  : "not set"}
              </p>
              <p className="m-0 text-zinc-500">
                Service role:{" "}
                {config?.serviceRoleKeyMasked
                  ? `${config.serviceRoleKeyMasked} (${config.serviceRoleKeySource})`
                  : "not set"}
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-zinc-400">Project URL</span>
              <input
                type="url"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                autoComplete="off"
                placeholder="https://YOUR_REF.supabase.co"
                disabled={Boolean(config?.envProjectUrlOverride)}
              />
            </label>

            <SecretKeyField
              label={
                config?.hasAnonKey && config.anonKeySource === "admin"
                  ? "Anon / publishable key (saved — leave blank to keep)"
                  : "Anon / publishable key"
              }
              value={anonKey}
              masked={config?.anonKeyMasked}
              dirty={Boolean(anonKey)}
              onChange={setAnonKey}
              onRevealFill={setAnonKey}
              placeholder={config?.hasAnonKey ? "••••••••" : "eyJhbGciOi…"}
              disabled={Boolean(config?.envAnonKeyOverride)}
              revealUrl="/api/admin/integrations/supabase"
              revealBody={{ field: "anonKey" }}
              canReveal={
                Boolean(config?.hasAnonKey) &&
                config?.anonKeySource === "admin" &&
                !config?.envAnonKeyOverride
              }
              envOverride={Boolean(config?.envAnonKeyOverride)}
              envKeyName="SUPABASE_ANON_KEY"
              onStatus={(msg, kind) => {
                if (kind === "error") setError(msg);
              }}
            />

            <SecretKeyField
              label={
                config?.hasServiceRoleKey && config.serviceRoleKeySource === "admin"
                  ? "Service role key (saved — leave blank to keep)"
                  : "Service role key (server-only)"
              }
              value={serviceRoleKey}
              masked={config?.serviceRoleKeyMasked}
              dirty={Boolean(serviceRoleKey)}
              onChange={setServiceRoleKey}
              onRevealFill={setServiceRoleKey}
              placeholder={
                config?.hasServiceRoleKey ? "••••••••" : "optional — never expose to browser"
              }
              disabled={Boolean(config?.envServiceRoleOverride)}
              revealUrl="/api/admin/integrations/supabase"
              revealBody={{ field: "serviceRoleKey" }}
              canReveal={
                Boolean(config?.hasServiceRoleKey) &&
                config?.serviceRoleKeySource === "admin" &&
                !config?.envServiceRoleOverride
              }
              envOverride={Boolean(config?.envServiceRoleOverride)}
              envKeyName="SUPABASE_SERVICE_ROLE_KEY"
              onStatus={(msg, kind) => {
                if (kind === "error") setError(msg);
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={
                  saving ||
                  (Boolean(config?.envProjectUrlOverride) &&
                    Boolean(config?.envAnonKeyOverride) &&
                    Boolean(config?.envServiceRoleOverride))
                }
                onClick={saveSettings}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={
                  testing ||
                  !(
                    config?.configured ||
                    config?.anonConfigured ||
                    projectUrl.trim() ||
                    serviceRoleKey.trim() ||
                    anonKey.trim()
                  )
                }
                onClick={testConnection}
              >
                {testing ? "Testing…" : "Test Supabase connection"}
              </button>
              {config?.anonKeySource === "admin" || config?.serviceRoleKeySource === "admin" ? (
                <button type="button" className="cms-btn cms-btn--secondary" onClick={clearKeys}>
                  Clear keys
                </button>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              <h2 className="text-zinc-200 text-sm m-0">Integration</h2>
              <p className="text-xs text-zinc-500 m-0">
                Creates public Storage buckets (<code className="text-zinc-500">rugby365-media</code>,{" "}
                <code className="text-zinc-500">rugby365-live</code>), mirrors daily fixtures into{" "}
                <code className="text-zinc-500">live_fixtures</code>, and can upsert the full CMS
                schema into Supabase. Approved player images are mirrored to Storage automatically.
              </p>
              {config?.integration ? (
                <p className="text-xs text-zinc-400 m-0">
                  Buckets: {(config.integration.buckets ?? []).join(", ") || "none"} · live_fixtures rows:{" "}
                  {config.integration.liveFixturesCount ?? "—"}
                  {config.integration.error ? ` · ${config.integration.error}` : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={bootstrapping || !config?.hasServiceRoleKey}
                  onClick={bootstrap}
                >
                  {bootstrapping ? "Bootstrapping…" : "Bootstrap buckets"}
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--primary"
                  disabled={syncingAll || !config?.hasServiceRoleKey}
                  onClick={syncAllData}
                >
                  {syncingAll ? "Mapping data…" : "Map all data to Supabase"}
                </button>
              </div>
              <label className="block text-sm">
                <span className="text-zinc-400">Mirror fixtures date</span>
                <input
                  type="date"
                  className="cms-input mt-1 w-full font-mono text-sm"
                  value={mirrorDate}
                  onChange={(e) => setMirrorDate(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={mirroring || !config?.hasServiceRoleKey || !mirrorDate}
                onClick={mirrorDay}
              >
                {mirroring ? "Mirroring…" : "Mirror day to Supabase"}
              </button>
            </div>
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>

      <div className="cms-card max-w-2xl mt-4 text-sm text-zinc-400">
        <h2 className="text-zinc-200 text-base mt-0">What runs automatically</h2>
        <ul className="m-0 pl-4 space-y-1">
          <li>
            <strong className="text-zinc-300">Map all data</strong> upserts teams, players, fixtures,
            events, stats, transfers, ratings and related CMS tables into Supabase by primary key
          </li>
          <li>Schedule / Rugby Data day sync → upserts <code className="text-zinc-500">live_fixtures</code> + JSON in Storage</li>
          <li>Approve / set primary player image → mirror file into <code className="text-zinc-500">rugby365-media</code></li>
          <li>Anon key is safe for client RLS reads; service role stays server-only</li>
          <li>Skipped on full sync: integration credentials, raw provider payloads, sandbox/audit ops tables</li>
        </ul>
      </div>
    </>
  );
}
