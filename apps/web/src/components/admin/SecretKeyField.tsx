"use client";

import { useEffect, useState } from "react";

type SecretKeyFieldProps = {
  label: string;
  /** Draft / revealed plaintext (empty when showing mask only). */
  value: string;
  /** Server-side mask preview (bullets + last 4). */
  masked?: string;
  dirty: boolean;
  clear?: boolean;
  onChange: (value: string) => void;
  /** Fill from reveal without marking the field dirty (leave blank to keep on save). */
  onRevealFill?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** PATCH endpoint that accepts `{ action: "reveal" }`. */
  revealUrl?: string;
  /** Extra body for reveal (e.g. `{ field: "serviceRoleKey" }`). */
  revealBody?: Record<string, unknown>;
  /** True when a CMS-stored secret exists and can be revealed. */
  canReveal?: boolean;
  envOverride?: boolean;
  envKeyName?: string;
  onStatus?: (message: string, kind?: "error" | "info") => void;
  className?: string;
};

function looksLikeMask(value: string): boolean {
  return /^•+\s*\S*$/.test(value.trim()) || value.includes("•");
}

function IconEye({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

async function fetchReveal(
  revealUrl: string,
  revealBody?: Record<string, unknown>,
): Promise<{ ok: true; secret: string } | { ok: false; message: string; envOnly?: boolean }> {
  const res = await fetch(revealUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reveal", ...revealBody }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    secret?: string;
    message?: string;
    error?: string;
    envOnly?: boolean;
  };
  if (res.ok && data.ok && typeof data.secret === "string" && data.secret) {
    return { ok: true, secret: data.secret };
  }
  return {
    ok: false,
    envOnly: Boolean(data.envOnly),
    message:
      data.message ??
      data.error ??
      (data.envOnly
        ? "Set via environment variable — reveal from host env, not CMS."
        : "Could not reveal stored key."),
  };
}

export function SecretKeyField({
  label,
  value,
  masked,
  dirty,
  clear = false,
  onChange,
  onRevealFill,
  disabled,
  placeholder,
  revealUrl,
  revealBody,
  canReveal = false,
  envOverride = false,
  envKeyName,
  onStatus,
  className,
}: SecretKeyFieldProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localHint, setLocalHint] = useState("");

  useEffect(() => {
    setVisible(false);
    setLocalHint("");
    setCopied(false);
  }, [masked, clear, envOverride]);

  const displayValue = clear ? "" : dirty ? value : value || masked || "";
  const hasPlaintext = Boolean(value.trim()) && !looksLikeMask(value);
  const needsServerReveal =
    !hasPlaintext && !dirty && Boolean(masked) && canReveal && Boolean(revealUrl);

  function report(message: string, kind: "error" | "info" = "error") {
    setLocalHint(message);
    onStatus?.(message, kind);
  }

  async function ensurePlaintext(): Promise<string | null> {
    if (hasPlaintext) return value.trim();
    if (envOverride) {
      report(
        `Set via environment variable — reveal from host env, not CMS${
          envKeyName ? ` (${envKeyName})` : ""
        }.`,
      );
      return null;
    }
    if (!needsServerReveal || !revealUrl) {
      if (displayValue && !looksLikeMask(displayValue)) return displayValue;
      report("No CMS-stored key available to reveal.");
      return null;
    }
    setBusy(true);
    try {
      const result = await fetchReveal(revealUrl, revealBody);
      if (!result.ok) {
        report(result.message);
        return null;
      }
      if (onRevealFill) onRevealFill(result.secret);
      else onChange(result.secret);
      setLocalHint("Sensitive — admin reveal only. Hide when finished sharing.");
      return result.secret;
    } catch {
      report("Reveal request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility() {
    if (visible) {
      setVisible(false);
      return;
    }
    const plain = await ensurePlaintext();
    if (plain) setVisible(true);
  }

  async function copyKey() {
    const plain = await ensurePlaintext();
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setLocalHint("Copied to clipboard. Treat as sensitive.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      report("Could not copy to clipboard.");
    }
  }

  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase text-zinc-500">
        {label}
        <div className="relative mt-1">
          <input
            type={visible ? "text" : "password"}
            className="cms-input w-full pr-20 font-mono text-sm"
            value={displayValue}
            onChange={(e) => {
              setLocalHint("");
              onChange(e.target.value);
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled || clear}
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            <button
              type="button"
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
              aria-label={visible ? "Hide key" : "Show key"}
              title={visible ? "Hide key" : "Show key"}
              disabled={disabled || clear || busy}
              onClick={() => void toggleVisibility()}
            >
              <IconEye off={visible} />
            </button>
            <button
              type="button"
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
              aria-label={copied ? "Copied" : "Copy key"}
              title={copied ? "Copied" : "Copy key"}
              disabled={disabled || clear || busy}
              onClick={() => void copyKey()}
            >
              <IconCopy />
            </button>
          </div>
        </div>
      </label>
      {envOverride ? (
        <p className="mt-1 mb-0 text-[11px] font-normal normal-case text-amber-400/90">
          Env override active
          {envKeyName ? ` (${envKeyName})` : ""} — reveal from host env, not CMS.
        </p>
      ) : null}
      {localHint ? (
        <p
          className={`mt-1 mb-0 text-[11px] font-normal normal-case ${
            localHint.toLowerCase().includes("sensitive") ||
            localHint.toLowerCase().includes("copied")
              ? "text-amber-300"
              : "text-red-400"
          }`}
        >
          {localHint}
        </p>
      ) : null}
    </div>
  );
}
