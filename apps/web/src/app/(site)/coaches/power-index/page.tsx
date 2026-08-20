import type { Metadata } from "next";
import Link from "next/link";
import { CoachPublicBreadcrumb } from "@/components/coaches/CoachPublicBreadcrumb";
import { listCoachPowerIndexRankings } from "@/lib/coach-rating-service";

export const metadata: Metadata = {
  title: "Rugby365 Coach Power Index | Rugby365",
  description:
    "Who are the strongest coaches right now? Ranked by Rugby365 Coach Power Index — current strength, not overall career quality.",
};

export default async function CoachPowerIndexLeaderboardPage() {
  const rows = await listCoachPowerIndexRankings(100);
  const updatedLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="pr-coach-profile">
      <div className="pr-coach-inner">
        <CoachPublicBreadcrumb
          items={[
            { label: "Coaches", href: "/rankings/coaches" },
            { label: "Power Index" },
          ]}
        />

        <header className="pr-coach-inner__header">
          <p className="pr-coach-card__kicker m-0">RUGBY365 COACH POWER INDEX</p>
          <h1 className="pr-coach-inner__title">Current Coaching Strength</h1>
          <p className="pr-coach-inner__lede">
            Power Index measures recent coaching strength using results, form and Rugby365 Coach
            Intelligence. Updated {updatedLabel}.
          </p>
          <p className="pr-coach-inner__lede">
            Looking for overall quality rankings?{" "}
            <Link href="/rankings/coaches">World Coach Rankings</Link>
          </p>
        </header>

        <section className="pr-coach-card">
          {rows.length === 0 ? (
            <p className="pr-coach-empty">
              No Power Index snapshots yet. Recalculate ratings in CMS.
            </p>
          ) : (
            <div className="pr-coach-table-wrap">
              <table className="pr-coach-table pr-coach-table--dense">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Coach</th>
                    <th>Team</th>
                    <th>Power Index</th>
                    <th>Change</th>
                    <th>Results</th>
                    <th>Attack</th>
                    <th>Defence</th>
                    <th>Set Piece</th>
                    <th>Selection</th>
                    <th>Form</th>
                    <th>Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.coachId}>
                      <td>{row.rank}</td>
                      <td>
                        <Link href={`/coaches/${row.slug}`}>{row.name}</Link>
                        <div className="pr-coach-table__sublinks">
                          <Link href={`/coaches/${row.slug}/power-index`}>Power</Link>
                          {" · "}
                          <Link href={`/coaches/${row.slug}/rating`}>Rating</Link>
                        </div>
                      </td>
                      <td>{row.currentTeamName ?? "—"}</td>
                      <td>
                        <Link href={`/coaches/${row.slug}/power-index`}>
                          {row.powerIndex}
                        </Link>
                      </td>
                      <td>
                        {row.powerIndexChange == null || row.powerIndexChange === 0
                          ? "—"
                          : row.powerIndexChange > 0
                            ? `↑${row.powerIndexChange}`
                            : `↓${Math.abs(row.powerIndexChange)}`}
                      </td>
                      <td>{row.results ?? "—"}</td>
                      <td>{row.attack ?? "—"}</td>
                      <td>{row.defence ?? "—"}</td>
                      <td>{row.setPiece ?? "—"}</td>
                      <td>{row.selection ?? "—"}</td>
                      <td>{row.currentForm ?? "—"}</td>
                      <td>{row.confidence != null ? `${row.confidence}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
