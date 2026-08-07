"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ScheduleFixture } from "@/lib/match-schedule-utils";
import { matchDetailHref } from "@/lib/match-schedule-utils";
import { TeamCrest } from "./TeamCrest";

type SchedulePayload = {
  fixtures: ScheduleFixture[];
};

/** Survive Match Centre remounts when switching tabs (searchParams re-render). */
const sidebarFixtureCache = new Map<string, ScheduleFixture[]>();

function sidebarCacheKey(
  matchDate: string,
  competitionName: string,
  competitionId?: string | number | null,
): string {
  return `${matchDate}|${competitionId ?? ""}|${competitionName.trim().toLowerCase()}`;
}

function formatKickTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isFinished(status: string): boolean {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  return (
    s === "result" ||
    s === "finished" ||
    s === "ft" ||
    s === "full_time" ||
    s === "complete" ||
    s === "completed"
  );
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateRange(center: string, pastDays: number, futureDays: number): string[] {
  const out: string[] = [];
  for (let i = -pastDays; i <= futureDays; i++) {
    out.push(addDays(center, i));
  }
  return out;
}

function ordinal(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (k >= 11 && k <= 13) return `${day}th`;
  if (j === 1) return `${day}st`;
  if (j === 2) return `${day}nd`;
  if (j === 3) return `${day}rd`;
  return `${day}th`;
}

/** e.g. Sunday 26th July 2026 — matches Planet Rugby rail. */
function formatDateHeading(iso: string): string {
  // Noon UTC keeps calendar day stable across UK/EU offsets for strip headings.
  const d = new Date(`${iso}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `${weekday} ${ordinal(d.getUTCDate())} ${month} ${year}`;
}

function fixtureDateKey(f: ScheduleFixture): string {
  if (f.matchDate) return f.matchDate;
  if (f.kickoffAt) return f.kickoffAt.slice(0, 10);
  return "";
}

function roundLabelFor(fixture: ScheduleFixture): string | null {
  const roundRaw = fixture.round?.trim();
  if (!roundRaw) return null;
  return /^round\b/i.test(roundRaw) ? roundRaw : `Round ${roundRaw}`;
}

function MatchRailCard({
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
  const matchId =
    fixture.externalMatchId ?? (fixture.source === "sdms" ? fixture.id.replace(/^sdms:/, "") : null);
  const isCurrent = matchId === currentMatchId;
  const dateKey = fixtureDateKey(fixture);
  const roundLabel = roundLabelFor(fixture);

  return (
    <article
      className={`pr-rail-card${isCurrent ? " pr-rail-card--current" : ""}${finished ? " pr-rail-card--result" : ""}`}
    >
      <header className="pr-rail-card__header">
        <div className="pr-rail-card__date">{dateKey ? formatDateHeading(dateKey) : "Date TBC"}</div>
        {roundLabel ? <div className="pr-rail-card__round">{roundLabel}</div> : null}
      </header>

      <div className="pr-rail-card__body">
        {!finished ? (
          <span className="pr-rail-card__time">{formatKickTime(fixture.kickoffAt)}</span>
        ) : null}
        <div className="pr-rail-card__teams">
          <div className="pr-rail-card__team">
            <TeamCrest name={home} imageUrl={fixture.homeTeam?.imageUrl} size="xs" />
            <span className="pr-rail-card__name">{home}</span>
            {finished ? <span className="pr-rail-card__score">{fixture.homeScore}</span> : null}
          </div>
          <div className="pr-rail-card__team">
            <TeamCrest name={away} imageUrl={fixture.awayTeam?.imageUrl} size="xs" />
            <span className="pr-rail-card__name">{away}</span>
            {finished ? <span className="pr-rail-card__score">{fixture.awayScore}</span> : null}
          </div>
        </div>
      </div>

      {href && !isCurrent ? (
        <Link href={href} className="pr-rail-card__cta">
          Match Info
        </Link>
      ) : (
        <span className="pr-rail-card__cta pr-rail-card__cta--muted">
          {isCurrent ? "This match" : "—"}
        </span>
      )}
    </article>
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
        <div className="pr-sidebar-widget__cards">
          {fixtures.map((f) => (
            <MatchRailCard key={f.id} fixture={f} currentMatchId={currentMatchId} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Lazy client sidebar: fixtures (±7 days upcoming) and results (last 7 days)
 * for the same competition — Planet Rugby rail card layout.
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
  const cacheKey = sidebarCacheKey(matchDate, competitionName, competitionId);
  const [fixtures, setFixtures] = useState<ScheduleFixture[] | null>(
    () => sidebarFixtureCache.get(cacheKey) ?? null,
  );
  const dates = useMemo(() => dateRange(matchDate, 1, 1), [matchDate]);

  useEffect(() => {
    let cancelled = false;
    const cached = sidebarFixtureCache.get(cacheKey);
    if (cached) {
      setFixtures(cached);
      return;
    }
    setFixtures(null);
    const controller = new AbortController();
    // Fail soft: an endless "Loading fixtures…" is worse than an empty rail.
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (!cancelled) setFixtures((prev) => prev ?? []);
    }, 6_000);
    // lite=1: DB-only, no provider sync / win-prob enrichment (keeps Match Centre snappy).
    Promise.all(
      dates.map((date) =>
        fetch(`/api/fixtures/schedule?${new URLSearchParams({ date, lite: "1" }).toString()}`, {
          signal: controller.signal,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: SchedulePayload | null) => json?.fixtures ?? [])
          .catch(() => [] as ScheduleFixture[]),
      ),
    )
      .then((days) => {
        if (cancelled) return;
        const nameNorm = competitionName.trim().toLowerCase();
        const merged = new Map<string, ScheduleFixture>();
        for (const list of days) {
          for (const f of list) {
            if (
              competitionId != null &&
              f.sdmsCompetitionId &&
              String(f.sdmsCompetitionId) === String(competitionId)
            ) {
              merged.set(f.id, f);
              continue;
            }
            if ((f.competitionName ?? "").trim().toLowerCase() === nameNorm) {
              merged.set(f.id, f);
            }
          }
        }
        const next = [...merged.values()];
        sidebarFixtureCache.set(cacheKey, next);
        setFixtures(next);
      })
      .catch(() => {
        if (!cancelled) setFixtures([]);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [cacheKey, dates, competitionName, competitionId]);

  if (fixtures === null) {
    return (
      <aside className="pr-match-sidebar" aria-busy="true">
        <p className="pr-sidebar-widget__empty">Loading fixtures…</p>
      </aside>
    );
  }

  const center = matchDate;
  const upcoming = fixtures
    .filter((f) => !isFinished(f.status))
    .filter((f) => {
      const d = fixtureDateKey(f);
      return d >= center && d <= addDays(center, 7);
    })
    .sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));

  const results = fixtures
    .filter((f) => isFinished(f.status))
    .filter((f) => {
      const d = fixtureDateKey(f);
      return d >= addDays(center, -7) && d <= center;
    })
    .sort((a, b) => (b.kickoffAt ?? "").localeCompare(a.kickoffAt ?? ""));

  return (
    <aside className="pr-match-sidebar">
      <Widget
        title="Fixtures"
        fixtures={upcoming}
        currentMatchId={currentMatchId}
        empty="No fixtures in the next seven days."
      />
      <Widget
        title="Results"
        fixtures={results}
        currentMatchId={currentMatchId}
        empty="No results in the last seven days."
      />
    </aside>
  );
}
