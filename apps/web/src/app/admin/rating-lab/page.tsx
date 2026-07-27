"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EntityTab = "players" | "coaches" | "referees";

type PlayerLabRow = {
  id: string;
  fixtureId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  fixtureSlug: string;
  kickoffAt: string | null;
  rating: number | null;
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: string | null;
  selectionPreviousRole: string | null;
  selectionCurrentRole: string | null;
  selectionTrend: string | null;
  selectionBadge: string | null;
  minutesPlayed: number;
  ratingStatus: string;
  isRugby365Potm: boolean;
  flags: string[];
};

type StaffLabRow = {
  id: string;
  entityType: "coach" | "referee";
  fixtureId: string;
  entityId: string;
  entitySlug: string;
  entityName: string;
  teamName: string | null;
  side: string | null;
  fixtureSlug: string;
  kickoffAt: string | null;
  rating: number | null;
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: string | null;
  ratingStatus: string;
  modelVersion: string;
  flags: string[];
};

export default function RatingLabPage() {
  const [tab, setTab] = useState<EntityTab>("players");
  const [playerRows, setPlayerRows] = useState<PlayerLabRow[]>([]);
  const [staffRows, setStaffRows] = useState<StaffLabRow[]>([]);
  const [fixtureId, setFixtureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load(nextTab: EntityTab = tab) {
    setLoading(true);
    try {
      const entity = nextTab === "players" ? "players" : nextTab;
      const res = await fetch(`/api/admin/rating-lab?limit=120&entity=${entity}`);
      const data = await res.json();
      if (nextTab === "players") {
        setPlayerRows(data.rows ?? []);
      } else {
        setStaffRows(data.rows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when tab changes
  }, [tab]);

  async function recalculate() {
    if (!fixtureId.trim()) {
      setMessage("Enter a fixture ID");
      return;
    }
    setMessage("Calculating…");
    const res = await fetch("/api/admin/rating-lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: fixtureId.trim(), entity: "all" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed");
      return;
    }
    setMessage(
      `Players: ${data.calculated ?? 0}. Coaches: ${data.coachesCalculated ?? 0}. Referee: ${data.refereeCalculated ?? 0}. POTM: ${data.potmPlayerId ?? "—"}`,
    );
    await load(tab);
  }

  return (
    <div className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Insights</p>
          <h1 className="cms-page-title">Rating Lab</h1>
          <p className="cms-page-subtitle">
            Review Rugby365 Match Ratings for players, coaches, and referees after full time.
          </p>
        </div>
        <Link href="/admin/matches" className="cms-btn cms-btn--secondary">
          Matches
        </Link>
      </header>

      <section className="cms-card mb-4 p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-sm">
          Fixture ID
          <input
            className="cms-input"
            value={fixtureId}
            onChange={(e) => setFixtureId(e.target.value)}
            placeholder="uuid"
          />
        </label>
        <button type="button" className="cms-btn cms-btn--primary" onClick={() => void recalculate()}>
          Calculate all ratings
        </button>
        <button type="button" className="cms-btn cms-btn--secondary" onClick={() => void load(tab)}>
          Refresh
        </button>
        {message && <p className="text-sm text-zinc-400 w-full m-0">{message}</p>}
      </section>

      <div className="flex gap-2 mb-4">
        {(
          [
            ["players", "Players"],
            ["coaches", "Coaches"],
            ["referees", "Referees"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`cms-btn ${tab === id ? "cms-btn--primary" : "cms-btn--secondary"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : tab === "players" ? (
        <div className="overflow-x-auto">
          <table className="cms-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Player</th>
                <th>Rating</th>
                <th>Prev</th>
                <th>Δ</th>
                <th>Role</th>
                <th>Selection</th>
                <th>Mins</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((row) => (
                <tr key={row.id} className={row.flags.length ? "bg-amber-950/30" : undefined}>
                  <td>
                    <Link href={`/matches/${row.fixtureSlug}`} className="text-sky-400">
                      {row.kickoffAt ? new Date(row.kickoffAt).toLocaleDateString("en-GB") : row.fixtureSlug}
                    </Link>
                  </td>
                  <td>
                    {row.playerName}
                    <div className="text-xs text-zinc-500">{row.teamName}</div>
                    {row.isRugby365Potm && <div className="text-xs text-amber-400">POTM</div>}
                  </td>
                  <td>
                    {row.rating?.toFixed(1) ?? "—"}
                    {row.ratingStatus === "provisional" ? "*" : ""}
                  </td>
                  <td>{row.previousRating?.toFixed(1) ?? "—"}</td>
                  <td>
                    {row.ratingChange == null
                      ? "NEW"
                      : `${row.ratingChange > 0 ? "+" : ""}${row.ratingChange.toFixed(1)}`}
                  </td>
                  <td>
                    {(row.selectionPreviousRole ?? "—")} → {(row.selectionCurrentRole ?? "—")}
                  </td>
                  <td>{row.selectionBadge ?? row.selectionTrend ?? "—"}</td>
                  <td>{row.minutesPlayed}</td>
                  <td className="text-xs text-amber-300">{row.flags.join("; ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="cms-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>{tab === "coaches" ? "Coach" : "Referee"}</th>
                <th>Rating</th>
                <th>Prev</th>
                <th>Δ</th>
                <th>Model</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-zinc-500">
                    No {tab} ratings yet. Enter a completed fixture ID and calculate.
                  </td>
                </tr>
              ) : (
                staffRows.map((row) => (
                  <tr key={row.id} className={row.flags.length ? "bg-amber-950/30" : undefined}>
                    <td>
                      <Link href={`/matches/${row.fixtureSlug}`} className="text-sky-400">
                        {row.kickoffAt
                          ? new Date(row.kickoffAt).toLocaleDateString("en-GB")
                          : row.fixtureSlug}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={
                          row.entityType === "coach"
                            ? `/coaches/${row.entitySlug}`
                            : `/referees/${row.entitySlug}`
                        }
                        className="text-sky-400"
                      >
                        {row.entityName}
                      </Link>
                      {row.teamName ? (
                        <div className="text-xs text-zinc-500">
                          {row.teamName}
                          {row.side ? ` · ${row.side}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {row.rating?.toFixed(1) ?? "—"}
                      {row.ratingStatus === "provisional" ? "*" : ""}
                    </td>
                    <td>{row.previousRating?.toFixed(1) ?? "—"}</td>
                    <td>
                      {row.ratingChange == null
                        ? "NEW"
                        : `${row.ratingChange > 0 ? "+" : ""}${row.ratingChange.toFixed(1)}`}
                    </td>
                    <td className="text-xs text-zinc-500">{row.modelVersion}</td>
                    <td className="text-xs text-amber-300">{row.flags.join("; ") || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
