import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerRatingHistoryChart } from "@/components/players/PlayerRatingHistoryChart";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Rating History | Player | Rugby365`, description: `Rating history for ${slug}` };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PlayerRatingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: isPreviewParam(sp.preview) });
  if (!overview) notFound();

  const rows = [...overview.ratingHistory].reverse();

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Rating" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="rating" />

      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <header>
          <p className="pr-player-v2__kicker">Rating history</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
            {overview.displayName} · {overview.rating.current != null ? overview.rating.current.toFixed(1) : "—"}{" "}
            OVR
          </h1>
        </header>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Overall Rating Trend</h2>
          </div>
          <PlayerRatingHistoryChart points={overview.ratingHistory} />
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Match-by-Match Ratings</h2>
          </div>
          {rows.length === 0 ? (
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
                  {rows.map((r, i) => (
                    <tr key={`${r.date}-${i}`}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.opponentName ?? "—"}</td>
                      <td>{r.competitionName ?? "—"}</td>
                      <td>{r.overall.toFixed(1)}</td>
                      <td>
                        {r.change != null ? (r.change > 0 ? `+${r.change.toFixed(1)}` : r.change.toFixed(1)) : "—"}
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
      </div>
    </article>
  );
}
