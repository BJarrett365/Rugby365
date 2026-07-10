"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type SquadRow = {
  fixtureId: string;
  slug: string;
  homeTeam: string | null;
  awayTeam: string | null;
  kickoffAt: string | null;
  status: string;
  squadCount: number;
};

function formatKickoff(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function SquadsAdminPage() {
  const [squads, setSquads] = useState<SquadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/squads");
    const data = await res.json();
    setSquads(data.squads ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Squads"
        description="Per-match squads mapped from Sport365 lineups. Sync a match first, then open its squad."
      />
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : squads.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No matches yet.</p>
          <Link href="/admin/matches" className="text-emerald-400 text-sm mt-2 inline-block">
            Go to matches
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {squads.map((s) => {
            const label = `${s.homeTeam ?? "Home"} vs ${s.awayTeam ?? "Away"}`;
            return (
              <article key={s.fixtureId} className="cms-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-lg m-0">{label}</h2>
                    <p className="text-sm text-zinc-500 m-0 mt-1">
                      {formatKickoff(s.kickoffAt)} · {s.status}
                    </p>
                    <p className="text-xs text-zinc-600 m-0 mt-1">
                      {s.squadCount} players stored · {s.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/squads/${s.fixtureId}`}
                      className="cms-btn cms-btn--secondary text-xs"
                    >
                      {s.squadCount > 0 ? "View squad" : "Set up squad"}
                    </Link>
                    <Link
                      href={`/admin/matches/${s.fixtureId}/edit`}
                      className="cms-btn cms-btn--secondary text-xs"
                    >
                      Match
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
