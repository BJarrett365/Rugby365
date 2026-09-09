"use client";

import { useEffect, useState } from "react";
import { TeamCompareH2HBoard } from "@/components/teams/TeamCompareH2HBoard";
import type { TeamComparePayload } from "@/lib/team-compare-types";

export function CompareTeamsResult({
  slugA,
  slugB,
  autoLoad = true,
}: {
  slugA: string;
  slugB: string;
  /** When false, parent controls when to mount this (after Compare click). */
  autoLoad?: boolean;
}) {
  const [data, setData] = useState<TeamComparePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLoad) return;
    const a = slugA.trim();
    const b = slugB.trim();
    if (!a || !b || a === b) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/teams/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as TeamComparePayload & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load comparison");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Failed to load comparison");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slugA, slugB, autoLoad]);

  if (!slugA || !slugB || slugA === slugB) return null;

  return (
    <section className="pr-h2h-page" aria-live="polite">
      {loading ? (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">Loading comparison…</p>
      ) : null}
      {error ? <p className="m-0 text-sm text-red-300">{error}</p> : null}
      {data ? <TeamCompareH2HBoard data={data} /> : null}
    </section>
  );
}
