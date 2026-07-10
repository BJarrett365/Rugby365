"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Config = {
  username?: string;
  hasPassword: boolean;
  hasRefreshToken: boolean;
  accessTokenExpiresAt?: string;
  configured: boolean;
  docsUrl?: string;
  readOnly?: boolean;
};

export default function WikimediaIntegrationPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/wikimedia");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
      setUsername(data.username ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function saveCredentials() {
    setSaving(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/wikimedia", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password: password || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
    } else {
      setMessage("Credentials saved. Use Test connection before importing archive data.");
      setPassword("");
      setConfig(data);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/wikimedia", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Connection test failed");
    } else {
      setMessage(data.message ?? "Connected.");
      await load();
    }
    setTesting(false);
  }

  async function clearCredentials() {
    if (!confirm("Remove stored Wikimedia Enterprise credentials?")) return;
    const res = await fetch("/api/admin/integrations/wikimedia", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    if (res.ok) {
      setPassword("");
      setUsername("");
      setMessage("Credentials cleared.");
      await load();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Wikimedia Enterprise"
        description="Read-only Wikipedia archive access for players, teams and competitions. Live match data stays on Planet Rugby / Sport365."
        actions={
          <Link href="/admin/wikipedia/import" className="cms-btn cms-btn--primary touch-target">
            Wikipedia import
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Sign in with your{" "}
          <a
            href="https://enterprise.wikimedia.com/docs/authentication/#login"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400"
          >
            Wikimedia Enterprise
          </a>{" "}
          username (lowercase) and password. Rugby365 only uses these credentials for read-only article
          lookups — no edits are made to Wikipedia.
        </p>

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-zinc-400">Username</span>
              <input
                className="cms-input mt-1 w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="your-enterprise-username"
              />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">
                Password {config?.hasPassword ? "(saved — leave blank to keep)" : ""}
              </span>
              <input
                type="password"
                className="cms-input mt-1 w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={config?.hasPassword ? "••••••••" : "Enterprise account password"}
              />
            </label>

            {config?.accessTokenExpiresAt ? (
              <p className="text-xs text-zinc-500 m-0">
                Access token expires: {new Date(config.accessTokenExpiresAt).toLocaleString()}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={saving || !username.trim()}
                onClick={saveCredentials}
              >
                {saving ? "Saving…" : "Save credentials"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={testing || !config?.configured}
                onClick={testConnection}
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
              {config?.configured ? (
                <button type="button" className="cms-btn cms-btn--secondary" onClick={clearCredentials}>
                  Clear
                </button>
              ) : null}
            </div>
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>

      <div className="cms-card max-w-2xl mt-4 text-sm text-zinc-400">
        <h2 className="text-zinc-200 text-base mt-0">Without credentials</h2>
        <p className="m-0">
          Preview still works via the public Wikipedia REST API (rate-limited). For production archive
          imports, connect Wikimedia Enterprise so article HTML comes from the On-demand API.
        </p>
      </div>
    </>
  );
}
