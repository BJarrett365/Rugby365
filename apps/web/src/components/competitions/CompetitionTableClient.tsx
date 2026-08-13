"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CompetitionLiveTable } from "@/components/competitions/CompetitionLiveTable";
import { LeagueTable } from "@/components/competitions/LeagueTable";
import { PlayoffFixtures } from "@/components/competitions/PlayoffFixtures";
import {
  isRugbyWorldCupSlug,
  resolveRugbyWorldCupYear,
  rugbyWorldCupPoolsForYear,
} from "@/lib/rugby-world-cup-pools";
import {
  splitRowsIntoWorldCupPools,
  standingRowsToTableRows,
} from "@/lib/table-lab/table-pool-shared";
import type { RugbyTableResult } from "@/lib/table-lab/table-types";

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
  const [liveResult, setLiveResult] = useState<RugbyTableResult | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [playoffFixtures, setPlayoffFixtures] = useState<PlayoffFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ view });
    if (seasonLabel) params.set("season", seasonLabel);

    const liveRes = await fetch(`/api/competitions/by-slug/${slug}/live-table?${params}`);
    const liveData = await liveRes.json();

    // Live-table path now dedupes fixtures / skips polluted synced rows.
    if (
      liveRes.ok &&
      (liveData.result?.poolGroups?.length ||
        (Array.isArray(liveData.result?.rows) && liveData.result.rows.length > 0))
    ) {
      setCompetitionId(liveData.competition?.id ?? "");
      setCompetitionName(liveData.competition?.name ?? slug);
      setSeasons(liveData.seasons ?? []);
      if (!seasonLabel && liveData.season?.label) setSeasonLabel(liveData.season.label);
      setLiveResult(liveData.result as RugbyTableResult);
      setStandings([]);
      setPlayoffFixtures([]);
      setLoading(false);
      return;
    }

    // Fallback to synced standings when live calc has no rows.
    const res = await fetch(`/api/competitions/by-slug/${slug}/standings?${params}`);
    const data = await res.json();
    if (res.ok) {
      setCompetitionId(data.competition?.id ?? "");
      setCompetitionName(data.competition?.name ?? slug);
      setSeasons(data.seasons ?? []);
      if (!seasonLabel && data.season?.label) setSeasonLabel(data.season.label);
      const nextStandings = (data.standings ?? []).map((r: Record<string, unknown>) => ({
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
      }));

      // World Cup: always present pool tables even when falling back to synced standings.
      if (isRugbyWorldCupSlug(slug)) {
        const year = resolveRugbyWorldCupYear({
          seasonYear: data.season?.year,
          seasonLabel: data.season?.label ?? seasonLabel,
        });
        const pools = rugbyWorldCupPoolsForYear(year);
        if (pools.length) {
          const poolGroups = splitRowsIntoWorldCupPools(
            standingRowsToTableRows(nextStandings),
            pools,
          );
          setLiveResult({
            definition: { id: "live_table", name: "Live table", shortName: "Live" } as RugbyTableResult["definition"],
            available: true,
            confidence: "medium",
            dataCoveragePct: 100,
            rows: standingRowsToTableRows(nextStandings),
            poolGroups,
            formMatchCount: poolGroups[0]?.formSlots,
            warnings: [],
            fixtureCount: 0,
            evaluatedFixtureCount: 0,
            context: {},
            liveTableCalculationNote: "Pool standings from synced table (pool-stage).",
            showMovement: false,
          });
          setStandings([]);
          setPlayoffFixtures([]);
          setLoading(false);
          return;
        }
      }

      setLiveResult(null);
      setStandings(nextStandings);
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
    } else {
      setError(liveData.error ?? data.error ?? "Failed to load table");
      setLiveResult(null);
      setStandings([]);
    }
    setLoading(false);
  }, [slug, seasonLabel, view]);

  useEffect(() => {
    load().catch(() => {
      setError("Failed to load table");
      setLoading(false);
    });
  }, [load]);

  // Soft refresh while matches are live.
  useEffect(() => {
    if (!liveResult?.liveMatchCount) return;
    const id = window.setInterval(() => {
      load().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [liveResult?.liveMatchCount, load]);

  const tableLabHref = competitionId
    ? `/admin/tables/view?type=live-table&competitionId=${encodeURIComponent(competitionId)}`
    : "/admin/tables/view";

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
                {option === "overall" ? "Total" : option}
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
          {competitionName || slug} · {view === "overall" ? "Total" : view} standings
          {seasonLabel ? ` · ${seasonLabel}` : ""}
          {(liveResult?.liveMatchCount ?? 0) > 0 ? " · Live" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/competitions/${slug}/stats${seasonLabel ? `?season=${encodeURIComponent(seasonLabel)}` : ""}`}
            className="cms-btn cms-btn--secondary text-xs"
          >
            Player stats
          </Link>
          <Link href={tableLabHref} className="cms-btn cms-btn--secondary text-xs">
            Advanced tables
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading table…</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : liveResult ? (
        <CompetitionLiveTable
          rows={liveResult.rows}
          hemisphereGroups={liveResult.hemisphereGroups}
          poolGroups={liveResult.poolGroups}
          showMovement={
            liveResult.showMovement !== false && (liveResult.liveMatchCount ?? 0) > 0
          }
          liveMatchCount={liveResult.liveMatchCount}
          note={liveResult.liveTableCalculationNote ?? liveResult.filterSummary}
          formSlots={liveResult.formMatchCount}
        />
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
