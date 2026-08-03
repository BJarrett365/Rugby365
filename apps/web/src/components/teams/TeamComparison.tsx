"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TeamCompareMetric } from "@/lib/team-compare-metrics";
import type { TeamComparePayload } from "@/lib/team-compare-types";
import type { TeamCompareSidePacket } from "@/lib/team-squad-intelligence-types";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { TeamCompareXvPanel } from "@/components/teams/TeamCompareXvPanel";
import { TeamComparePositionBattles } from "@/components/teams/TeamComparePositionBattles";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "value", label: "Squad value" },
  { id: "form", label: "Form" },
  { id: "rating", label: "Ratings" },
  { id: "squad", label: "Squad" },
  { id: "xv", label: "Starting XV" },
  { id: "battles", label: "Positions" },
  { id: "h2h", label: "Head-to-head" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatMetric(value: number | null, format?: TeamCompareMetric["format"]): string {
  if (value == null) return "—";
  if (format === "gbp") {
    if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1000) return `£${Math.round(value / 1000)}k`;
    return `£${Math.round(value)}`;
  }
  if (format === "pct") return `${value}%`;
  if (format === "rank") return `#${Math.round(value)}`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function CompareBar({
  metric,
}: {
  metric: TeamCompareMetric;
}) {
  const { a, b, label, higherIsBetter = true, format, key } = metric;
  const max = Math.max(a ?? 0, b ?? 0, 1);
  const aWin =
    a != null && b != null ? (higherIsBetter ? a >= b : a <= b) : a != null;
  const bWin =
    a != null && b != null ? (higherIsBetter ? b > a : b < a) : b != null;

  return (
    <div className="pr-player-compare__row" data-metric={key}>
      <span className={`pr-player-compare__val${aWin ? " is-lead" : ""}`}>
        {formatMetric(a, format)}
      </span>
      <div className="pr-player-compare__bars">
        <span className="pr-player-compare__label">{label}</span>
        <div className="pr-player-compare__track">
          <span
            className="pr-player-compare__fill pr-player-compare__fill--a"
            style={{ width: `${a != null ? Math.max(6, (a / max) * 100) : 0}%` }}
          />
        </div>
        <div className="pr-player-compare__track">
          <span
            className="pr-player-compare__fill pr-player-compare__fill--b"
            style={{ width: `${b != null ? Math.max(6, (b / max) * 100) : 0}%` }}
          />
        </div>
      </div>
      <span className={`pr-player-compare__val${bWin ? " is-lead" : ""}`}>
        {formatMetric(b, format)}
      </span>
    </div>
  );
}

function TeamHeadCard({ team }: { team: TeamCompareSidePacket }) {
  return (
    <div className="rounded-xl border border-[var(--pr-mc-border)] bg-[var(--pr-mc-panel)] p-4 text-center space-y-2">
      <TeamCrest name={team.name} imageUrl={team.imageUrl} size="lg" labelled />
      <Link
        href={`/teams/${encodeURIComponent(team.slug)}`}
        className="block text-base font-semibold text-[var(--pr-mc-text)] hover:underline"
      >
        {team.name}
      </Link>
      <p className="m-0 text-xs text-[var(--pr-mc-muted)]">
        {[team.competitionName, team.countryName].filter(Boolean).join(" · ") || "—"}
      </p>
      <p className="m-0 text-3xl font-bold text-[var(--pr-mc-gold,#e7bc63)]">
        {team.rating.overall != null ? Math.round(team.rating.overall) : "—"}
      </p>
      <p className="m-0 text-[10px] uppercase tracking-wide text-[var(--pr-mc-grey)]">
        Team rating
      </p>
      <dl className="m-0 grid grid-cols-2 gap-x-2 gap-y-1 text-left text-xs text-[var(--pr-mc-muted)]">
        <div>
          <dt className="inline">Value </dt>
          <dd className="inline m-0 text-[var(--pr-mc-text)]">
            {team.squadValue.totalSquadValueLabel}
          </dd>
        </div>
        <div>
          <dt className="inline">World </dt>
          <dd className="inline m-0 text-[var(--pr-mc-text)]">
            {team.worldRank != null ? `#${team.worldRank}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline">Coach </dt>
          <dd className="inline m-0 text-[var(--pr-mc-text)]">{team.coachName ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline">Titles </dt>
          <dd className="inline m-0 text-[var(--pr-mc-text)]">{team.trophyCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="inline">Stadium </dt>
          <dd className="inline m-0 text-[var(--pr-mc-text)]">{team.homeVenueName ?? "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="inline">Form </dt>
          <dd className="inline m-0 text-[var(--pr-mc-text)] tracking-widest">
            {team.form.lastResults.join(" ") || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function TeamComparison({ data }: { data: TeamComparePayload }) {
  const [tab, setTab] = useState<TabId>("summary");
  const filtered = useMemo(
    () => data.metrics.filter((m) => m.group === tab),
    [data.metrics, tab],
  );

  const { teamA, teamB, headToHead, positionScore } = data;
  const metricTab =
    tab === "h2h" || tab === "xv" || tab === "battles" ? null : tab;

  return (
    <section className="pr-player-compare space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center">
        <TeamHeadCard team={teamA} />
        <div className="pr-player-compare__vs text-center" aria-hidden>
          VS
        </div>
        <TeamHeadCard team={teamB} />
      </div>

      <p className="m-0 text-center text-sm text-[var(--pr-mc-muted)]">
        Position edge · <strong className="text-[var(--pr-mc-text)]">{teamA.name}</strong>{" "}
        {positionScore.a}–{positionScore.b}{" "}
        <strong className="text-[var(--pr-mc-text)]">{teamB.name}</strong>
      </p>

      <nav className="pr-player-compare__tabs" aria-label="Team comparison categories">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pr-player-compare__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "h2h" ? (
        <div className="rounded-xl border border-[var(--pr-mc-border)] bg-[var(--pr-mc-panel)] p-4 space-y-3">
          <p className="m-0 text-sm text-[var(--pr-mc-text)]">
            <strong>{headToHead.totalMeetings}</strong> meetings ·{" "}
            <strong>{teamA.name}</strong> {headToHead.teamAWins} · Draws{" "}
            {headToHead.draws} · <strong>{teamB.name}</strong> {headToHead.teamBWins}
          </p>
          {headToHead.lastMeeting ? (
            <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
              Last meeting: {headToHead.lastMeeting.homeTeam}{" "}
              {headToHead.lastMeeting.homeScore}–{headToHead.lastMeeting.awayScore}{" "}
              {headToHead.lastMeeting.awayTeam}
              {headToHead.lastMeeting.date
                ? ` · ${new Date(headToHead.lastMeeting.date).toLocaleDateString()}`
                : ""}
              {headToHead.lastMeeting.fixtureSlug ? (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`/matches/${headToHead.lastMeeting.fixtureSlug}`}
                    className="text-[var(--pr-mc-link,#54b989)] hover:underline"
                  >
                    View match
                  </Link>
                </>
              ) : null}
            </p>
          ) : (
            <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
              No completed CMS meetings found between these teams yet.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <p className="m-0 text-[var(--pr-mc-muted)]">
              Biggest win ({teamA.name}):{" "}
              <span className="text-[var(--pr-mc-text)]">
                {headToHead.biggestWinForA?.score ?? "—"}
              </span>
            </p>
            <p className="m-0 text-[var(--pr-mc-muted)]">
              Biggest win ({teamB.name}):{" "}
              <span className="text-[var(--pr-mc-text)]">
                {headToHead.biggestWinForB?.score ?? "—"}
              </span>
            </p>
          </div>
        </div>
      ) : tab === "xv" ? (
        <TeamCompareXvPanel
          teamAName={teamA.name}
          teamBName={teamB.name}
          slotsA={data.startingXvA}
          slotsB={data.startingXvB}
          summaryA={data.xvSummaryA}
          summaryB={data.xvSummaryB}
        />
      ) : tab === "battles" ? (
        <TeamComparePositionBattles
          teamAName={teamA.name}
          teamBName={teamB.name}
          battles={data.positionBattles}
          score={data.positionScore}
        />
      ) : (
        <div className="pr-player-compare__metrics">
          {filtered.map((m) => (
            <CompareBar key={m.key} metric={m} />
          ))}
          {metricTab === "squad" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-[var(--pr-mc-muted)]">
              <p className="m-0 rounded-lg border border-[var(--pr-mc-border)] p-3">
                <strong className="text-[var(--pr-mc-text)]">{teamA.name}</strong>
                <br />
                Depth {data.depthA.depthScore ?? "—"} · Experience{" "}
                {data.depthA.experienceScore ?? "—"} · U23 {data.depthA.under23Count} · 30+{" "}
                {data.depthA.over30Count}
              </p>
              <p className="m-0 rounded-lg border border-[var(--pr-mc-border)] p-3">
                <strong className="text-[var(--pr-mc-text)]">{teamB.name}</strong>
                <br />
                Depth {data.depthB.depthScore ?? "—"} · Experience{" "}
                {data.depthB.experienceScore ?? "—"} · U23 {data.depthB.under23Count} · 30+{" "}
                {data.depthB.over30Count}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <footer className="pr-player-compare__summary">
        <div>
          <span>Team Rating</span>
          <strong>
            {teamA.rating.overall ?? "—"} · {teamB.rating.overall ?? "—"}
          </strong>
        </div>
        <div>
          <span>Squad Value</span>
          <strong>
            {teamA.squadValue.totalSquadValueLabel} · {teamB.squadValue.totalSquadValueLabel}
          </strong>
        </div>
        <div>
          <span>Position edge</span>
          <strong>
            {positionScore.a} · {positionScore.b}
          </strong>
        </div>
        <p className="pr-player-compare__links">
          <Link href={`/teams/${teamA.slug}`}>View {teamA.name}</Link>
          <Link href={`/teams/${teamB.slug}`}>View {teamB.name}</Link>
        </p>
      </footer>
    </section>
  );
}
