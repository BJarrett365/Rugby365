"use client";

import type { ReactNode } from "react";
import { SecretKeyField } from "@/components/admin/SecretKeyField";

export type IntegrationKeySource = "environment" | "admin" | "none";

export type IntegrationKeysDocLink = {
  label: string;
  href: string;
};

type IntegrationKeysPanelProps = {
  title: string;
  description: string;
  envKeyName: string;
  envOverrideNote?: string;
  configured: boolean;
  keySource: IntegrationKeySource;
  apiKeyMasked?: string;
  envOverride?: boolean;
  docsLinks: IntegrationKeysDocLink[];
  /** Password field */
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  /** Optional: fill revealed secret without marking dirty */
  onApiKeyRevealFill?: (value: string) => void;
  keyDirty: boolean;
  clearKey: boolean;
  onClearKeyChange: (value: boolean) => void;
  keyPlaceholder: string;
  clearLabel: string;
  /** Reveal stored CMS secret via PATCH { action: "reveal" } */
  revealUrl?: string;
  revealBody?: Record<string, unknown>;
  /** Optional model / setting field */
  modelLabel?: string;
  modelValue?: string;
  onModelChange?: (value: string) => void;
  modelPresets?: string[];
  modelListId?: string;
  modelDisabled?: boolean;
  envModelOverride?: boolean;
  /** Actions */
  loading: boolean;
  saving: boolean;
  testing: boolean;
  onSave: () => void;
  onTest: () => void;
  onReload: () => void;
  message?: string;
  error?: string;
  testMessage?: string;
  lastCheckAt?: string | null;
  lastCheckOk?: boolean | null;
  usedBy?: ReactNode;
  /** Extra content below the model field (e.g. voice options) */
  children?: ReactNode;
  /** Override default "Test {title} connection" label */
  testButtonLabel?: string;
  onRevealStatus?: (message: string, kind?: "error" | "info") => void;
};

function sourceLabel(source: IntegrationKeySource): string {
  if (source === "environment") return "Environment";
  if (source === "admin") return "CMS";
  return "None";
}

export function IntegrationKeysPanel({
  title,
  description,
  envKeyName,
  envOverrideNote,
  configured,
  keySource,
  apiKeyMasked,
  envOverride,
  docsLinks,
  apiKey,
  onApiKeyChange,
  onApiKeyRevealFill,
  keyDirty,
  clearKey,
  onClearKeyChange,
  keyPlaceholder,
  clearLabel,
  revealUrl,
  revealBody,
  modelLabel,
  modelValue,
  onModelChange,
  modelPresets,
  modelListId,
  modelDisabled,
  envModelOverride,
  loading,
  saving,
  testing,
  onSave,
  onTest,
  onReload,
  message,
  error,
  testMessage,
  lastCheckAt,
  lastCheckOk,
  usedBy,
  children,
  testButtonLabel,
  onRevealStatus,
}: IntegrationKeysPanelProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="cms-card space-y-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="m-0 text-sm font-semibold text-zinc-100">Secrets are masked by default</p>
          <p className="mt-1 mb-0 text-xs leading-5 text-zinc-400">
            Use the eye icon to reveal a CMS-stored key for sharing (admin only). Leave a field
            unchanged to keep the existing value, paste a new key to replace it, or tick remove to
            clear. Environment overrides cannot be revealed here — read them from the host env.
          </p>
        </div>

        {envOverride ? (
          <p className="m-0 text-sm text-amber-400 cms-status cms-status--warning">
            Environment override active — using {envKeyName} from .env
            {apiKeyMasked ? ` (${apiKeyMasked})` : ""}.
            {envOverrideNote ? ` ${envOverrideNote}` : ""}
          </p>
        ) : null}

        {loading ? (
          <p className="text-zinc-500 text-sm m-0">Loading…</p>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-sm font-bold text-zinc-100">{title}</p>
                <p className="mt-1 mb-0 text-xs text-zinc-500">{description}</p>
                <p className="mt-1 mb-0 text-[11px] text-zinc-500">
                  Source: {sourceLabel(keySource)}
                  {envOverride ? " · env override" : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${
                  configured
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-700 bg-zinc-900/40 text-zinc-500"
                }`}
              >
                {configured ? "Key on file" : "Not set"}
              </span>
            </div>

            <SecretKeyField
              label={envKeyName}
              value={apiKey}
              masked={apiKeyMasked}
              dirty={keyDirty}
              clear={clearKey}
              onChange={onApiKeyChange}
              onRevealFill={onApiKeyRevealFill}
              placeholder={keyPlaceholder}
              disabled={Boolean(envOverride) || clearKey}
              revealUrl={revealUrl}
              revealBody={revealBody}
              canReveal={keySource === "admin" && configured && !envOverride}
              envOverride={Boolean(envOverride)}
              envKeyName={envKeyName}
              onStatus={onRevealStatus}
            />

            {keySource === "admin" || clearKey ? (
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(e) => onClearKeyChange(e.target.checked)}
                  disabled={Boolean(envOverride)}
                />
                {clearLabel}
              </label>
            ) : null}

            {modelLabel && onModelChange != null && modelValue != null ? (
              <label className="block text-xs font-semibold uppercase text-zinc-500">
                {modelLabel}
                <input
                  className="cms-input mt-1 w-full"
                  value={modelValue}
                  onChange={(e) => onModelChange(e.target.value)}
                  list={modelListId}
                  disabled={Boolean(modelDisabled || envModelOverride)}
                />
                {modelListId && modelPresets?.length ? (
                  <datalist id={modelListId}>
                    {modelPresets.map((preset) => (
                      <option key={preset} value={preset} />
                    ))}
                  </datalist>
                ) : null}
                {envModelOverride ? (
                  <span className="mt-1 block text-[11px] font-normal normal-case text-amber-400/90">
                    Model overridden by environment variable.
                  </span>
                ) : null}
              </label>
            ) : null}

            {children}

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <p className="m-0 text-[11px] text-zinc-400">
                Manage keys in the provider dashboard, then test connection here before saving.
              </p>
              <div className="flex flex-wrap gap-3">
                {docsLinks.map((link) => (
                  <a
                    key={link.href}
                    className="inline-flex text-[11px] font-semibold text-emerald-400 hover:underline"
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {link.label} →
                  </a>
                ))}
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  disabled={testing || (!configured && !apiKey.trim())}
                  onClick={onTest}
                >
                  {testing
                    ? `Testing ${title}…`
                    : testButtonLabel ?? `Test ${title} connection`}
                </button>
              </div>
              {testMessage ? (
                <p className="m-0 text-xs text-emerald-400">{testMessage}</p>
              ) : null}
              {lastCheckAt ? (
                <p
                  className={`m-0 text-[11px] ${
                    lastCheckOk ? "text-emerald-400" : "text-amber-300"
                  }`}
                >
                  Last {title} check: {lastCheckOk ? "PASS" : "FAIL"} at{" "}
                  {new Date(lastCheckAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={saving || loading}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={saving || loading}
            onClick={onReload}
          >
            Reload
          </button>
        </div>

        {message ? <p className="m-0 text-sm text-emerald-400">{message}</p> : null}
        {error ? <p className="m-0 text-sm text-red-400">{error}</p> : null}
      </div>

      {usedBy ? (
        <div className="cms-card text-sm text-zinc-400">{usedBy}</div>
      ) : null}
    </div>
  );
}
