"use client";

import Link from "next/link";
import { PlayerRatingHistoryChart } from "@/components/players/PlayerRatingHistoryChart";
import { buildRatingExplanation } from "@/lib/player-rating-service";
import type { PublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

export function PublicPlayerRatingV2({ overview }: { overview: PublicPlayerOverviewV2 }) {
  const history = overview.ratingHistory;
  const current = overview.rating.current;
  const previous =
    history.length >= 2 ? history[history.length - 2]!.overall : history.length === 1 ? null : null;
  const latest = history.length ? history[history.length - 1]! : null;
  const change =
    latest?.change ??
    (current != null && previous != null ? Math.round((current - previous) * 10) / 10 : null);
  const highs = history.map((h) => h.overall);
  const highest = highs.length ? Math.max(...highs) : current;
  const lowest = highs.length ? Math.min(...highs) : current;

  const last5 = history.slice(-5);
  const last5Vals = last5.map((h) => h.overall);
  const formAvg =
    last5Vals.length > 0
      ? Math.round((last5Vals.reduce((s, v) => s + v, 0) / last5Vals.length) * 10) / 10
      : null;
  const formBest = last5Vals.length ? Math.max(...last5Vals) : null;
  const formWorst = last5Vals.length ? Math.min(...last5Vals) : null;

  const i = overview.intelligence;
  const breakdown: Array<{ key: string; label: string; value: number | null }> = [
    { key: "attack", label: "Attack", value: latest?.attack ?? i.attack },
    { key: "defence", label: "Defence", value: latest?.defence ?? i.defence },
    { key: "kicking", label: "Kicking", value: latest?.kicking ?? i.kicking },
    { key: "playmaking", label: "Playmaking", value: latest?.playmaking ?? i.playmaking },
    { key: "physical", label: "Physical", value: latest?.physical ?? i.physical },
    {
      key: "gameManagement",
      label: "Decision Making",
      value: latest?.gameManagement ?? i.gameManagement,
    },
    { key: "form", label: "Form / Impact", value: latest?.form ?? i.form },
  ];

  const explanation = buildRatingExplanation({
    displayRating: current,
    calculatedRating: current,
    formScore: overview.rating.formScore0to10,
    formMovement: overview.rating.trend,
    attackRating: i.attack,
    defenceRating: i.defence,
    teamImportance: null,
    ratingConfidence: (i.confidence ?? 0) / 100,
    manualOverrideRating: null,
    lastFiveMatchRatings: last5Vals.slice().reverse(),
    badges: overview.badges.map((b) => ({
      key: b.key,
      label: b.label,
      description: b.label,
    })),
  });

  const impactRows = [...history].reverse().slice(0, 12);

  return (
    <>
      <header>
        <p className="pr-player-v2__kicker">Player rating</p>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
          {overview.displayName} · {current != null ? current.toFixed(1) : "—"} OVR
        </h1>
        <p className="pr-player-v2__note">
          {overview.classification.label}
          {overview.classification.stars > 0
            ? ` · ${overview.classification.stars.toFixed(1)} / 5 stars`
            : ""}
        </p>
      </header>

      <div className="pr-player-v2__row--2">
        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Rating Breakdown</h2>
          </div>
          <div className="pr-player-v2__table-wrap">
            <table className="pr-player-v2__table">
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.value != null ? row.value.toFixed(1) : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Rating Change</h2>
          </div>
          <ul className="pr-player-v2__kv-list">
            <li>
              <span>Current Rating</span>
              <strong>{fmt(current)}</strong>
            </li>
            <li>
              <span>Previous Rating</span>
              <strong>{fmt(previous)}</strong>
            </li>
            <li>
              <span>Change</span>
              <strong>
                {change == null ? "—" : change > 0 ? `+${fmt(change)}` : fmt(change)}
              </strong>
            </li>
            <li>
              <span>Highest Rating</span>
              <strong>{fmt(highest)}</strong>
            </li>
            <li>
              <span>Lowest Rating</span>
              <strong>{fmt(lowest)}</strong>
            </li>
          </ul>
        </div>
      </div>

      <div className="pr-player-v2__row--2">
        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Recent Form</h2>
          </div>
          <ul className="pr-player-v2__kv-list">
            <li>
              <span>Last 5 matches</span>
              <strong>
                {last5Vals.length
                  ? last5Vals.map((v) => v.toFixed(1)).join(" → ")
                  : "—"}
              </strong>
            </li>
            <li>
              <span>Average rating</span>
              <strong>{fmt(formAvg)}</strong>
            </li>
            <li>
              <span>Best rating</span>
              <strong>{fmt(formBest)}</strong>
            </li>
            <li>
              <span>Worst rating</span>
              <strong>{fmt(formWorst)}</strong>
            </li>
          </ul>
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Why {current != null ? current.toFixed(1) : "—"}?</h2>
          </div>
          <p className="pr-player-v2__scout-text">{explanation || "Not enough verified match data yet."}</p>
        </div>
      </div>

      <div className="pr-player-v2__card">
        <div className="pr-player-v2__card-head">
          <h2>Rating History</h2>
          <Link href={`/players/${overview.slug}/performance`} className="pr-player-v2__note">
            Performance →
          </Link>
        </div>
        <PlayerRatingHistoryChart points={history} />
      </div>

      <div className="pr-player-v2__card">
        <div className="pr-player-v2__card-head">
          <h2>Match Impact</h2>
        </div>
        {impactRows.length === 0 ? (
          <p className="pr-player-v2__empty">No rated matches recorded yet.</p>
        ) : (
          <div className="pr-player-v2__table-wrap">
            <table className="pr-player-v2__table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">Comp</th>
                  <th scope="col">Overall</th>
                  <th scope="col">Change</th>
                  <th scope="col">Attack</th>
                  <th scope="col">Defence</th>
                  <th scope="col">Kicking</th>
                  <th scope="col">Playmaking</th>
                </tr>
              </thead>
              <tbody>
                {impactRows.map((r, idx) => (
                  <tr key={`${r.date}-${idx}`}>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.opponentName ?? "—"}</td>
                    <td>{r.competitionName ?? "—"}</td>
                    <td>{r.overall.toFixed(1)}</td>
                    <td>
                      {r.change != null
                        ? r.change > 0
                          ? `+${r.change.toFixed(1)}`
                          : r.change.toFixed(1)
                        : "—"}
                    </td>
                    <td>{r.attack != null ? r.attack.toFixed(1) : "—"}</td>
                    <td>{r.defence != null ? r.defence.toFixed(1) : "—"}</td>
                    <td>{r.kicking != null ? r.kicking.toFixed(1) : "—"}</td>
                    <td>{r.playmaking != null ? r.playmaking.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
