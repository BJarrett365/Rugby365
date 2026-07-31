"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MediaImage } from "@/components/media/MediaImage";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { formatLeaderboardPlayerName } from "@/lib/competition-player-stat-display";
import type {
  CompetitionCoachRankingRow,
  CompetitionPlayerPositionBoard,
  CompetitionRankingsPayload,
  CompetitionRefereeRankingRow,
  CompetitionTeamRankingRow,
} from "@/lib/competition-rankings-service";

type Tab = "players" | "teams" | "referees" | "coaches";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
  { id: "referees", label: "Referees" },
  { id: "coaches", label: "Coaches" },
];

function Trend({ trend }: { trend: string }) {
  const label =
    trend === "up" ? "↑" : trend === "down" ? "↓" : trend === "provisional" ? "P" : "–";
  return (
    <span className={`ranking-trend ranking-trend--${trend}`} title={trend}>
      {label}
    </span>
  );
}

function PlayerBoards({ boards }: { boards: CompetitionPlayerPositionBoard[] }) {
  if (!boards.length) {
    return <p className="text-sm text-zinc-500">No rated player appearances for this season yet.</p>;
  }
  return (
    <div className="stat-board-grid">
      {boards.map((board) => (
        <article key={board.positionGroup} className="stat-board">
          <header className="stat-board__header">
            <h3 className="stat-board__title">
              <span className="stat-board__mark" aria-hidden />
              {board.label}
            </h3>
            <span className="stat-board__metric">RTG</span>
          </header>
          <ol className="stat-board__list">
            {board.entries.map((entry) => (
              <li key={`${board.positionGroup}-${entry.playerId}`} className="stat-board__row">
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
                    {entry.provisional ? " *" : ""}
                  </Link>
                  <span className="stat-board__team">
                    {entry.teamCode ?? "—"}
                    {entry.teamRank != null ? ` · #${entry.teamRank}` : ""}
                  </span>
                </span>
                <strong className="stat-board__value">
                  {entry.avgRating.toFixed(1)}
                  <Trend trend={entry.trend} />
                </strong>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

function TeamsTable({ rows }: { rows: CompetitionTeamRankingRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500">No finished matches for a team ranking yet.</p>;
  }
  return (
    <div className="cms-card overflow-x-auto">
      <table className="cms-table w-full text-sm">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>PD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>{row.rank}</td>
              <td>
                <Link href={`/teams/${row.teamSlug}`} className="inline-flex items-center gap-2">
                  <TeamCrest name={row.teamName} imageUrl={row.teamImageUrl} size="xs" />
                  <span>
                    {row.teamName} <span className="text-zinc-500">{row.teamCode}</span>
                  </span>
                </Link>
              </td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.draw}</td>
              <td>{row.lost}</td>
              <td>{row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}</td>
              <td>
                <strong>{row.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefereesTable({ rows }: { rows: CompetitionRefereeRankingRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-zinc-500">
        No referee match ratings for this season yet. Ratings appear after full-time calculation.
      </p>
    );
  }
  return (
    <div className="cms-card overflow-x-auto">
      <table className="cms-table w-full text-sm">
        <thead>
          <tr>
            <th>#</th>
            <th>Referee</th>
            <th>M</th>
            <th>Avg</th>
            <th>Tournament</th>
            <th>Best</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.refereeId} className={row.provisional ? "opacity-80" : undefined}>
              <td>{row.rank}</td>
              <td>
                <Link href={`/referees/${row.refereeSlug}`}>
                  {row.refereeName}
                  {row.provisional ? " (provisional)" : ""}
                </Link>
              </td>
              <td>{row.matches}</td>
              <td>{row.avgRating.toFixed(1)}</td>
              <td>
                <strong>{row.tournamentRating.toFixed(1)}</strong>
              </td>
              <td>{row.bestRating.toFixed(1)}</td>
              <td>
                <Trend trend={row.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoachesTable({ rows }: { rows: CompetitionCoachRankingRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-zinc-500">
        No coach match ratings for this season yet. Ratings appear after full-time calculation.
      </p>
    );
  }
  return (
    <div className="cms-card overflow-x-auto">
      <table className="cms-table w-full text-sm">
        <thead>
          <tr>
            <th>#</th>
            <th>Coach</th>
            <th>Team</th>
            <th>M</th>
            <th>W</th>
            <th>Win%</th>
            <th>Rating</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.coachId} className={row.provisional ? "opacity-80" : undefined}>
              <td>{row.rank}</td>
              <td>
                <Link href={`/coaches/${row.coachSlug}`}>
                  {row.coachName}
                  {row.provisional ? " (provisional)" : ""}
                </Link>
              </td>
              <td>
                {row.teamSlug ? (
                  <Link href={`/teams/${row.teamSlug}`}>{row.teamCode ?? row.teamName}</Link>
                ) : (
                  (row.teamCode ?? "—")
                )}
              </td>
              <td>{row.matches}</td>
              <td>{row.wins}</td>
              <td>{row.winRate}%</td>
              <td>
                <strong>{row.tournamentRating.toFixed(1)}</strong>
              </td>
              <td>
                <Trend trend={row.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompetitionRankingsClient({
  slug,
  initialSeason,
}: {
  slug: string;
  initialSeason?: string;
}) {
  const [data, setData] = useState<CompetitionRankingsPayload | null>(null);
  const [seasonLabel, setSeasonLabel] = useState(initialSeason ?? "");
  const [tab, setTab] = useState<Tab>("players");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "12" });
    if (seasonLabel) params.set("season", seasonLabel);
    const res = await fetch(`/api/competitions/by-slug/${slug}/rankings?${params}`);
    const json = (await res.json()) as CompetitionRankingsPayload & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load rankings");
      setData(null);
      setLoading(false);
      return;
    }
    setData(json);
    if (!seasonLabel && json.season?.label) setSeasonLabel(json.season.label);
    setLoading(false);
  }, [slug, seasonLabel]);

  useEffect(() => {
    load().catch(() => {
      setError("Failed to load rankings");
      setLoading(false);
    });
  }, [load]);

  return (
    <div className="competition-stats">
      <div className="cms-card mb-4 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2 text-sm text-zinc-500 self-end pb-2">
          Competition rankings use Rugby365 match ratings within this tournament only.{" "}
          <Link href="/rankings" className="text-inherit underline-offset-2 hover:underline">
            World team rankings →
          </Link>
        </div>
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

      <div className="competition-stats__segment mb-4" role="tablist" aria-label="Ranking type">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`competition-stats__segment-btn${tab === item.id ? " is-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading rankings…</p>
      ) : error ? (
        <p className="text-sm text-amber-400">{error}</p>
      ) : (
        <>
          <p className="text-sm text-zinc-500 mb-4">
            {tab === "players" ? data?.notes.players : null}
            {tab === "referees" ? data?.notes.referees : null}
            {tab === "coaches" ? data?.notes.coaches : null}
            {tab === "teams"
              ? "Simple points table from finished matches in this competition season (4 for a win, 2 for a draw)."
              : null}
          </p>
          {tab === "players" ? <PlayerBoards boards={data?.playersByPosition ?? []} /> : null}
          {tab === "teams" ? <TeamsTable rows={data?.teams ?? []} /> : null}
          {tab === "referees" ? <RefereesTable rows={data?.referees ?? []} /> : null}
          {tab === "coaches" ? <CoachesTable rows={data?.coaches ?? []} /> : null}
          <p className="text-xs text-zinc-600 mt-4 m-0">
            * Provisional — fewer than two rated matches. Coverage:{" "}
            {data?.coverage.playerRatedMatches ?? 0} player ·{" "}
            {data?.coverage.refereeRatedMatches ?? 0} referee ·{" "}
            {data?.coverage.coachRatedMatches ?? 0} coach match ratings.
          </p>
        </>
      )}
    </div>
  );
}
