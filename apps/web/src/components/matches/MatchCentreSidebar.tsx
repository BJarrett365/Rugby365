"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScheduleFixture } from "@/lib/match-schedule-utils";
import { matchDetailHref } from "@/lib/match-schedule-utils";
import { TeamCrest } from "./TeamCrest";

type SchedulePayload = {
  fixtures: ScheduleFixture[];
};

function formatKickTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function isFinished(status: string): boolean {
  const s = status.toLowerCase();
  return s === "result" || s === "finished" || s === "ft" || s === "full time" || s === "complete";
}

function FixtureSidebarRow({
  fixture,
  currentMatchId,
}: {
  fixture: ScheduleFixture;
  currentMatchId: string;
}) {
  const href = matchDetailHref(fixture);
  const home = fixture.homeTeam?.name ?? "TBC";
  const away = fixture.awayTeam?.name ?? "TBC";
  const finished = isFinished(fixture.status);
  const scoreOrTime = finished
    ? `${fixture.homeScore}–${fixture.awayScore}`
    : formatKickTime(fixture.kickoffAt);
  const matchId = fixture.externalMatchId ?? (fixture.source === "sdms" ? fixture.id.replace(/^sdms:/, "") : null);
  const isCurrent = matchId === currentMatchId;

  return (
    <li className={`pr-sidebar-fixture${isCurrent ? " pr-sidebar-fixture--current" : ""}`}>
      <div className="pr-sidebar-fixture__main">
        <span className={`pr-sidebar-fixture__score${finished ? " pr-sidebar-fixture__score--ft" : ""}`}>
          {scoreOrTime}
        </span>
        <div className="pr-sidebar-fixture__teams">
          <span className="pr-sidebar-fixture__team">
            <TeamCrest name={home} imageUrl={fixture.homeTeam?.imageUrl} size="sm" />
            <span>{home}</span>
          </span>
          <span className="pr-sidebar-fixture__team">
            <TeamCrest name={away} imageUrl={fixture.awayTeam?.imageUrl} size="sm" />
            <span>{away}</span>
          </span>
        </div>
      </div>
      {href && !isCurrent ? (
        <Link href={href} className="pr-sidebar-fixture__link">
          Match Info
        </Link>
      ) : (
        <span className="pr-sidebar-fixture__link pr-sidebar-fixture__link--muted">
          {isCurrent ? "This match" : "—"}
        </span>
      )}
    </li>
  );
}

function Widget({
  title,
  fixtures,
  currentMatchId,
  empty,
}: {
  title: string;
  fixtures: ScheduleFixture[];
  currentMatchId: string;
  empty: string;
}) {
  return (
    <section className="pr-sidebar-widget">
      <h2 className="pr-sidebar-widget__title">{title}</h2>
      {fixtures.length === 0 ? (
        <p className="pr-sidebar-widget__empty">{empty}</p>
      ) : (
        <ul className="pr-sidebar-widget__list">
          {fixtures.map((f) => (
            <FixtureSidebarRow key={f.id} fixture={f} currentMatchId={currentMatchId} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Lazy client sidebar: loads same-day fixtures for the competition via schedule API.
 */
export function MatchCentreSidebar({
  matchDate,
  competitionName,
  competitionId,
  currentMatchId,
}: {
  matchDate: string;
  competitionName: string;
  competitionId?: string | number | null;
  currentMatchId: string;
}) {
  const [fixtures, setFixtures] = useState<ScheduleFixture[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ date: matchDate });
    // Fetch by date only — API competitionId is CMS UUID; we filter by name / SDMS id client-side.
    fetch(`/api/fixtures/schedule?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: SchedulePayload | null) => {
        if (cancelled || !json?.fixtures) {
          if (!cancelled) setFixtures([]);
          return;
        }
        const nameNorm = competitionName.trim().toLowerCase();
        const filtered = json.fixtures.filter((f) => {
          if (competitionId != null && f.sdmsCompetitionId && String(f.sdmsCompetitionId) === String(competitionId)) {
            return true;
          }
          return (f.competitionName ?? "").trim().toLowerCase() === nameNorm;
        });
        setFixtures(filtered);
      })
      .catch(() => {
        if (!cancelled) setFixtures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [matchDate, competitionName, competitionId]);

  if (fixtures === null) {
    return (
      <aside className="pr-match-sidebar" aria-busy="true">
        <p className="pr-sidebar-widget__empty">Loading fixtures…</p>
      </aside>
    );
  }

  const upcoming = fixtures.filter((f) => !isFinished(f.status));
  const results = fixtures.filter((f) => isFinished(f.status));

  return (
    <aside className="pr-match-sidebar">
      <Widget
        title="Fixtures"
        fixtures={upcoming}
        currentMatchId={currentMatchId}
        empty="No other fixtures on this date."
      />
      <Widget
        title="Results"
        fixtures={results}
        currentMatchId={currentMatchId}
        empty="No results on this date yet."
      />
    </aside>
  );
}
