"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Phase-3 / V2 CMS workflow actions for a player profile.
 * Buttons call existing admin APIs where available; otherwise surface guidance.
 */
export function PlayerCmsWorkflowPanel({
  playerId,
  slug,
}: {
  playerId: string;
  slug: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(label: string, path: string, method: "POST" | "GET" = "POST") {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch(path, { method });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setMessage(data.error ?? `${label} failed (${res.status})`);
      } else {
        setMessage(`${label} completed`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cms-card mb-4">
      <h3 className="font-semibold m-0 mb-2">Player Profile V2 — workflow</h3>
      <p className="text-sm text-zinc-500 mt-0 mb-3">
        Recalculate derived intelligence/value, run OpenAI profile check, and preview the public V2
        overview. Sourced facts never auto-publish.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={busy != null}
          onClick={() => void run("OpenAI check", `/api/admin/players/${playerId}/openai-profile-check`)}
        >
          {busy === "OpenAI check" ? "Checking…" : "Check player with OpenAI"}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={busy != null}
          onClick={() => void run("Recalculate value", `/api/admin/players/${playerId}/value`)}
        >
          {busy === "Recalculate value" ? "Recalculating…" : "Recalculate value"}
        </button>
        {slug ? (
          <Link
            href={`/players/${slug}?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="cms-btn cms-btn--secondary"
          >
            Preview public profile
          </Link>
        ) : null}
        <Link href={`/admin/data-backfill`} className="cms-btn cms-btn--secondary">
          Data backfill
        </Link>
      </div>
      {message ? <p className="text-sm text-zinc-400 mt-3 mb-0">{message}</p> : null}
    </div>
  );
}
