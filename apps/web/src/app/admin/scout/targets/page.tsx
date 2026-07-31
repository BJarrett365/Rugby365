"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { recommendationLabel } from "@/lib/player-scout-intelligence-math";
import type { ScoutRecommendation } from "@/lib/player-scout-intelligence-math";

type Target = {
  playerId: string;
  rriScore: number;
  rriBand: string;
  rriGrade: string;
  recommendation: string;
  name: string;
  slug: string;
  positionName: string | null;
  imageUrl: string | null;
};

export default function AdminScoutTargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/scout?limit=50", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setTargets(data.targets ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Scout"
        title="Recruitment targets"
        description="Players ranked by RRI — an enhancement on Scouting profiles. Recalculate from each player’s Recruitment Index panel."
      />
      {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!loading && !targets.length ? (
        <p className="text-sm text-zinc-500 cms-card">
          No scout profiles yet. Open a player in CMS and click <strong>Recalculate RRI</strong>.
        </p>
      ) : null}
      {targets.length > 0 ? (
        <div className="cms-card overflow-x-auto">
          <table className="cms-table w-full text-sm">
            <thead>
              <tr>
                <th>RRI</th>
                <th>Player</th>
                <th>Position</th>
                <th>Band</th>
                <th>Recommendation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.playerId}>
                  <td>
                    <strong>{t.rriScore}</strong>{" "}
                    <span className="text-zinc-500">{t.rriGrade}</span>
                  </td>
                  <td>{t.name}</td>
                  <td>{t.positionName ?? "—"}</td>
                  <td>{t.rriBand}</td>
                  <td>
                    {recommendationLabel(t.recommendation as ScoutRecommendation)}
                  </td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <Link href={`/admin/players/${t.playerId}/edit`} className="text-emerald-400">
                      CMS
                    </Link>
                    <Link href={`/players/${t.slug}/scouting`} className="text-emerald-400">
                      Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
