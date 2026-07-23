"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MediaImage } from "@/components/media/MediaImage";
import { formatLeaderboardPlayerName } from "@/lib/competition-player-stat-display";
import type {
  CompetitionLeaderboardBoard,
  CompetitionPlayerStatsPayload,
  HemisphereFilter,
} from "@/lib/competition-player-leaderboards-service";

const HEMISPHERE_OPTIONS: Array<{ value: HemisphereFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "northern", label: "North" },
  { value: "southern", label: "South" },
];

const PREVIEW_LIMIT = 5;

function LeaderboardCard({
  board,
  expanded,
  onToggle,
}: {
  board: CompetitionLeaderboardBoard;
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = expanded ? board.entries : board.entries.slice(0, PREVIEW_LIMIT);
  const canExpand = board.entries.length > PREVIEW_LIMIT;

  return (
    <article className="stat-board">
      <header className="stat-board__header">
        <h3 className="stat-board__title">
          <span className="stat-board__mark" aria-hidden />
          {board.label}
        </h3>
        <span className="stat-board__metric">{board.valueLabel}</span>
      </header>

      {board.entries.length === 0 ? (
        <p className="stat-board__empty">No data yet for this leaderboard.</p>
      ) : (
        <ol className="stat-board__list">
          {visible.map((entry) => (
            <li
              key={`${board.metric}-${entry.playerId}-${entry.teamId}`}
              className="stat-board__row"
            >
              <span
                className={`stat-board__rank${entry.rank <= 3 ? " stat-board__rank--podium" : ""}`}
              >
                {entry.rank}
              </span>
              <span className="stat-board__avatar">
                {entry.playerImageUrl ? (
                  <MediaImage
                    src={entry.playerImageUrl}
                    alt={entry.playerName}
                    width={40}
                    height={40}
                    className="stat-board__avatar-img"
                  />
                ) : (
                  <span className="stat-board__avatar-fallback" aria-hidden>
                    {formatLeaderboardPlayerName(entry.playerName).charAt(0)}
                  </span>
                )}
              </span>
              <span className="stat-board__identity">
                <Link href={`/players/${entry.playerSlug}`} className="stat-board__name">
                  {formatLeaderboardPlayerName(entry.playerName)}
                </Link>
                <span className="stat-board__team">{entry.teamCode}</span>
              </span>
              <strong className="stat-board__value">{entry.value}</strong>
            </li>
          ))}
        </ol>
      )}

      {canExpand ? (
        <button type="button" className="stat-board__more" onClick={onToggle}>
          {expanded ? "Show less" : "See more →"}
        </button>
      ) : null}
    </article>
  );
}

export function CompetitionPlayerStatsClient({
  slug,
  initialSeason,
  initialHemisphere = "all",
}: {
  slug: string;
  initialSeason?: string;
  initialHemisphere?: HemisphereFilter;
}) {
  const [data, setData] = useState<CompetitionPlayerStatsPayload | null>(null);
  const [seasonLabel, setSeasonLabel] = useState(initialSeason ?? "");
  const [hemisphere, setHemisphere] = useState<HemisphereFilter>(initialHemisphere);
  const [showAdditional, setShowAdditional] = useState(false);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "15" });
    if (seasonLabel) params.set("season", seasonLabel);
    if (hemisphere !== "all") params.set("hemisphere", hemisphere);
    const res = await fetch(`/api/competitions/by-slug/${slug}/player-stats?${params}`);
    const json = (await res.json()) as CompetitionPlayerStatsPayload & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load player stats");
      setData(null);
      setLoading(false);
      return;
    }
    setData(json);
    if (!seasonLabel && json.season?.label) setSeasonLabel(json.season.label);
    setLoading(false);
  }, [slug, seasonLabel, hemisphere]);

  useEffect(() => {
    load().catch(() => {
      setError("Failed to load player stats");
      setLoading(false);
    });
  }, [load]);

  function toggleBoard(metric: string) {
    setExpandedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  }

  return (
    <div>
      <div className="cms-card mb-4 grid gap-3 sm:grid-cols-3">
        {data?.supportsHemisphereFilter ? (
          <label className="text-sm sm:col-span-2">
            <span className="block text-zinc-500 mb-1">Hemisphere</span>
            <div className="inline-flex w-full rounded-lg border border-zinc-800 overflow-hidden text-sm">
              {HEMISPHERE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHemisphere(option.value)}
                  className={`flex-1 px-3 py-2 touch-target ${
                    hemisphere === option.value
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </label>
        ) : (
          <div className="sm:col-span-2 text-sm text-zinc-500 self-end pb-2">
            Player leaders across the selected season.
          </div>
        )}
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Season</span>
          <select
            className="cms-input w-full"
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
            disabled={!data?.seasons?.length}
          >
            {!data?.seasons?.length ? (
              <option value="">No seasons</option>
            ) : (
              data.seasons.map((season) => (
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
          {data?.competition.name ?? slug}
          {data?.season?.label ? ` · ${data.season.label}` : ""}
          {data
            ? ` · ${data.coverage.playerCount} players · ${data.coverage.rowCount} match rows`
            : ""}
        </p>
        <Link
          href={`/competitions/${slug}/table${seasonLabel ? `?season=${encodeURIComponent(seasonLabel)}` : ""}`}
          className="cms-btn cms-btn--secondary text-xs"
        >
          View table
        </Link>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading player stats…</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : (
        <>
          <div className="stat-board-grid mb-6">
            {(data?.boards ?? []).map((board) => (
              <LeaderboardCard
                key={board.metric}
                board={board}
                expanded={expandedBoards.has(board.metric)}
                onToggle={() => toggleBoard(board.metric)}
              />
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold m-0">More top stats</h2>
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs"
              onClick={() => setShowAdditional((open) => !open)}
            >
              {showAdditional ? "Hide" : "Show"}
            </button>
          </div>
          {showAdditional ? (
            <div className="stat-board-grid">
              {(data?.additionalBoards ?? []).map((board) => (
                <LeaderboardCard
                  key={board.metric}
                  board={board}
                  expanded={expandedBoards.has(board.metric)}
                  onToggle={() => toggleBoard(board.metric)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 m-0">
              Also available: defenders beaten, clean breaks, turnovers won, dominant tackles, and
              post-contact metres.
            </p>
          )}

          {data && data.coverage.rowCount === 0 ? (
            <p className="text-sm text-amber-400 mt-4">
              No player match stats imported for this season yet. Enrich finished matches from Planet
              Rugby / SDMS to populate these boards.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
