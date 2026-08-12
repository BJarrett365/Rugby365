import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerIntelligenceRadar } from "@/components/players/PlayerIntelligenceRadar";
import { PlayerRatingHistoryChart } from "@/components/players/PlayerRatingHistoryChart";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Performance | Player | Rugby365`, description: `Performance breakdown for ${slug}` };
}

export default async function PlayerPerformancePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: isPreviewParam(sp.preview) });
  if (!overview) notFound();

  const factors = overview.playerValue?.factors ?? [];

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Performance" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="performance" />

      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <header>
          <p className="pr-player-v2__kicker">Performance breakdown</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{overview.displayName}</h1>
        </header>

        <div className="pr-player-v2__row--2">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Performance Radar</h2>
            </div>
            <PlayerIntelligenceRadar intelligence={overview.intelligence} />
            <p className="pr-player-v2__note">
              {overview.intelligence.modelVersion ?? "model n/a"} · confidence{" "}
              {overview.intelligence.confidence ?? "—"}% · coverage {overview.intelligence.coverage ?? "—"}%
            </p>
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Rating History</h2>
            </div>
            <PlayerRatingHistoryChart points={overview.ratingHistory} />
          </div>
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Value Breakdown</h2>
          </div>
          {factors.length === 0 ? (
            <p className="pr-player-v2__empty">No value factors available.</p>
          ) : (
            <div className="pr-player-v2__bars">
              {factors.map((f) => (
                <div key={f.key} className="pr-player-v2__bar-row">
                  <span>{f.label}</span>
                  <div className="pr-player-v2__bar-track">
                    <div
                      className={`pr-player-v2__bar-fill${f.pct < 0 ? " pr-player-v2__bar-fill--negative" : ""}`}
                      style={{ width: `${Math.min(100, Math.abs(f.pct) * 2)}%` }}
                    />
                  </div>
                  <span>
                    {f.pct > 0 ? "+" : ""}
                    {f.pct}% — {f.note}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Recent Form</h2>
          </div>
          {overview.recentForm.length === 0 ? (
            <p className="pr-player-v2__empty">No recent form data yet.</p>
          ) : (
            <div className="pr-player-v2__table-wrap">
              <table className="pr-player-v2__table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Comp</th>
                    <th scope="col">Opponent</th>
                    <th scope="col">Result</th>
                    <th scope="col">Mins</th>
                    <th scope="col">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentForm.map((f, i) => (
                    <tr key={`${f.date}-${i}`}>
                      <td>{f.date ?? "—"}</td>
                      <td>{f.competitionName ?? "—"}</td>
                      <td>{f.opponentName ?? "—"}</td>
                      <td>{f.result ?? "—"}</td>
                      <td>{f.minutes ?? "—"}</td>
                      <td>{f.rating != null ? f.rating.toFixed(1) : "—"}</td>
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
