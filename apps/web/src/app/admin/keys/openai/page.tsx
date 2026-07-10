"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Config = {
  hasApiKey: boolean;
  apiKeyMasked?: string;
  model: string;
  configured: boolean;
  keySource: "environment" | "admin" | "none";
  docsUrl?: string;
  envOverride?: boolean;
  envModelOverride?: boolean;
};

const MODEL_PRESETS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

export default function OpenAiKeysPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/openai");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
      setModel(data.model ?? "gpt-4o-mini");
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
    const res = await fetch("/api/admin/integrations/openai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey || undefined,
        model,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? "Save failed");
    } else {
      setMessage("OpenAI settings saved.");
      setApiKey("");
      setConfig(data);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/openai", {
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

  async function clearKey() {
    if (!confirm("Remove the stored OpenAI API key from the CMS?")) return;
    const res = await fetch("/api/admin/integrations/openai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    const data = await res.json();
    if (res.ok) {
      setApiKey("");
      setMessage("Stored API key cleared.");
      setConfig(data);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="OpenAI"
        description="API key and default model for player bios, AI enrichment, verification and prematch commentary drafts."
        actions={
          <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
            Admin dashboard
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Create a secret key in the{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
            OpenAI dashboard
          </a>
          . Values saved here are stored in the Rugby365 database.{" "}
          <code className="text-zinc-500">OPENAI_API_KEY</code> and{" "}
          <code className="text-zinc-500">OPENAI_MODEL</code> in{" "}
          <code className="text-zinc-500">.env</code> still override CMS settings when set.
        </p>

        {config?.envOverride ? (
          <p className="text-sm text-amber-400 m-0 cms-status cms-status--warning">
            Environment override active — using OPENAI_API_KEY from .env
            {config.apiKeyMasked ? ` (${config.apiKeyMasked})` : ""}.
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
              {config?.apiKeyMasked ? (
                <p className="m-0 text-zinc-500">Key: {config.apiKeyMasked}</p>
              ) : null}
              <p className="m-0 text-zinc-500">
                Source: {config?.keySource === "environment" ? "Environment" : config?.keySource === "admin" ? "CMS" : "None"}
              </p>
              <p className="m-0 text-zinc-500">
                Model: {config?.model}
                {config?.envModelOverride ? " (from .env)" : ""}
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-zinc-400">
                API key {config?.hasApiKey && config.keySource === "admin" ? "(saved — leave blank to keep)" : ""}
              </span>
              <input
                type="password"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder={config?.hasApiKey ? "sk-…" : "sk-proj-…"}
                disabled={Boolean(config?.envOverride)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">Default model</span>
              <input
                className="cms-input mt-1 w-full"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                list="openai-model-presets"
                placeholder="gpt-4o-mini"
                disabled={Boolean(config?.envModelOverride)}
              />
              <datalist id="openai-model-presets">
                {MODEL_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={saving || Boolean(config?.envOverride)}
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
              {config?.keySource === "admin" ? (
                <button type="button" className="cms-btn cms-btn--secondary" onClick={clearKey}>
                  Clear key
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
          <li>Player, coach and referee bio suggestions</li>
          <li>AI enrichment and verification panels</li>
          <li>Prematch commentary draft generation</li>
        </ul>
      </div>
    </>
  );
}
