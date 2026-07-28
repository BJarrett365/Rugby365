"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MatchDataPanel } from "@/components/admin/MatchDataPanel";
import { MatchForm, toDatetimeLocal } from "@/components/admin/MatchForm";
import { MatchIssuesPanel } from "@/components/admin/MatchIssuesPanel";
import { MatchCmsSubnav } from "@/components/admin/MatchCmsSubnav";
import { MatchCmsInfoHeader } from "@/components/admin/MatchCmsInfoHeader";
import { MatchCmsHashRedirect } from "@/components/admin/MatchCmsHashRedirect";
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
    watchalongYoutubeUrl?: string | null;
    highlightsYoutubeUrl?: string | null;
    venueId?: string | null;
    attendance?: number | null;
    halfTimeHome?: number | null;
    halfTimeAway?: number | null;
    additionalInfo?: string | null;
    weatherNote?: string | null;
    refereeId?: string | null;
    homeCoachId?: string | null;
    awayCoachId?: string | null;
    round?: string | null;
    competition?: { id: string; name: string; slug: string } | null;
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
    halfTimeHome: fixture.halfTimeHome != null ? String(fixture.halfTimeHome) : "",
    halfTimeAway: fixture.halfTimeAway != null ? String(fixture.halfTimeAway) : "",
    additionalInfo: fixture.additionalInfo ?? "",
    weatherNote: fixture.weatherNote ?? "",
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
            if (enrichRes.ok && enrichData.detail && !cancelled) {
              applyDetail(enrichData.detail, setDetail, setInitial);
            }
          } finally {
            if (!cancelled) setSyncing(false);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    }

    void init();
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
    return <p className="text-zinc-500 text-sm">Loading match data…</p>;
  }

  const fixture = detail.fixture;

  return (
    <>
      <MatchCmsHashRedirect matchId={id} />
      <PageHeader
        eyebrow="CMS"
        title="Match Info"
        description="Core fixture details, attendance, half-time, weather note and additional information."
      />
      <p className="text-sm text-zinc-500 m-0 mb-3">
        <Link href="/admin/matches" className="text-zinc-400 hover:text-zinc-200">
          ← Matches
        </Link>
        {fixture.slug ? (
          <>
            {" · "}
            <Link
              href={`/matches/${fixture.slug}`}
              className="text-emerald-400 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Public view
            </Link>
          </>
        ) : null}
      </p>

      <div className="mb-3">
        <MatchCmsInfoHeader
          matchId={fixture.id}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          kickoffAt={fixture.kickoffAt}
          status={fixture.status}
          halfTimeHome={fixture.halfTimeHome}
          halfTimeAway={fixture.halfTimeAway}
          attendance={fixture.attendance}
          competitionSlug={fixture.competition?.slug ?? null}
          competitionName={fixture.competition?.name ?? fixture.competitionName}
        />
      </div>

      <MatchCmsSubnav matchId={id} slug={fixture.slug} />

      <div className="space-y-6 max-w-6xl mt-4">
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
        <MatchForm
          fixtureId={id}
          initial={initial}
          submitLabel="Save Match Info"
          onSynced={reloadDetail}
        />
      </div>
    </>
  );
}
