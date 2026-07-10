"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HeadToHeadStatsSection } from "@/components/admin/HeadToHeadStatsSection";
import type { HeadToHeadComparison } from "@/lib/head-to-head-shared";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function MatchHeadToHeadPanel({
  fixtureId,
  planetRugbyUrl,
  sport365Url,
  onRefresh,
}: {
  fixtureId: string;
  planetRugbyUrl?: string | null;
  sport365Url?: string | null;
  onRefresh?: () => void | Promise<void>;
}) {
  const [data, setData] = useState<HeadToHeadComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/head-to-head`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load head-to-head");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load head-to-head");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncPlanetRugby() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/enrich-planet-rugby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceEvents: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Planet Rugby enrich failed");
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function syncSport365() {
    if (!sport365Url) return;
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importEvents: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sport365 sync failed");
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 m-0">Loading head-to-head comparison…</p>;
  }

  if (error && !data) {
    return <p className="text-sm text-red-400 m-0">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-zinc-500 m-0">No head-to-head data available.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500 m-0">
            {data.summary.totalMeetings} recorded meetings · {data.summary.homeWins} {data.homeTeam} wins ·{" "}
            {data.summary.draws} draws · {data.summary.awayWins} {data.awayTeam} wins
          </p>
          <p className="text-xs text-zinc-600 m-0 mt-1">
            CMS fixtures: {data.summary.cmsFixtures} · linked {data.summary.linkedToCms} · missing{" "}
            {data.summary.missingFromCms}
            {" · "}SDMS {data.sources.sdmsMeetings} · Sport365 {data.sources.sport365Meetings}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {planetRugbyUrl ? (
            <button type="button" disabled={syncing} className="cms-btn cms-btn--secondary text-xs touch-target" onClick={() => void syncPlanetRugby()}>
              {syncing ? "Syncing…" : "Refresh from Planet Rugby"}
            </button>
          ) : null}
          {sport365Url ? (
            <button type="button" disabled={syncing} className="cms-btn cms-btn--secondary text-xs touch-target" onClick={() => void syncSport365()}>
              {syncing ? "Syncing…" : "Refresh from Sport365"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}

      {data.competitionSlots.length > 0 ? (
        <div>
          <p className="cms-section-title text-sm">Head to head stats</p>
          <HeadToHeadStatsSection
            homeTeam={data.homeTeam}
            awayTeam={data.awayTeam}
            slots={data.competitionSlots}
            dataFromYear={data.dataFromYear}
          />
        </div>
      ) : null}

      <div>
        <p className="cms-section-title text-sm">Meetings vs CMS</p>
        {data.meetings.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No meetings stored yet. Sync from Planet Rugby or add the Sport365 URL.</p>
        ) : (
          <div className="cms-table-scroll">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Result</th>
                  <th>Competition</th>
                  <th>Source</th>
                  <th>CMS</th>
                </tr>
              </thead>
              <tbody>
                {data.meetings.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{formatDate(row.date)}</td>
                    <td>
                      {row.homeTeam}{" "}
                      {row.homeScore != null && row.awayScore != null ? `${row.homeScore}–${row.awayScore}` : "vs"}{" "}
                      {row.awayTeam}
                    </td>
                    <td className="text-zinc-400">{row.competition ?? "—"}</td>
                    <td className="text-zinc-400 uppercase text-xs">{row.source}</td>
                    <td>
                      {row.cmsFixtureId ? (
                        <Link href={`/admin/matches/${row.cmsFixtureId}/edit`} className="text-emerald-400 hover:underline">
                          {row.cmsFixtureSlug ?? "View"}
                        </Link>
                      ) : (
                        <span className="text-amber-400 text-xs">Not in CMS</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
