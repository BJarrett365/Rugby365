"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MatchStatsPanel } from "@/components/admin/MatchStatsPanel";
import { MatchDataPanel } from "@/components/admin/MatchDataPanel";
import { MatchHeadToHeadPanel } from "@/components/admin/MatchHeadToHeadPanel";
import { MatchForm, toDatetimeLocal } from "@/components/admin/MatchForm";
import { PageHeader } from "@/components/shell/PageHeader";

type MatchDetail = {
  fixture: Parameters<typeof MatchDataPanel>[0]["fixture"] & {
    id: string;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    planetRugbyUrl?: string | null;
    sport365Url?: string | null;
    venueId?: string | null;
    attendance?: number | null;
    refereeId?: string | null;
    homeCoachId?: string | null;
    awayCoachId?: string | null;
    round?: string | null;
  };
  events: Parameters<typeof MatchDataPanel>[0]["events"];
  eventCount: number;
};

function fixtureToFormInitial(fixture: MatchDetail["fixture"]) {
  return {
    slug: fixture.slug,
    homeTeamId: fixture.homeTeamId ?? "",
    awayTeamId: fixture.awayTeamId ?? "",
    competitionName: fixture.competitionName ?? "",
    kickoffAt: toDatetimeLocal(fixture.kickoffAt),
    status: fixture.status,
    sport365Url: fixture.sport365Url ?? "",
    planetRugbyUrl: fixture.planetRugbyUrl ?? "",
    venueId: fixture.venueId ?? "",
    attendance: fixture.attendance != null ? String(fixture.attendance) : "",
    refereeId: fixture.refereeId ?? "",
    homeCoachId: fixture.homeCoachId ?? "",
    awayCoachId: fixture.awayCoachId ?? "",
    round: fixture.round ?? "",
  };
}

function applyDetail(data: MatchDetail, setDetail: (d: MatchDetail) => void, setInitial: (i: ReturnType<typeof fixtureToFormInitial>) => void) {
  setDetail(data);
  setInitial(fixtureToFormInitial(data.fixture));
}

export function MatchEditClient({ id }: { id: string }) {
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [initial, setInitial] = useState<Parameters<typeof MatchForm>[0]["initial"]>();
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const reloadDetail = useCallback(async () => {
    const res = await fetch(`/api/admin/matches/${id}`);
    const data = await res.json();
    if (!res.ok || !data.fixture) throw new Error(data.error ?? "Match not found");
    applyDetail(data, setDetail, setInitial);
  }, [id]);

  const syncFromSport365 = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/matches/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importEvents: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      if (data.detail) {
        applyDetail(data.detail, setDetail, setInitial);
      } else {
        const reload = await fetch(`/api/admin/matches/${id}`);
        const reloaded = await reload.json();
        if (!reload.ok || !reloaded.fixture) throw new Error(reloaded.error ?? "Reload failed");
        applyDetail(reloaded, setDetail, setInitial);
      }
    } finally {
      setSyncing(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setError("");
      try {
        const res = await fetch(`/api/admin/matches/${id}`);
        const data = await res.json();
        if (!res.ok || !data.fixture) throw new Error(data.error ?? "Match not found");
        if (cancelled) return;
        applyDetail(data, setDetail, setInitial);

        if (data.fixture.sport365Url) {
          setSyncing(true);
          try {
            const syncRes = await fetch(`/api/admin/matches/${id}/sync`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ importEvents: true }),
            });
            const syncData = await syncRes.json();
            if (!syncRes.ok) throw new Error(syncData.error ?? "Sync failed");
            if (cancelled) return;
            if (syncData.detail) {
              applyDetail(syncData.detail, setDetail, setInitial);
            }
          } finally {
            if (!cancelled) setSyncing(false);
          }
        } else if (data.fixture.planetRugbyUrl && data.fixture.externalMatchId && !data.fixture.venueId) {
          setSyncing(true);
          try {
            const enrichRes = await fetch(`/api/admin/matches/${id}/enrich-planet-rugby`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ replaceEvents: false }),
            });
            const enrichData = await enrichRes.json();
            if (!enrichRes.ok) throw new Error(enrichData.error ?? "Planet Rugby enrich failed");
            if (cancelled) return;
            if (enrichData.detail) {
              applyDetail(enrichData.detail, setDetail, setInitial);
            }
          } finally {
            if (!cancelled) setSyncing(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load match");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <p className="text-red-400">
        {error}.{" "}
        <Link href="/admin/matches" className="underline">
          Back to matches
        </Link>
      </p>
    );
  }

  if (!detail || !initial) {
    return <p className="text-zinc-500 text-sm">Loading match data from Sport365…</p>;
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Edit match"
        description="Fixture details, Sport365 sync, and stored incidents."
      />
      <div className="space-y-6 max-w-4xl">
        <MatchDataPanel fixture={{ ...detail.fixture, id: detail.fixture.id }} events={detail.events} syncing={syncing} />
        <div className="cms-card">
          <h3 className="cms-section-title">Match statistics</h3>
          <MatchStatsPanel fixtureId={id} />
        </div>
        <div className="cms-card">
          <h3 className="cms-section-title">Head to head stats</h3>
          <MatchHeadToHeadPanel
            fixtureId={id}
            planetRugbyUrl={detail.fixture.planetRugbyUrl}
            sport365Url={detail.fixture.sport365Url}
            onRefresh={reloadDetail}
          />
        </div>
        <MatchForm
          fixtureId={id}
          initial={initial}
          submitLabel="Save changes"
          onSynced={reloadDetail}
        />
      </div>
      <p className="text-sm text-zinc-600 mt-4">
        <Link href="/admin/matches" className="text-zinc-400 hover:text-zinc-200">
          ← Back to matches
        </Link>
      </p>
    </>
  );
}
