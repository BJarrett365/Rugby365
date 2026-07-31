"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TeamComparison } from "@/components/teams/TeamComparison";
import type { TeamComparePayload } from "@/lib/team-compare-types";

export function CompareTeamsResult({ slugA, slugB }: { slugA: string; slugB: string }) {
  const [data, setData] = useState<TeamComparePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [slugA, slugB]);

  if (!slugA || !slugB || slugA === slugB) return null;

  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold text-[var(--pr-mc-text)]">Head-to-head</h2>
        <Link
          href={`/teams/${encodeURIComponent(slugA)}/compare/${encodeURIComponent(slugB)}`}
          className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline"
        >
          Open full page
        </Link>
      </div>
      {loading ? (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">Loading comparison…</p>
      ) : null}
      {error ? <p className="m-0 text-sm text-red-300">{error}</p> : null}
      {data ? <TeamComparison data={data} /> : null}
    </section>
  );
}
