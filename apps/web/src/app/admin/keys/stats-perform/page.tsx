"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Config = {
  docsUsername?: string;
  hasDocsPassword: boolean;
  docsPasswordMasked?: string;
  hasOutletAuthKey: boolean;
  outletAuthKeyMasked?: string;
  baseUrl: string;
  docsConfigured: boolean;
  apiConfigured: boolean;
  configured: boolean;
  docsUsernameSource: string;
  docsPasswordSource: string;
  outletAuthKeySource: string;
  baseUrlSource: string;
  docsUrl?: string;
  swaggerUrl?: string;
  note?: string;
  envOverride?: {
    docsUsername: boolean;
    docsPassword: boolean;
    outletAuthKey: boolean;
    baseUrl: boolean;
  };
};

type MatchRow = {
  id: string;
  date: string | null;
  time: string | null;
  status: string | null;
  competition: string | null;
  home: string | null;
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export default function StatsPerformSdapiKeysPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [docsUsername, setDocsUsername] = useState("");
  const [docsPassword, setDocsPassword] = useState("");
  const [outletAuthKey, setOutletAuthKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingDocs, setTestingDocs] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [squads, setSquads] = useState<Array<{ contestantName: string; playerCount: number }>>([]);
  const [feeds, setFeeds] = useState<Array<{ feed: string; ok: boolean; status: number; summary: string }>>(
    [],
  );

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/stats-perform");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
      setDocsUsername(data.docsUsername ?? "");
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
    const res = await fetch("/api/admin/integrations/stats-perform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docsUsername: docsUsername || undefined,
        docsPassword: docsPassword || undefined,
        outletAuthKey: outletAuthKey || undefined,
        baseUrl: baseUrl || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? "Save failed");
    } else {
      setMessage("Stats Perform SDAPI settings saved.");
      setDocsPassword("");
      setOutletAuthKey("");
      setConfig(data);
      if (data.docsUsername) setDocsUsername(data.docsUsername);
      if (data.baseUrl) setBaseUrl(data.baseUrl);
    }
    setSaving(false);
  }

  async function testDocs() {
    setTestingDocs(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/stats-perform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test-docs" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Docs login failed");
    } else {
      setMessage(`${data.message ?? "Docs login works."} (${data.responseTimeMs ?? 0}ms)`);
    }
    setTestingDocs(false);
  }

  async function testApi() {
    setTestingApi(true);
    setError("");
    setMessage("");
    setMatches([]);
    setSquads([]);
    setFeeds([]);
    const res = await fetch("/api/admin/integrations/stats-perform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test-api" }),
    });
    const data = await res.json();
    if (Array.isArray(data.matches)) setMatches(data.matches as MatchRow[]);
    if (Array.isArray(data.squads)) setSquads(data.squads);
    if (Array.isArray(data.feeds)) setFeeds(data.feeds);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "SDAPI connection failed");
    } else {
      setMessage(`${data.message ?? "Connected."} (${data.responseTimeMs ?? 0}ms)`);
    }
    setTestingApi(false);
  }

  async function clearCreds(kind: "docs" | "outlet" | "all") {
    const label =
      kind === "docs"
        ? "documentation username and password"
        : kind === "outlet"
          ? "outlet authentication key"
          : "all stored Stats Perform credentials";
    if (!confirm(`Remove the ${label} from the CMS?`)) return;
    const res = await fetch("/api/admin/integrations/stats-perform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clear",
        clearDocs: kind === "docs" || kind === "all",
        clearOutletKey: kind === "outlet" || kind === "all",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setDocsPassword("");
      setOutletAuthKey("");
      setMessage("Stored credentials cleared.");
      setConfig(data);
      if (data.docsUsername) setDocsUsername(data.docsUsername);
      else if (kind === "docs" || kind === "all") setDocsUsername("");
      if (data.baseUrl) setBaseUrl(data.baseUrl);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="Stats Perform SDAPI"
        description="Rugby Union Sports Data API — documentation login plus outlet key for live scores, calendars and match stats."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/keys" className="cms-btn cms-btn--secondary touch-target">
              API keys
            </Link>
            <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
              Admin dashboard
            </Link>
          </div>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Saved values live in <code className="text-zinc-500">integration_settings</code> (slug{" "}
          <code className="text-zinc-500">stats_perform_sdapi</code>). Env vars{" "}
          <code className="text-zinc-500">STATS_PERFORM_DOCS_USERNAME</code>,{" "}
          <code className="text-zinc-500">STATS_PERFORM_DOCS_PASSWORD</code> and{" "}
          <code className="text-zinc-500">STATS_PERFORM_OUTLET_AUTH_KEY</code> override CMS when set.
          Never use <code className="text-zinc-500">NEXT_PUBLIC_*</code> for these secrets.
        </p>
        {config?.note ? <p className="text-sm text-amber-300/90 m-0">{config.note}</p> : null}

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-1">
              <p className="m-0 text-zinc-300">
                Docs login:{" "}
                <span className={config?.docsConfigured ? "text-emerald-400" : "text-zinc-500"}>
                  {config?.docsConfigured ? "Configured" : "Not set"}
                </span>
              </p>
              <p className="m-0 text-zinc-300">
                Outlet key:{" "}
                <span className={config?.apiConfigured ? "text-emerald-400" : "text-zinc-500"}>
                  {config?.apiConfigured ? "Configured" : "Not set"}
                </span>
              </p>
              {config?.docsPasswordMasked ? (
                <p className="m-0 text-zinc-500">Docs password: {config.docsPasswordMasked}</p>
              ) : null}
              {config?.outletAuthKeyMasked ? (
                <p className="m-0 text-zinc-500">Outlet key: {config.outletAuthKeyMasked}</p>
              ) : (
                <p className="m-0 text-zinc-500">
                  Outlet key: not set — live scores will fail until Stats Perform issues one.
                </p>
              )}
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
              <span className="text-zinc-400">Documentation username</span>
              <input
                type="text"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={docsUsername}
                onChange={(e) => setDocsUsername(e.target.value)}
                autoComplete="off"
                placeholder="statsperformdocs"
                disabled={Boolean(config?.envOverride?.docsUsername)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">
                Documentation password{" "}
                {config?.hasDocsPassword && config.docsPasswordSource === "admin"
                  ? "(saved — leave blank to keep)"
                  : ""}
              </span>
              <input
                type="password"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={docsPassword}
                onChange={(e) => setDocsPassword(e.target.value)}
                autoComplete="off"
                placeholder={config?.hasDocsPassword ? "••••••••" : "docs site password"}
                disabled={Boolean(config?.envOverride?.docsPassword)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">Outlet authentication key (26 characters)</span>
              <input
                type="password"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={outletAuthKey}
                onChange={(e) => setOutletAuthKey(e.target.value)}
                autoComplete="off"
                placeholder={config?.hasOutletAuthKey ? "••••••••" : "from Stats Perform account setup"}
                disabled={Boolean(config?.envOverride?.outletAuthKey)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">API base URL</span>
              <input
                type="url"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                autoComplete="off"
                placeholder="https://api.performfeeds.com"
                disabled={Boolean(config?.envOverride?.baseUrl)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={saving}
                onClick={saveSettings}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={testingDocs || !config?.docsConfigured}
                onClick={testDocs}
              >
                {testingDocs ? "Testing…" : "Test docs login"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={testingApi}
                onClick={testApi}
              >
                {testingApi ? "Testing…" : "Test rugby scores API"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {config?.docsPasswordSource === "admin" ? (
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  onClick={() => clearCreds("docs")}
                >
                  Clear docs login
                </button>
              ) : null}
              {config?.outletAuthKeySource === "admin" ? (
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  onClick={() => clearCreds("outlet")}
                >
                  Clear outlet key
                </button>
              ) : null}
            </div>
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}

        {feeds.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
            <h2 className="text-zinc-200 text-sm m-0">Documented rugby feeds</h2>
            <ul className="m-0 pl-0 list-none space-y-1 text-sm">
              {feeds.map((feed) => (
                <li key={feed.feed} className="m-0 text-zinc-400">
                  <span className={feed.ok ? "text-emerald-400" : "text-amber-400"}>
                    {feed.ok ? "OK" : "No"}
                  </span>{" "}
                  <span className="text-zinc-300 font-mono">{feed.feed}</span>
                  <span className="text-zinc-500"> · HTTP {feed.status}</span>
                  {feed.summary ? <span> · {feed.summary}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {matches.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
            <h2 className="text-zinc-200 text-sm m-0">Match data from SDAPI</h2>
            <ul className="m-0 pl-0 list-none space-y-1 text-sm text-zinc-400">
              {matches.map((match) => (
                <li key={match.id || `${match.home}-${match.away}-${match.date}`} className="m-0">
                  <span className="text-zinc-300">
                    {match.home ?? "Home"} {match.homeScore ?? "–"}–{match.awayScore ?? "–"}{" "}
                    {match.away ?? "Away"}
                  </span>
                  {match.competition ? (
                    <span className="text-zinc-500"> · {match.competition}</span>
                  ) : null}
                  {match.status ? <span className="text-zinc-500"> · {match.status}</span> : null}
                  {match.date ? <span className="text-zinc-600"> · {match.date}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {squads.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
            <h2 className="text-zinc-200 text-sm m-0">Squads from SDAPI</h2>
            <ul className="m-0 pl-0 list-none space-y-1 text-sm text-zinc-400">
              {squads.map((squad) => (
                <li key={squad.contestantName} className="m-0">
                  <span className="text-zinc-300">{squad.contestantName}</span>
                  <span className="text-zinc-500"> · {squad.playerCount} players</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="cms-card max-w-2xl mt-4 text-sm text-zinc-400">
        <h2 className="text-zinc-200 text-base mt-0">Used by</h2>
        <ul className="m-0 pl-4 space-y-1">
          <li>Documentation login for Rugby Union SDAPI reference</li>
          <li>Match scores via Perform Feeds (`rugbyuniondata/match`)</li>
          <li>Match statistics and events (`matchstats`, `matchevent`)</li>
          <li>Squads by tournament calendar (`rugbyuniondata/squads`)</li>
        </ul>
        <p className="mt-3 mb-0">
          {config?.docsUrl ? (
            <a href={config.docsUrl} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">
              Rugby Union SDAPI docs
            </a>
          ) : null}
          {config?.docsUrl && config?.swaggerUrl ? " · " : null}
          {config?.swaggerUrl ? (
            <a
              href={config.swaggerUrl}
              className="text-emerald-400 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              OpenAPI explorer
            </a>
          ) : null}
        </p>
      </div>
    </>
  );
}
