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
        <p className="stat-board__empty">
          {board.emptyMessage ?? "No data available for this season."}
        </p>
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
  const [seasons, setSeasons] = useState<CompetitionPlayerStatsPayload["seasons"]>([]);
  const [seasonLabel, setSeasonLabel] = useState(initialSeason ?? "");
  const [hemisphere, setHemisphere] = useState<HemisphereFilter>(initialHemisphere);
  const [showAdditional, setShowAdditional] = useState(true);
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
    if (json.seasons?.length) setSeasons(json.seasons);
    if (json.season?.label && json.season.label !== seasonLabel) {
      setSeasonLabel(json.season.label);
    }
    const advancedPrimaryEmpty = (json.boards ?? [])
      .filter((b) => ["tacklesCompleted", "metresCarried", "carries"].includes(b.metric))
      .every((b) => b.entries.length === 0);
    const additionalHasData = (json.additionalBoards ?? []).some((b) => b.entries.length > 0);
    if (advancedPrimaryEmpty && additionalHasData) setShowAdditional(true);
    setLoading(false);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (json.season?.label) url.searchParams.set("season", json.season.label);
      else url.searchParams.delete("season");
      if (hemisphere !== "all") url.searchParams.set("hemisphere", hemisphere);
      else url.searchParams.delete("hemisphere");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
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

  const seasonGroups = (() => {
    const groups = new Map<string, CompetitionPlayerStatsPayload["seasons"]>();
    for (const season of seasons) {
      const key = season.eraGroup ?? season.era ?? "Seasons";
      const list = groups.get(key) ?? [];
      list.push(season);
      groups.set(key, list);
    }
    return [...groups.entries()];
  })();

  return (
    <div className="competition-stats">
      <div className="cms-card mb-4 grid gap-3 sm:grid-cols-3">
        {data?.supportsHemisphereFilter ? (
          <label className="text-sm sm:col-span-2">
            <span className="block text-zinc-500 mb-1">Hemisphere</span>
            <div className="competition-stats__segment" role="group" aria-label="Hemisphere">
              {HEMISPHERE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHemisphere(option.value)}
                  className={`competition-stats__segment-btn${
                    hemisphere === option.value ? " is-active" : ""
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
            disabled={!seasons.length}
          >
            {!seasons.length ? (
              <option value="">No seasons</option>
            ) : seasonGroups.length > 1 ? (
              seasonGroups.map(([groupLabel, groupSeasons]) => (
                <optgroup key={groupLabel} label={groupLabel}>
                  {groupSeasons.map((season) => (
                    <option key={season.id} value={season.label}>
                      {season.displayLabel ?? season.label}
                      {season.isActive ? " (active)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))
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
          {data?.competition.name ?? slug}
          {data?.season?.era ? ` · ${data.season.era}` : ""}
          {data?.season?.label ? ` · ${data.season.label}` : ""}
          {data
            ? ` · ${data.coverage.playerCount} players · ${data.coverage.rowCount} ${
                data.coverage.source === "season_stats" ? "season rows" : "match rows"
              }`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/competitions/${slug}/team-stats${seasonLabel ? `?season=${encodeURIComponent(seasonLabel)}` : ""}`}
            className="cms-btn cms-btn--secondary text-xs"
          >
            Team stats
          </Link>
          <Link
            href={`/competitions/${slug}/table${seasonLabel ? `?season=${encodeURIComponent(seasonLabel)}` : ""}`}
            className="cms-btn cms-btn--secondary text-xs"
          >
            View table
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading player stats…</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : (
        <>
          {data?.estimationNote ? (
            <aside className="competition-stats__estimate-note mb-4" role="note">
              <strong>Estimated statistics</strong>
              <p>{data.estimationNote}</p>
            </aside>
          ) : null}
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
              No player statistics are available for this season yet. Historical seasons without
              imported season/match stats show empty leaderboards rather than falling back to another
              year.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
