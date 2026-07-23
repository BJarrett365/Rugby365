"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MatchDataPanel } from "@/components/admin/MatchDataPanel";
import { MatchHeadToHeadPanel } from "@/components/admin/MatchHeadToHeadPanel";
import { MatchSourcesPanel } from "@/components/admin/MatchSourcesPanel";
import { MatchLineupsEditor } from "@/components/admin/MatchLineupsEditor";
import { MatchTeamStatsEditor } from "@/components/admin/MatchTeamStatsEditor";
import { MatchPlayerStatsEditor } from "@/components/admin/MatchPlayerStatsEditor";
import { MatchEventsEditor } from "@/components/admin/MatchEventsEditor";
import { MatchForm, toDatetimeLocal } from "@/components/admin/MatchForm";
import { MatchIssuesPanel } from "@/components/admin/MatchIssuesPanel";
import { PageHeader } from "@/components/shell/PageHeader";

type MatchDetail = {
  fixture: Parameters<typeof MatchDataPanel>[0]["fixture"] & {
    id: string;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    competitionId?: string | null;
    seasonId?: string | null;
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
    competitionId: fixture.competitionId ?? "",
    competitionName: fixture.competitionName ?? "",
    seasonId: fixture.seasonId ?? "",
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

function applyDetail(
  data: MatchDetail,
  setDetail: (d: MatchDetail) => void,
  setInitial: (i: ReturnType<typeof fixtureToFormInitial>) => void,
) {
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

    void init();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [detail]);

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
    return <p className="text-zinc-500 text-sm">Loading match data…</p>;
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Edit match"
        description="Issues, lineups, stats, events, sources, and fixture details."
      />
      <div className="space-y-6 max-w-6xl">
        <div id="issues">
          <MatchIssuesPanel fixtureId={id} onChanged={reloadDetail} />
        </div>
        <div id="information">
          <MatchDataPanel
            fixture={{ ...detail.fixture, id: detail.fixture.id }}
            events={detail.events}
            syncing={syncing}
          />
        </div>
        <div id="lineups" className="cms-card">
          <h3 className="cms-section-title">Lineups</h3>
          <MatchLineupsEditor fixtureId={id} onChanged={reloadDetail} />
        </div>
        <div id="team-stats" className="cms-card">
          <h3 className="cms-section-title">Match stats</h3>
          <MatchTeamStatsEditor fixtureId={id} />
        </div>
        <div id="player-stats" className="cms-card">
          <h3 className="cms-section-title">Player stats</h3>
          <MatchPlayerStatsEditor fixtureId={id} />
        </div>
        <div id="events" className="cms-card">
          <h3 className="cms-section-title">Match events</h3>
          <MatchEventsEditor fixtureId={id} />
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
        <div id="commentary" className="cms-card text-sm text-zinc-400">
          <h3 className="cms-section-title">Commentary</h3>
          <p className="m-0">
            Open{" "}
            <Link href={`/matches/${detail.fixture.slug}/commentary`} className="text-emerald-400 hover:underline">
              public commentary
            </Link>{" "}
            or the{" "}
            <Link href="/admin/operator" className="text-emerald-400 hover:underline">
              operator console
            </Link>
            .
          </p>
        </div>
        <div id="sources" className="cms-card">
          <MatchSourcesPanel fixtureId={id} onSaved={reloadDetail} />
        </div>
        <div id="conflicts" className="cms-card text-sm text-zinc-400">
          <h3 className="cms-section-title">Conflicts</h3>
          <p className="m-0">
            Conflict centre wiring comes in a later phase. Manual score locks already protect overrides.
          </p>
        </div>
        <div id="raw-data" className="cms-card text-sm text-zinc-400">
          <h3 className="cms-section-title">Raw data</h3>
          <p className="m-0">Raw API response viewer arrives with Data Integration tools.</p>
        </div>
        <div id="audit" className="cms-card text-sm text-zinc-400">
          <h3 className="cms-section-title">Audit</h3>
          <p className="m-0">Inline score changes are written to the data integration audit log.</p>
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
