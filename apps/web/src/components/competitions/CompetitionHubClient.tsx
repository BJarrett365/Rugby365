"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LeagueMatchList, LeagueScheduleToolbar } from "@/components/competitions/LeagueMatchList";
import { LeagueTable } from "@/components/competitions/LeagueTable";

type View = "overall" | "home" | "away";

type Season = { id: string; label: string; year: number; isActive: boolean };

type Standing = {
  rank: number;
  teamName: string;
  teamSlug: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsDiff: number;
  bonusPoints: number;
  points: number;
  form: string | null;
};

type MatchRow = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  round: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  venueName: string | null;
};

export function CompetitionHubClient({
  slug,
  mode,
  initialSeason,
  initialView = "overall",
}: {
  slug: string;
  mode: "overview" | "table" | "fixtures" | "results";
  initialSeason?: string;
  initialView?: View;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonLabel, setSeasonLabel] = useState(initialSeason ?? "");
  const [view, setView] = useState<View>(initialView);
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [fixtures, setFixtures] = useState<MatchRow[]>([]);
  const [results, setResults] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (seasonLabel) params.set("season", seasonLabel);
    if (mode === "table") params.set("view", view);
    const res = await fetch(`/api/competitions/by-slug/${slug}?${params}`);
    const data = await res.json();
    if (res.ok) {
      setSeasons(data.seasons ?? []);
      if (!seasonLabel && data.season?.label) setSeasonLabel(data.season.label);
      setStandings(
        (data.standings ?? []).map((r: Record<string, unknown>) => ({
          rank: r.rank as number,
          teamName: r.teamName as string,
          teamSlug: r.teamSlug as string,
          played: r.played as number,
          won: r.won as number,
          draw: r.draw as number,
          lost: r.lost as number,
          pointsDiff: r.pointsDiff as number,
          bonusPoints: r.bonusPoints as number,
          points: r.points as number,
          form: (r.form as string | null) ?? null,
        })),
      );
      setFixtures(data.fixtures ?? []);
      setResults(data.results ?? []);
    }
    setLoading(false);
  }, [slug, seasonLabel, view, mode]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setMonthIndex(null);
  }, [seasonLabel, mode]);

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;

  if (mode === "table") {
    return (
      <div>
        <div className="league-schedule-toolbar mb-4">
          <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden text-sm">
            {(["overall", "home", "away"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize touch-target ${
                  view === v ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {seasons.length > 0 && (
            <select
              className="league-season-select cms-select"
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="cms-card">
          <LeagueTable rows={standings} />
        </div>
      </div>
    );
  }

  if (mode === "fixtures") {
    return (
      <div>
        <LeagueScheduleToolbar
          seasons={seasons}
          seasonLabel={seasonLabel}
          onSeasonChange={setSeasonLabel}
          rows={fixtures}
          monthIndex={monthIndex}
          onMonthChange={setMonthIndex}
        />
        <LeagueMatchList
          rows={fixtures}
          showScores={false}
          newestFirst={false}
          monthIndex={monthIndex}
        />
      </div>
    );
  }

  if (mode === "results") {
    return (
      <div>
        <LeagueScheduleToolbar
          seasons={seasons}
          seasonLabel={seasonLabel}
          onSeasonChange={setSeasonLabel}
          rows={results}
          monthIndex={monthIndex}
          onMonthChange={setMonthIndex}
        />
        <LeagueMatchList
          rows={results}
          showScores
          newestFirst
          monthIndex={monthIndex}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {seasons.length > 0 && (
          <select
            className="league-season-select cms-select"
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="cms-card">
        <h2 className="font-semibold m-0 mb-3">Table</h2>
        <LeagueTable rows={standings.slice(0, 6)} />
        <Link href={`/competitions/${slug}/table`} className="text-sm text-emerald-400 mt-3 inline-block">
          Full table →
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold m-0 mb-3">Latest results</h2>
          <LeagueMatchList rows={results.slice(0, 6)} showScores newestFirst />
          <Link href={`/competitions/${slug}/results`} className="text-sm text-emerald-400 mt-3 inline-block">
            All results →
          </Link>
        </div>
        <div>
          <h2 className="font-semibold m-0 mb-3">Upcoming fixtures</h2>
          <LeagueMatchList rows={fixtures.slice(0, 6)} showScores={false} newestFirst={false} />
          <Link href={`/competitions/${slug}/fixtures`} className="text-sm text-emerald-400 mt-3 inline-block">
            All fixtures →
          </Link>
        </div>
      </div>
    </div>
  );
}
