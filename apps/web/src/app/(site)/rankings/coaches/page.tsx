import type { Metadata } from "next";
import Link from "next/link";
import { CoachPublicBreadcrumb } from "@/components/coaches/CoachPublicBreadcrumb";
import {
  MovementCell,
  RankNumber,
  RankingsAvatar,
  RankingsBoardFooter,
  RatingValue,
  VerifiedTick,
} from "@/components/rankings/RankingsBoardPrimitives";
import { listCoachWorldRankings } from "@/lib/coach-rating-service";

export const metadata: Metadata = {
  title: "Rugby365 World Coach Rankings | Rugby365",
  description:
    "Coaches ranked by Rugby365 Coach Rating — overall coach quality across eligible active coaches.",
};

export const dynamic = "force-dynamic";

export default async function WorldCoachRankingsPage() {
  let rankings: Awaited<ReturnType<typeof listCoachWorldRankings>> = [];
  try {
    rankings = await listCoachWorldRankings(10);
  } catch (err) {
    console.error("[rankings/coaches] failed to load rankings", err);
  }
  const rows = rankings.slice(0, 10);

  return (
    <article className="pr-player-v2">
      <div className="pr-player-v2__inner pr-rankings-page">
        <CoachPublicBreadcrumb
          items={[
            { label: "Rankings", href: "/rankings" },
            { label: "Coaches" },
          ]}
        />

        <div className="pr-rankings">
          <header className="pr-rankings__hero">
            <h1 className="pr-rankings__kicker">COACH RANKINGS</h1>
          </header>

          <div className="pr-rankings__title-row">
            <h2 className="pr-rankings__title">WORLD TOP 10 COACHES</h2>
            <div className="pr-rankings__title-tools">
              <label className="pr-rankings__top">
                <span className="sr-only">Board size</span>
                <select defaultValue="10" disabled>
                  <option value="10">Top 10</option>
                </select>
              </label>
            </div>
          </div>

          {rows.length === 0 ? (
            <section className="pr-rankings__empty">
              <p className="pr-rankings__empty-kicker">RANKINGS BUILDING</p>
              <p className="pr-rankings__empty-body">
                No ranking snapshots yet. Recalculate ratings in CMS.
              </p>
            </section>
          ) : (
            <section className="pr-rankings__board">
              <div className="pr-rankings__table-wrap">
                <table className="pr-rankings__table">
                  <thead>
                    <tr>
                      <th className="is-num">Rank</th>
                      <th>Coach</th>
                      <th>Team</th>
                      <th>Country</th>
                      <th className="is-num">R365 Rating /100</th>
                      <th className="is-num">Power</th>
                      <th className="is-num">Win Rate</th>
                      <th className="is-num">Big Match</th>
                      <th className="is-num">Dev</th>
                      <th>Movement (vs last week)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.coachId}>
                        <td className="is-num">
                          <RankNumber rank={row.rank} />
                        </td>
                        <td>
                          <Link href={`/coaches/${row.slug}`} className="pr-rankings__player">
                            <RankingsAvatar src={row.imageUrl} name={row.name} />
                            <span className="pr-rankings__player-name">{row.name}</span>
                            <VerifiedTick />
                          </Link>
                        </td>
                        <td>{row.currentTeamName ?? <span className="pr-rankings__dash">—</span>}</td>
                        <td>{row.nationality ?? <span className="pr-rankings__dash">—</span>}</td>
                        <td className="is-num">
                          <Link href={`/coaches/${row.slug}/rating`}>
                            <RatingValue value={row.rating} />
                          </Link>
                        </td>
                        <td className="pr-rankings__num is-num">
                          {row.powerIndex != null ? (
                            <Link href={`/coaches/${row.slug}/power-index`}>{row.powerIndex}</Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="pr-rankings__num is-num">{row.winRate ?? "—"}</td>
                        <td className="pr-rankings__num is-num">{row.bigMatch ?? "—"}</td>
                        <td className="pr-rankings__num is-num">{row.playerDevelopment ?? "—"}</td>
                        <td>
                          <MovementCell
                            rank={row.rank}
                            movement={
                              row.rankChange == null || row.rankChange === 0
                                ? "flat"
                                : row.rankChange > 0
                                  ? "up"
                                  : "down"
                            }
                            previousRank={row.previousRank}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <RankingsBoardFooter eligibilityNote="Rankings are calculated by the Rugby365 Coach Rating model. Top 10 active coaches by overall quality." />
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
