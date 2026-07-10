"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Config = {
  hasApiToken: boolean;
  apiTokenMasked?: string;
  baseUrl: string;
  configured: boolean;
  tokenSource: "environment" | "admin" | "none";
  baseUrlSource: "environment" | "admin" | "default";
  docsUrl?: string;
  envTokenOverride?: boolean;
  envBaseUrlOverride?: boolean;
};

export default function RugbyDataApiKeysPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/rugby-data");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
      setBaseUrl(data.baseUrl ?? "");
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
    const res = await fetch("/api/admin/integrations/rugby-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken: apiToken || undefined,
        baseUrl: baseUrl || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? "Save failed");
    } else {
      setMessage("Rugby Data API settings saved.");
      setApiToken("");
      setConfig(data);
      if (data.baseUrl) setBaseUrl(data.baseUrl);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/rugby-data", {
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

  async function clearToken() {
    if (!confirm("Remove the stored Rugby Data API token from the CMS?")) return;
    const res = await fetch("/api/admin/integrations/rugby-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    const data = await res.json();
    if (res.ok) {
      setApiToken("");
      setMessage("Stored API token cleared.");
      setConfig(data);
      if (data.baseUrl) setBaseUrl(data.baseUrl);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="Rugby Data API"
        description="Primary provider for competitions, teams, matches, scores, lineups, stats and tables."
        actions={
          <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
            Admin dashboard
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Server-only credentials for the Planet Rugby / Rugby Data API. Values saved here are stored in
          the Rugby365 database.{" "}
          <code className="text-zinc-500">RUGBY_DATA_API_TOKEN</code> and{" "}
          <code className="text-zinc-500">RUGBY_DATA_API_BASE_URL</code> in{" "}
          <code className="text-zinc-500">.env</code> override CMS settings when set. Never use{" "}
          <code className="text-zinc-500">NEXT_PUBLIC_*</code> for the token.
        </p>

        {config?.envTokenOverride ? (
          <p className="text-sm text-amber-400 m-0 cms-status cms-status--warning">
            Environment override active — using RUGBY_DATA_API_TOKEN from .env
            {config.apiTokenMasked ? ` (${config.apiTokenMasked})` : ""}.
          </p>
        ) : null}

        {config?.envBaseUrlOverride ? (
          <p className="text-sm text-amber-400 m-0 cms-status cms-status--warning">
            Environment override active — using RUGBY_DATA_API_BASE_URL from .env.
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
                  {config?.configured ? "Configured" : "Not configured"}
                </span>
              </p>
              {config?.apiTokenMasked ? (
                <p className="m-0 text-zinc-500">Token: {config.apiTokenMasked}</p>
              ) : (
                <p className="m-0 text-zinc-500">Token: not set (optional for some GET endpoints)</p>
              )}
              <p className="m-0 text-zinc-500">
                Token source:{" "}
                {config?.tokenSource === "environment"
                  ? "Environment"
                  : config?.tokenSource === "admin"
                    ? "CMS"
                    : "None"}
              </p>
              <p className="m-0 text-zinc-500 break-all">
                Base URL: {config?.baseUrl}
                {config?.baseUrlSource === "environment"
                  ? " (from .env)"
                  : config?.baseUrlSource === "default"
                    ? " (default)"
                    : ""}
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-zinc-400">Base URL</span>
              <input
                type="url"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                autoComplete="off"
                placeholder="https://…"
                disabled={Boolean(config?.envBaseUrlOverride)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">
                API token{" "}
                {config?.hasApiToken && config.tokenSource === "admin"
                  ? "(saved — leave blank to keep)"
                  : ""}
              </span>
              <input
                type="password"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                autoComplete="off"
                placeholder={config?.hasApiToken ? "••••••••" : "token header value"}
                disabled={Boolean(config?.envTokenOverride)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={
                  saving ||
                  (Boolean(config?.envTokenOverride) && Boolean(config?.envBaseUrlOverride))
                }
                onClick={saveSettings}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={testing || !config?.configured}
                onClick={testConnection}
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
              {config?.tokenSource === "admin" ? (
                <button type="button" className="cms-btn cms-btn--secondary" onClick={clearToken}>
                  Clear token
                </button>
              ) : null}
            </div>
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>

      <div className="cms-card max-w-2xl mt-4 text-sm text-zinc-400">
        <h2 className="text-zinc-200 text-base mt-0">Used by</h2>
        <ul className="m-0 pl-4 space-y-1">
          <li>Primary source for competitions, teams and fixtures</li>
          <li>Match scores, lineups, player/team stats and tables</li>
          <li>Future sync and mapping review (P1 over SDMS / Sport365)</li>
        </ul>
      </div>
    </>
  );
}
