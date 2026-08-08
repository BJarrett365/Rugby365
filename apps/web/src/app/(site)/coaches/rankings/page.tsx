import type { Metadata } from "next";
import Link from "next/link";
import { listCoachWorldRankings } from "@/lib/coach-rating-service";

export const metadata: Metadata = {
  title: "Coach rankings | Rugby365",
  description: "World coach rankings by Rugby365 power index and rating model.",
};

export default async function CoachRankingsPage() {
  const rankings = await listCoachWorldRankings(50);

  return (
    <article className="pr-coach-profile">
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Coach platform</p>
          <h1 className="m-0 text-2xl font-bold">World coach rankings</h1>
          <p className="text-sm text-[var(--cp-muted,#9ca3af)] mt-1 mb-0">
            Based on latest rating snapshots.{" "}
            <Link href="/coaches/compare">Compare coaches</Link>
          </p>
        </header>

        <section className="pr-coach-card">
          {rankings.length === 0 ? (
            <p className="pr-coach-empty">No ranking snapshots yet. Recalculate ratings in CMS.</p>
          ) : (
            <table className="pr-coach-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Coach</th>
                  <th>Nationality</th>
                  <th>Rating</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((row) => (
                  <tr key={row.coachId}>
                    <td>{row.rank}</td>
                    <td>
                      <Link href={`/coaches/${row.slug}`}>{row.name}</Link>
                    </td>
                    <td>{row.nationality ?? "—"}</td>
                    <td>{row.rating.toFixed(1)}</td>
                    <td>
                      {row.movement != null
                        ? row.movement > 0
                          ? `+${row.movement.toFixed(1)}`
                          : row.movement.toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </article>
  );
}
