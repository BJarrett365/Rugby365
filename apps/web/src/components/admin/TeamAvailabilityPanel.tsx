"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { injuryStatusLabel, suspensionStatusLabel } from "@/lib/availability-types";
import type { InjuryRow } from "@/lib/injury-admin-service";
import type { SuspensionRow } from "@/lib/suspension-admin-service";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

type TeamSummary = {
  currentInjuries: InjuryRow[];
  currentSuspensions: SuspensionRow[];
  expectedReturns: InjuryRow[];
  recentlyReturned: InjuryRow[];
};

export function TeamAvailabilityPanel({ teamId }: { teamId: string }) {
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/availability/summary?teamId=${teamId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (!cancelled) setSummary(data.team ?? null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return (
    <div className="cms-card mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold m-0">Team availability</h3>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Current injuries, suspensions and expected returns from public sources.
          </p>
        </div>
        <Link href="/admin/availability/injuries" className="text-xs text-emerald-400">
          Availability admin
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 m-0">Loading team availability…</p>
      ) : !summary ? (
        <p className="text-sm text-zinc-500 m-0">No availability records for this team.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <h4 className="font-medium m-0 mb-2">Current injuries ({summary.currentInjuries.length})</h4>
            {summary.currentInjuries.length === 0 ? (
              <p className="text-zinc-500 m-0">None</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-1">
                {summary.currentInjuries.map((row) => (
                  <li key={row.id}>
                    <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                      {row.playerName}
                    </Link>
                    {" — "}
                    {injuryStatusLabel(row.status)}
                    {row.injuryType ? ` (${row.injuryType})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="font-medium m-0 mb-2">
              Suspended players ({summary.currentSuspensions.length})
            </h4>
            {summary.currentSuspensions.length === 0 ? (
              <p className="text-zinc-500 m-0">None</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-1">
                {summary.currentSuspensions.map((row) => (
                  <li key={row.id}>
                    <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                      {row.playerName}
                    </Link>
                    {" — "}
                    {suspensionStatusLabel(row.status)}
                    {row.suspensionEnd ? ` · back ${formatDate(row.suspensionEnd)}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="font-medium m-0 mb-2">Expected returns</h4>
            {summary.expectedReturns.length === 0 ? (
              <p className="text-zinc-500 m-0">None scheduled</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-1">
                {summary.expectedReturns.slice(0, 8).map((row) => (
                  <li key={row.id}>
                    {row.playerName} — {formatDate(row.expectedReturnDate)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="font-medium m-0 mb-2">Players unavailable</h4>
            {summary.currentInjuries.length + summary.currentSuspensions.length === 0 ? (
              <p className="text-zinc-500 m-0">Full squad available</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-1">
                {[...summary.currentInjuries, ...summary.currentSuspensions].slice(0, 8).map((row) => (
                  <li key={row.id}>{row.playerName}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
