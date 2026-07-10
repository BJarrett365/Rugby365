"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LeagueTable } from "@/components/competitions/LeagueTable";
import { PlayoffFixtures } from "@/components/competitions/PlayoffFixtures";
import { isNationsChampionshipSlug } from "@/lib/nations-championship-hemisphere";
import { splitRowsByHemisphere } from "@/lib/table-lab/table-hemisphere-shared";
import { getRugbyTableDefinition } from "@/lib/table-lab/table-definition-service";

type View = "overall" | "home" | "away";

type Season = { id: string; label: string; year: number; isActive: boolean; displayLabel?: string };

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

type Champion = {
  winner: string;
  label: string;
  wikipediaUrl?: string;
};

type PlayoffFixture = {
  id: string;
  kickoffAt: string | null;
  status: string;
  round: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
};

const VIEW_OPTIONS: View[] = ["overall", "home", "away"];

export function CompetitionTableClient({
  slug,
  initialSeason,
  initialView = "overall",
}: {
  slug: string;
  initialSeason?: string;
  initialView?: View;
}) {
  const [competitionId, setCompetitionId] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonLabel, setSeasonLabel] = useState(initialSeason ?? "");
  const [view, setView] = useState<View>(initialView);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [champion, setChampion] = useState<Champion | null>(null);
  const [playoffFixtures, setPlayoffFixtures] = useState<PlayoffFixture[]>([]);
  const [playedMismatch, setPlayedMismatch] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ view });
    if (seasonLabel) params.set("season", seasonLabel);
    const res = await fetch(`/api/competitions/by-slug/${slug}/standings?${params}`);
    const data = await res.json();
    if (res.ok) {
      setCompetitionId(data.competition?.id ?? "");
      setCompetitionName(data.competition?.name ?? slug);
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
      setChampion((data.champion as Champion | null) ?? null);
      setPlayoffFixtures(
        (data.playoffFixtures ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          kickoffAt: row.kickoffAt ? String(row.kickoffAt) : null,
          status: row.status as string,
          round: (row.round as string | null) ?? null,
          homeTeam: (row.homeTeam as string | null) ?? null,
          awayTeam: (row.awayTeam as string | null) ?? null,
          homeScore: row.homeScore as number,
          awayScore: row.awayScore as number,
        })),
      );
      setPlayedMismatch(Boolean(data.playedMismatch));
    }
    setLoading(false);
  }, [slug, seasonLabel, view]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const tableLabHref = competitionId
    ? `/admin/tables/view?competitionId=${encodeURIComponent(competitionId)}`
    : "/admin/tables/view";

  const nationsChampionship = isNationsChampionshipSlug(slug);
  const hemisphereDefinition = getRugbyTableDefinition("hemisphere_table");
  const hemisphereGroups =
    nationsChampionship && hemisphereDefinition && standings.length > 0
      ? splitRowsByHemisphere(
          standings.map((row) => ({
            rank: row.rank,
            teamId: row.teamSlug,
            teamName: row.teamName,
            played: row.played,
            won: row.won,
            drawn: row.draw,
            lost: row.lost,
            pointsFor: 0,
            pointsAgainst: 0,
            pointsDiff: row.pointsDiff,
            bonusPoints: row.bonusPoints,
            leaguePoints: row.points,
          })),
          hemisphereDefinition,
        )
      : [];

  return (
    <div>
      <div className="cms-card mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-2">
          <span className="block text-zinc-500 mb-1">Table view</span>
          <div className="inline-flex w-full rounded-lg border border-zinc-800 overflow-hidden text-sm">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`flex-1 px-3 py-2 capitalize touch-target ${
                  view === option
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Season</span>
          <select
            className="cms-input w-full"
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">No seasons</option>
            ) : (
              seasons.map((season) => (
                <option key={season.id} value={season.label}>
                  {season.displayLabel ?? season.label}
                  {season.isActive ? " (active)" : ""}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-zinc-500 m-0">
          {competitionName} · {view} table
          {seasonLabel ? ` · ${seasonLabel}` : ""}
        </p>
        <Link href={tableLabHref} className="cms-btn cms-btn--secondary text-xs">
          Advanced tables
        </Link>
      </div>

      {champion ? (
        <div className="cms-card mb-4 border-emerald-900/50 bg-emerald-950/20">
          <p className="text-lg font-semibold text-emerald-300 m-0">
            Winner: {champion.winner}
            <span className="text-zinc-500 font-normal text-sm ml-2">{champion.label}</span>
          </p>
          {champion.wikipediaUrl ? (
            <a
              href={champion.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
            >
              Wikipedia season page
            </a>
          ) : null}
        </div>
      ) : null}

      {playedMismatch ? (
        <p className="text-sm text-amber-500/90 mb-4 m-0">
          Teams have different games played — table may be incomplete. Re-sync this season from
          LiveSport or SDMS.
        </p>
      ) : null}

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading table…</p>
      ) : nationsChampionship && hemisphereGroups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {hemisphereGroups.map((group) => (
            <div key={group.hemisphere} className="cms-card overflow-x-auto">
              <h2 className="text-base font-semibold m-0 mb-3">{group.label}</h2>
              <LeagueTable
                rows={group.rows.map((row) => ({
                  rank: row.rank,
                  teamName: row.teamName,
                  teamSlug: row.teamId,
                  played: row.played,
                  won: row.won,
                  draw: row.drawn,
                  lost: row.lost,
                  pointsDiff: row.pointsDiff,
                  bonusPoints: row.bonusPoints,
                  points: row.leaguePoints,
                  form: null,
                }))}
                showForm={false}
                compact
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="cms-card overflow-x-auto">
            <LeagueTable rows={standings} />
          </div>
          <PlayoffFixtures fixtures={playoffFixtures} />
        </>
      )}
    </div>
  );
}
