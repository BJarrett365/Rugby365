"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MatchCmsInfoHeader } from "@/components/admin/MatchCmsInfoHeader";
import { MatchCmsSubnav } from "@/components/admin/MatchCmsSubnav";
import { PageHeader } from "@/components/shell/PageHeader";

type FixtureMeta = {
  id: string;
  slug: string;
  status: string;
  kickoffAt: string | Date | null;
  homeTeam?: { id: string; name: string } | null;
  awayTeam?: { id: string; name: string } | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  attendance?: number | null;
  competitionName?: string | null;
  competition?: { id: string; name: string; slug: string } | null;
};

export function MatchCmsFeatureShell({
  matchId,
  title,
  description,
  children,
  actions,
  showInfoHeader = true,
}: {
  matchId: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Set false when the child editor already renders MatchCmsInfoHeader. */
  showInfoHeader?: boolean;
}) {
  const [fixture, setFixture] = useState<FixtureMeta | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/matches/${matchId}`);
        const data = await res.json();
        if (!res.ok || !data.fixture) throw new Error(data.error ?? "Match not found");
        if (!cancelled) setFixture(data.fixture as FixtureMeta);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load match");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const teamsLabel = fixture
    ? `${fixture.homeTeam?.name ?? "Home"} vs ${fixture.awayTeam?.name ?? "Away"}`
    : "Match";

  return (
    <>
      <PageHeader
        title={title}
        description={description ?? (fixture ? teamsLabel : "Loading match…")}
      />
      <p className="text-sm text-zinc-500 m-0 mb-3">
        <Link href="/admin/matches" className="text-zinc-400 hover:text-zinc-200">
          ← Matches
        </Link>
        {fixture ? (
          <>
            {" · "}
            <Link href={`/admin/matches/${matchId}/edit`} className="text-emerald-400 hover:underline">
              Match Info
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
          </>
        ) : null}
      </p>

      {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}

      {fixture && showInfoHeader ? (
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
            actions={actions}
          />
        </div>
      ) : null}

      <MatchCmsSubnav matchId={matchId} slug={fixture?.slug} />

      <div className="mt-4">{children}</div>
    </>
  );
}
