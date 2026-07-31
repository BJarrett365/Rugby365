"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DevelopmentTimelinePoint } from "@/lib/player-development-timeline-utils";
import {
  buildSeasonDevelopmentRows,
  ratingDisplayLabel,
  resolveAppearanceStatus,
} from "@/lib/player-development-timeline-utils";

const PlayerDevelopmentTimeline = dynamic(
  () =>
    import("@/components/players/PlayerDevelopmentTimeline").then((m) => ({
      default: m.PlayerDevelopmentTimeline,
    })),
  {
    ssr: false,
    loading: () => <p className="text-zinc-500 text-sm">Loading performance graph…</p>,
  },
);

type Strip = {
  careerRating: number | null;
  seasonMatchAverage: number | null;
  formRating: number | null;
  formLabel: string;
  latestMatchRating: number | null;
  ratedAppearances: number;
  dnpCount: number;
};

type RankingPoint = {
  seasonSlug: string;
  seasonLabel: string;
  average: number | null;
  ratedAppearances: number;
  dnpCount: number;
  changeFromPrevious: number | null;
};

type HistoryPayload = {
  playerId: string;
  playerName: string;
  strip: Strip;
  timeline: DevelopmentTimelinePoint[];
  seasonRows: ReturnType<typeof buildSeasonDevelopmentRows>;
  rankingOverTime: RankingPoint[];
  currentDomesticSlug: string;
  careerAverage: number | null;
};

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function SeasonRankingSparkline({ points }: { points: RankingPoint[] }) {
  const rated = points.filter((p) => p.average != null);
  if (rated.length < 2) {
    return (
      <p className="text-sm text-zinc-500 m-0">
        Need at least two seasons with rated matches to chart ranking over time.
      </p>
    );
  }

  const width = 560;
  const height = 120;
  const pad = 16;
  const values = rated.map((p) => p.average as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);

  const coords = rated.map((p, i) => {
    const x = pad + (i / Math.max(rated.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (((p.average as number) - min) / span) * (height - pad * 2);
    return { x, y, p };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Season match rating averages over time"
      className="w-full max-w-xl h-auto"
    >
      <path d={path} fill="none" stroke="#34d399" strokeWidth="2.5" />
      {coords.map((c) => (
        <g key={c.p.seasonSlug}>
          <circle cx={c.x} cy={c.y} r={4} fill="#34d399" />
          <text
            x={c.x}
            y={height - 2}
            textAnchor="middle"
            className="fill-zinc-500"
            style={{ fontSize: 9 }}
          >
            {c.p.seasonLabel.replace(/^20/, "")}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function PlayerMatchRatingsPanel({
  playerId,
  playerSlug,
  playerName,
}: {
  playerId: string;
  playerSlug?: string | null;
  playerName?: string | null;
}) {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/players/${playerId}/match-ratings`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Failed to load");
        return body as HistoryPayload;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const publicPath = playerSlug ? `/players/${playerSlug}` : null;

  return (
    <div className="cms-card mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold m-0">Match ratings &amp; season ranking</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Match ratings (1–10) per recorded appearance, season averages for ranking over time, and
            DNP when they did not play. Career rating stays on the 35–99 scale.
          </p>
        </div>
        {publicPath ? (
          <Link href={publicPath} className="text-xs text-emerald-400">
            Public profile
          </Link>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-zinc-500">Loading ratings…</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {data ? (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <StatChip
              label="Career"
              value={data.strip.careerRating != null ? String(data.strip.careerRating) : "—"}
              hint="35–99 overall"
            />
            <StatChip
              label="Season avg"
              value={fmt(data.strip.seasonMatchAverage)}
              hint="Match ratings this season"
            />
            <StatChip
              label="Form"
              value={data.strip.formLabel}
              hint="Recent match ratings"
            />
            <StatChip
              label="Latest"
              value={fmt(data.strip.latestMatchRating)}
              hint="Most recent rated match"
            />
            <StatChip
              label="Rated / DNP"
              value={`${data.strip.ratedAppearances} / ${data.strip.dnpCount}`}
              hint="Appearances with a score vs did not play"
            />
          </div>

          <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">
              Ranking over time (season match averages)
            </h4>
            <SeasonRankingSparkline points={data.rankingOverTime} />
            {data.seasonRows.length > 0 ? (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 pr-3">Season</th>
                      <th className="py-2 pr-3">Rated</th>
                      <th className="py-2 pr-3">DNP</th>
                      <th className="py-2 pr-3">Avg</th>
                      <th className="py-2 pr-3">High</th>
                      <th className="py-2 pr-3">Low</th>
                      <th className="py-2 pr-3">Δ prev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.seasonRows.map((r) => (
                      <tr key={r.seasonSlug} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-3 text-zinc-200">{r.seasonLabel}</td>
                        <td className="py-2 pr-3 text-zinc-400">{r.ratedAppearances}</td>
                        <td className="py-2 pr-3 text-zinc-400">{r.dnpCount}</td>
                        <td className="py-2 pr-3 text-emerald-400 font-mono">{fmt(r.average)}</td>
                        <td className="py-2 pr-3 font-mono text-zinc-400">{fmt(r.highest)}</td>
                        <td className="py-2 pr-3 font-mono text-zinc-400">{fmt(r.lowest)}</td>
                        <td className="py-2 pr-3 font-mono text-zinc-500">
                          {r.changeFromPrevious == null
                            ? "—"
                            : r.changeFromPrevious > 0
                              ? `+${fmt(r.changeFromPrevious)}`
                              : fmt(r.changeFromPrevious)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="mb-4 pr-dev-timeline-admin">
            <PlayerDevelopmentTimeline
              playerName={playerName || data.playerName}
              points={data.timeline}
              currentDomesticSlug={data.currentDomesticSlug}
              careerAverage={data.careerAverage}
              settings={{
                enabled: true,
                showRollingAverage: true,
                showSeasonAverage: true,
                showCareerAverage: false,
                minMinutes: 0,
              }}
              basePath={`/admin/players/${playerId}/edit`}
              initialSeason="all"
            />
          </div>

          <h4 className="text-sm font-medium text-zinc-300 m-0 mb-2">Recent match log</h4>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Opponent</th>
                  <th className="py-2 pr-3">Season</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Min</th>
                  <th className="py-2 pr-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {[...data.timeline]
                  .reverse()
                  .slice(0, 40)
                  .map((p) => {
                    const status =
                      p.appearanceStatus ??
                      resolveAppearanceStatus({
                        rating: p.rating,
                        minutes: p.minutes,
                        started: p.started,
                      });
                    return (
                      <tr key={`${p.fixtureId}-${status}`} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                          {p.fixtureSlug ? (
                            <Link
                              href={`/admin/matches/${p.fixtureId}/edit`}
                              className="text-emerald-400"
                            >
                              {p.date?.slice(0, 10) ?? "Match"}
                            </Link>
                          ) : (
                            p.date?.slice(0, 10) ?? "—"
                          )}
                        </td>
                        <td className="py-2 pr-3 text-zinc-300">{p.opponentName ?? "—"}</td>
                        <td className="py-2 pr-3 text-zinc-500">{p.seasonLabel ?? "—"}</td>
                        <td className="py-2 pr-3 text-zinc-500">
                          {status === "not_selected"
                            ? "Out"
                            : status === "unused_bench"
                              ? "Bench DNP"
                              : p.started
                                ? "Start"
                                : p.started === false
                                  ? "Bench"
                                  : "—"}
                        </td>
                        <td className="py-2 pr-3 text-zinc-500">{p.minutes ?? "—"}</td>
                        <td
                          className={`py-2 pr-3 font-mono ${
                            p.rating != null ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        >
                          {ratingDisplayLabel(p.rating, status)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 min-w-[7rem]"
      title={hint}
    >
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-semibold text-zinc-100 font-mono leading-tight">{value}</div>
    </div>
  );
}
