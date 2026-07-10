"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type SeasonRow = {
  id: string;
  label: string;
  year: number;
  competitionId: string;
  isActive: boolean;
};

export default function TableLabSeasonsPage() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tables/seasons")
      .then((r) => r.json())
      .then((data) => {
        setSeasons(data.seasons ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Table Lab"
        title="Seasons"
        description="Competition seasons available as scope for Table Lab calculations. Sync standings and fixtures from Planet Rugby / SDMS first."
        actions={
          <Link href="/admin/competitions" className="cms-btn cms-btn--secondary">
            Competitions
          </Link>
        }
      />

      {loading ? (
        <p className="text-sm text-zinc-500">Loading seasons…</p>
      ) : seasons.length === 0 ? (
        <div className="cms-card">
          <p className="text-sm text-zinc-500 m-0">No seasons imported yet.</p>
        </div>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Season</th>
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3">Competition</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => (
                <tr key={season.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    {season.label}
                    {season.isActive ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-400">
                        Active
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">{season.year}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{season.competitionId}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/tables/view?competitionId=${season.competitionId}&seasonId=${season.id}`}
                      className="text-emerald-400 text-xs"
                    >
                      View tables
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
