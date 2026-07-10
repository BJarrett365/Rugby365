"use client";

import { useEffect, useState } from "react";
import { CommentaryEntryForm } from "./CommentaryEntryForm";

export type CommentaryLine = {
  id: string;
  minute: number;
  body: string;
  publishedAt: string;
};

export type FixtureSummary = {
  id: string;
  slug: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  period: string;
  competitionName: string | null;
  kickoffAt: string | null;
  refereeName?: string | null;
  venueName?: string | null;
  providerSnapshot?: {
    venue?: { name?: string; city?: string };
    homeTeam?: string;
    awayTeam?: string;
  } | null;
};

type Team = { id: string; name: string; slug: string };

export function useFixtureBySlug(slug: string) {
  const [fixture, setFixture] = useState<FixtureSummary | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fixtures/by-slug/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setFixture(d.fixture ?? null);
        setTeams(d.teams ?? []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const homeTeam = fixture?.homeTeamId ? teamById[fixture.homeTeamId] : null;
  const awayTeam = fixture?.awayTeamId ? teamById[fixture.awayTeamId] : null;
  const snap = fixture?.providerSnapshot;
  const homeName = homeTeam?.name ?? snap?.homeTeam ?? "Home";
  const awayName = awayTeam?.name ?? snap?.awayTeam ?? "Away";

  return { fixture, homeName, awayName, loading };
}

function formatKickoff(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatStatus(status: string, period: string) {
  const label = status.replace(/_/g, " ");
  if (status === "full_time") return "Full time";
  if (status === "live") return period.replace(/_/g, " ") || "Live";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MatchCommentaryHeader({
  homeName,
  awayName,
  fixture,
}: {
  homeName: string;
  awayName: string;
  fixture: FixtureSummary;
}) {
  const venue = fixture.providerSnapshot?.venue;
  const venueLabel =
    fixture.venueName ??
    (venue ? [venue.name, venue.city].filter(Boolean).join(", ") : null);
  const kickoff = formatKickoff(fixture.kickoffAt);
  const referee = fixture.refereeName;

  return (
    <div className="cms-card mb-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 m-0">
        {fixture.competitionName ?? "Match"}
        {kickoff ? ` · ${kickoff}` : ""}
      </p>
      <p className="text-2xl font-semibold text-zinc-100 m-0 mt-1">
        {homeName}{" "}
        <span className="font-mono tabular-nums">
          {fixture.homeScore}–{fixture.awayScore}
        </span>{" "}
        {awayName}
      </p>
      <p className="text-sm text-zinc-500 m-0 mt-1">
        {formatStatus(fixture.status, fixture.period)}
        {venueLabel ? ` · ${venueLabel}` : ""}
        {referee ? ` · Ref: ${referee}` : ""}
      </p>
    </div>
  );
}

export function CommentaryFeed({
  fixtureId,
  fixture,
  homeName,
  awayName,
}: {
  fixtureId: string | null;
  fixture?: FixtureSummary | null;
  homeName?: string;
  awayName?: string;
}) {
  const [lines, setLines] = useState<CommentaryLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!fixtureId) return;
    setLoaded(false);
    fetch(`/api/fixtures/${fixtureId}/commentary`)
      .then((r) => r.json())
      .then((d) => {
        setLines(d.lines ?? []);
        setLoaded(true);
      });

    const es = new EventSource(`/api/fixtures/${fixtureId}/commentary/stream`);
    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as { type: string; line: CommentaryLine };
      if (msg.type === "commentary.append") {
        setLines((prev) => {
          if (prev.some((l) => l.id === msg.line.id)) return prev;
          return [...prev, msg.line];
        });
      }
    };
    return () => es.close();
  }, [fixtureId]);

  const emptyMessage = (() => {
    if (!loaded) return "Loading commentary…";
    if (fixture?.status === "full_time") return "No commentary published for this match yet.";
    if (fixture?.status === "live") return "Waiting for live commentary…";
    return "Waiting for commentary…";
  })();

  return (
    <>
      {fixture && homeName && awayName && (
        <MatchCommentaryHeader homeName={homeName} awayName={awayName} fixture={fixture} />
      )}
      {fixtureId && fixture && homeName && awayName && (
        <CommentaryEntryForm
          fixtureId={fixtureId}
          fixture={fixture}
          homeName={homeName}
          awayName={awayName}
          onPublished={(line) => {
            setLines((prev) => {
              if (prev.some((l) => l.id === line.id)) return prev;
              return [...prev, line].sort((a, b) => a.minute - b.minute || a.body.localeCompare(b.body));
            });
          }}
        />
      )}
      <ul className="commentary-feed">
        {lines.length === 0 && <li className="commentary-feed__item text-zinc-500">{emptyMessage}</li>}
        {lines.map((line) => (
          <li key={line.id} className="commentary-feed__item">
            <span className="commentary-feed__minute">{line.minute}&apos;</span>
            <span>{line.body}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function useFixtureId(slug: string) {
  const { fixture } = useFixtureBySlug(slug);
  return fixture?.id ?? null;
}
