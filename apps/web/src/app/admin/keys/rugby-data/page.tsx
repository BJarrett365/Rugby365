"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  RUGBY_DATA_API_ENDPOINTS,
  buildRugbyDataApiProxyUrl,
} from "@/lib/rugby-data-api-endpoints";

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
  const [syncing, setSyncing] = useState(false);
  const [bulkRunning, setBulkRunning] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [syncDate, setSyncDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    fetch("/api/admin/integrations/rugby-data?view=jobs")
      .then((res) => res.json())
      .then((data) => setJobs(data.jobs ?? []))
      .catch(() => null);
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

  async function syncDay() {
    setSyncing(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/rugby-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-day", date: syncDate, syncEvents: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? "Day sync failed");
    } else {
      setMessage(
        `Synced ${data.dateKey}: ${data.matched}/${data.listed} matched, ${data.scoresUpdated} scores, ${data.statusesUpdated} statuses, ${data.eventsImported} events` +
          (data.unmatched ? `, ${data.unmatched} unmatched` : "") +
          (data.errors?.length ? ` (${data.errors.length} errors)` : ""),
      );
    }
    setSyncing(false);
  }

  async function runBulkAction(action: "discover" | "import-all" | "enrich-matches") {
    setBulkRunning(action);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/rugby-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? `${action} failed`);
    } else {
      setMessage(
        action === "discover"
          ? `Discovered ${data.leagues?.length ?? 0} leagues (job ${data.jobId}).`
          : action === "import-all"
            ? `Import job ${data.jobId}: ${data.fixturesCreated ?? 0} fixtures created, ${data.fixturesUpdated ?? 0} updated across ${data.leaguesProcessed ?? 0} leagues.`
            : `Enrich job ${data.jobId}: ${data.enriched ?? 0}/${data.processed ?? 0} matches enriched.`,
      );
      const jobsRes = await fetch("/api/admin/integrations/rugby-data?view=jobs");
      const jobsData = await jobsRes.json();
      setJobs(jobsData.jobs ?? []);
    }
    setBulkRunning(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="Rugby Data API"
        description="Primary provider for competitions, teams, matches, scores, lineups, stats and tables."
        actions={
          <div className="flex gap-2">
            <Link
              href="/admin/data-sources/rugby-data/mappings"
              className="cms-btn cms-btn--secondary touch-target"
            >
              Mappings
            </Link>
            <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
              Admin dashboard
            </Link>
          </div>
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

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              <h2 className="text-zinc-200 text-sm m-0">Bulk ingestion</h2>
              <p className="text-xs text-zinc-500 m-0">
                Discover all leagues, import competitions/teams/fixtures/standings, then enrich finished
                matches with lineups, stats and events. Jobs are tracked in{" "}
                <code className="text-zinc-500">data_integration_jobs</code>.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={bulkRunning != null || !config?.configured}
                  onClick={() => runBulkAction("discover")}
                >
                  {bulkRunning === "discover" ? "Discovering…" : "Discover leagues"}
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={bulkRunning != null || !config?.configured}
                  onClick={() => runBulkAction("import-all")}
                >
                  {bulkRunning === "import-all" ? "Importing…" : "Import all leagues"}
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={bulkRunning != null || !config?.configured}
                  onClick={() => runBulkAction("enrich-matches")}
                >
                  {bulkRunning === "enrich-matches" ? "Enriching…" : "Enrich finished matches"}
                </button>
              </div>
              {jobs.length > 0 ? (
                <div className="text-xs text-zinc-500 space-y-1">
                  <p className="m-0 text-zinc-400">Recent jobs</p>
                  {jobs.slice(0, 5).map((job) => (
                    <p key={String(job.id)} className="m-0 font-mono">
                      {String(job.jobType)} · {String(job.status)} · found {String(job.recordsFound)} ·
                      created {String(job.recordsCreated)} · updated {String(job.recordsUpdated)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              <h2 className="text-zinc-200 text-sm m-0">Day sync (scores + events)</h2>
              <p className="text-xs text-zinc-500 m-0">
                Pulls the Rugby Data daily match list and updates CMS scores/status. Events import when
                the fixture has no SDMS timeline. Also runs automatically when the public fixtures
                schedule for that date is loaded.
              </p>
              <label className="block text-sm">
                <span className="text-zinc-400">Date</span>
                <input
                  type="date"
                  className="cms-input mt-1 w-full font-mono text-sm"
                  value={syncDate}
                  onChange={(e) => setSyncDate(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={syncing || !syncDate}
                onClick={syncDay}
              >
                {syncing ? "Syncing…" : "Sync day from Rugby Data"}
              </button>
            </div>
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>

      <div className="cms-card max-w-2xl mt-4 text-sm text-zinc-400">
        <h2 className="text-zinc-200 text-base mt-0">Rugby Union API catalog</h2>
        <p className="m-0 mb-3">
          Postman collection:{" "}
          <code className="text-zinc-500">docs/rugby-data-api/Rugby.Union.Apis.postman_collection.json</code>
          . Set base URL to <code className="text-zinc-500">http://localhost:8080</code> to hit these routes
          locally.
        </p>
        <div className="space-y-4">
          {Array.from(new Set(RUGBY_DATA_API_ENDPOINTS.map((endpoint) => endpoint.group))).map(
            (group) => (
              <div key={group}>
                <h3 className="text-zinc-300 text-sm m-0 mb-2">{group}</h3>
                <ul className="m-0 pl-4 space-y-1">
                  {RUGBY_DATA_API_ENDPOINTS.filter((endpoint) => endpoint.group === group).map(
                    (endpoint) => (
                      <li key={endpoint.id}>
                        <span className="text-zinc-500">{endpoint.method}</span>{" "}
                        <Link
                          href={buildRugbyDataApiProxyUrl(
                            endpoint.samplePath,
                            endpoint.sampleQuery,
                          )}
                          className="text-emerald-400 hover:underline font-mono text-xs"
                        >
                          {endpoint.samplePath}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="cms-card max-w-2xl mt-4 text-sm text-zinc-400">
        <h2 className="text-zinc-200 text-base mt-0">Used by</h2>
        <ul className="m-0 pl-4 space-y-1">
          <li>Primary source for competitions, teams and fixtures</li>
          <li>Day sync for match scores/status (and events when SDMS timeline is empty)</li>
          <li>Match scores, lineups, player/team stats and tables</li>
          <li>Mapping review (P1 over SDMS / Sport365)</li>
        </ul>
      </div>
    </>
  );
}
