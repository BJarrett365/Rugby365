"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LabRow = {
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

export default function RatingLabPage() {
  const [rows, setRows] = useState<LabRow[]>([]);
  const [fixtureId, setFixtureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rating-lab?limit=120");
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function recalculate() {
    if (!fixtureId.trim()) {
      setMessage("Enter a fixture ID");
      return;
    }
    setMessage("Calculating…");
    const res = await fetch("/api/admin/rating-lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: fixtureId.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed");
      return;
    }
    setMessage(`Calculated ${data.calculated} ratings. POTM: ${data.potmPlayerId ?? "—"}`);
    await load();
  }

  return (
    <div className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Insights</p>
          <h1 className="cms-page-title">Rating Lab</h1>
          <p className="cms-page-subtitle">
            Review Rugby365 Match Ratings, performance trends, and selection movement.
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
          Calculate ratings
        </button>
        <button type="button" className="cms-btn cms-btn--secondary" onClick={() => void load()}>
          Refresh
        </button>
        {message && <p className="text-sm text-zinc-400 w-full m-0">{message}</p>}
      </section>

      {loading ? (
        <p>Loading…</p>
      ) : (
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
              {rows.map((row) => (
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
      )}
    </div>
  );
}
