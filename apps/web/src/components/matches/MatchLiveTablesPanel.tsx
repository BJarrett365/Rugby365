"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CompetitionLiveTable } from "@/components/competitions/CompetitionLiveTable";
import type { MatchTableContext } from "@/lib/match-table-context";
import type { RugbyTableResult } from "@/lib/table-lab/table-types";

const LIVE_POLL_MS = 15_000;

async function fetchLiveTable(tableContext: MatchTableContext): Promise<RugbyTableResult> {
  const endpoint = tableContext.competitionSlug
    ? `/api/competitions/by-slug/${encodeURIComponent(tableContext.competitionSlug)}/live-table`
    : null;

  if (endpoint) {
    const url = new URL(endpoint, window.location.origin);
    if (tableContext.externalMatchId) {
      url.searchParams.set("syncMatchId", tableContext.externalMatchId);
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json()) as { result?: RugbyTableResult; error?: string };
    if (!res.ok || !data.result) throw new Error(data.error || "Failed to load live table");
    return data.result;
  }

  const res = await fetch("/api/admin/tables/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tableId: "live_table",
      context: {
        competitionId: tableContext.competitionId,
        seasonId: tableContext.seasonId,
        includeLiveMatches: true,
        showMovement: true,
      },
    }),
  });
  const data = (await res.json()) as RugbyTableResult & { error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to load live table");
  return data;
}

export function MatchLiveTablesPanel({ tableContext }: { tableContext: MatchTableContext | null }) {
  const [result, setResult] = useState<RugbyTableResult | null>(null);
  const [loading, setLoading] = useState(Boolean(tableContext?.competitionId && tableContext.seasonId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableContext?.competitionId || !tableContext.seasonId) {
      setLoading(false);
      setResult(null);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const load = (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      return fetchLiveTable(tableContext)
        .then((data) => {
          if (!cancelled) setResult(data);
        })
        .catch((err: unknown) => {
          if (!cancelled && !opts?.silent) {
            setError(err instanceof Error ? err.message : "Failed to load live table");
            setResult(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    void load();

    if (tableContext.isLive) {
      intervalId = setInterval(() => {
        void load({ silent: true });
      }, LIVE_POLL_MS);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    tableContext?.competitionId,
    tableContext?.seasonId,
    tableContext?.competitionSlug,
    tableContext?.externalMatchId,
    tableContext?.isLive,
  ]);

  if (!tableContext?.competitionId) {
    return (
      <p className="match-detail-empty">
        Competition table is not available for this match yet.
      </p>
    );
  }

  const publicTableHref = tableContext.competitionSlug
    ? `/competitions/${tableContext.competitionSlug}/table`
    : null;
  const publicTableLabel = /international/i.test(tableContext.competitionName)
    ? "International Tables"
    : `${tableContext.competitionName} Tables`;

  return (
    <section className="pr-mc-card pr-live-tables">
      <div className="pr-live-tables__header">
        <h2 className="pr-mc-card__title">
          {tableContext.competitionName} · Live Table
        </h2>
        <div className="pr-live-tables__links">
          {publicTableHref ? (
            <Link href={publicTableHref} className="pr-live-tables__link">
              {publicTableLabel}
            </Link>
          ) : null}
        </div>
      </div>

      {loading ? <p className="match-detail-empty">Loading live table…</p> : null}
      {error ? <p className="match-detail-empty">{error}</p> : null}

      {!loading && !error && result ? (
        result.rows.length === 0 ? (
          <p className="match-detail-empty">
            {result.warnings?.[0] ?? "No live table rows for this competition season yet."}
          </p>
        ) : (
          <CompetitionLiveTable
            rows={result.rows}
            hemisphereGroups={result.hemisphereGroups}
            showMovement={result.showMovement !== false}
            liveMatchCount={result.liveMatchCount}
            note={result.liveTableCalculationNote ?? result.filterSummary}
          />
        )
      ) : null}
    </section>
  );
}
