import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { listWorldRankingFeeds } from "@/lib/world-rugby-rankings-service";

export const revalidate = 300;

export default async function WorldRankingsPage() {
  const feeds = await listWorldRankingFeeds();

  return (
    <div>
      <PageHeader
        eyebrow="International"
        title="World Rankings"
        description="Official World Rugby men’s and women’s team rankings. Player rankings live at /rankings/players. Competition player, coach and referee rankings live on each tournament page."
        actions={
          <>
            <Link href="/rankings/players" className="cms-btn cms-btn--secondary">
              Player Rankings
            </Link>
            <Link href="/competitions" className="cms-btn cms-btn--secondary">
              Competitions
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {feeds.map((feed) => (
          <section key={feed.category} className="cms-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold m-0">{feed.label}</h2>
              <p className="text-xs text-zinc-500 m-0">
                {feed.effectiveDate
                  ? `Effective ${new Date(feed.effectiveDate).toLocaleDateString("en-GB")}`
                  : "Not synced yet"}
                {feed.syncedAt
                  ? ` · Synced ${new Date(feed.syncedAt).toLocaleString("en-GB")}`
                  : ""}
              </p>
            </header>

            {feed.rows.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">
                No snapshot stored. Sync from{" "}
                <Link href="/admin/world-rankings" className="underline">
                  Admin → World rankings
                </Link>
                .
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="cms-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>Pts</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feed.rows.slice(0, 20).map((row) => (
                      <tr key={`${feed.category}-${row.worldRugbyTeamId}`}>
                        <td>{row.position}</td>
                        <td>
                          {row.teamSlug ? (
                            <Link
                              href={`/teams/${row.teamSlug}`}
                              className="inline-flex items-center gap-2"
                            >
                              <TeamCrest name={row.teamName} size="xs" />
                              {row.teamName}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <TeamCrest name={row.teamName} size="xs" />
                              {row.teamName}
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{row.points.toFixed(2)}</strong>
                        </td>
                        <td>
                          {row.movement == null
                            ? "–"
                            : row.movement > 0
                              ? `↑${row.movement}`
                              : row.movement < 0
                                ? `↓${Math.abs(row.movement)}`
                                : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-zinc-600 mt-3 m-0">
              Source:{" "}
              <a href={feed.publicPath} target="_blank" rel="noreferrer" className="underline">
                World Rugby
              </a>
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
