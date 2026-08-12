import type { Metadata } from "next";
import Link from "next/link";
import { CoachPublicBreadcrumb } from "@/components/coaches/CoachPublicBreadcrumb";
import { listCoachWorldRankings } from "@/lib/coach-rating-service";

export const metadata: Metadata = {
  title: "Rugby365 World Coach Rankings | Rugby365",
  description:
    "Coaches ranked by Rugby365 Coach Rating — overall coach quality across eligible active coaches.",
};

export default async function WorldCoachRankingsPage() {
  const rankings = await listCoachWorldRankings(100);

  return (
    <article className="pr-coach-profile">
      <div className="pr-coach-inner">
        <CoachPublicBreadcrumb
          items={[
            { label: "Rankings", href: "/rankings" },
            { label: "Coaches" },
          ]}
        />

        <header className="pr-coach-inner__header">
          <p className="pr-coach-card__kicker m-0">RANKINGS</p>
          <h1 className="pr-coach-inner__title">Rugby365 World Coach Rankings</h1>
          <p className="pr-coach-inner__lede">
            Coaches ranked by Rugby365 Coach Rating (overall quality). Pool: {rankings.length}.{" "}
            <Link href="/coaches/power-index">See Power Index</Link> for current strength, or{" "}
            <Link href="/coaches/compare">compare coaches</Link>.
          </p>
        </header>

        <section className="pr-coach-card">
          {rankings.length === 0 ? (
            <p className="pr-coach-empty">No ranking snapshots yet. Recalculate ratings in CMS.</p>
          ) : (
            <div className="pr-coach-table-wrap">
              <table className="pr-coach-table pr-coach-table--dense">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Chg</th>
                    <th>Coach</th>
                    <th>Team</th>
                    <th>Country</th>
                    <th>Rating</th>
                    <th>Power</th>
                    <th>Win Rate</th>
                    <th>Big Match</th>
                    <th>Dev</th>
                    <th>Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((row) => (
                    <tr key={row.coachId}>
                      <td>{row.rank}</td>
                      <td>
                        {row.rankChange == null || row.rankChange === 0
                          ? "—"
                          : row.rankChange > 0
                            ? `↑${row.rankChange}`
                            : `↓${Math.abs(row.rankChange)}`}
                      </td>
                      <td>
                        <Link href={`/coaches/${row.slug}`}>{row.name}</Link>
                      </td>
                      <td>{row.currentTeamName ?? "—"}</td>
                      <td>{row.nationality ?? "—"}</td>
                      <td>
                        <Link href={`/coaches/${row.slug}/rating`}>
                          {row.rating.toFixed(1)}
                        </Link>
                      </td>
                      <td>
                        {row.powerIndex != null ? (
                          <Link href={`/coaches/${row.slug}/power-index`}>
                            {row.powerIndex}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{row.winRate ?? "—"}</td>
                      <td>{row.bigMatch ?? "—"}</td>
                      <td>{row.playerDevelopment ?? "—"}</td>
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
