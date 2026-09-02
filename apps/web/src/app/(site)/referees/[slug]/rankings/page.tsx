import type { Metadata } from "next";
import { PlayerRatingHistoryCard } from "@/components/players/PlayerRatingHistoryCard";
import { R365RadarChart } from "@/components/charts/R365RadarChart";
import { RefereeProfileChrome } from "@/components/referees/RefereeProfileChrome";
import { requireRefereeDashboard } from "@/lib/load-referee-dashboard";
import { refereeRatingSeries } from "@/lib/referee-overview-adapter";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await requireRefereeDashboard(slug);
  return {
    title: `Rankings | ${loaded.model.name} | Rugby365`,
    description: `Rankings and rating history for ${loaded.model.name}`,
  };
}

export default async function RefereeRankingsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { model, profile } = await requireRefereeDashboard(slug, sp.preview);
  const radarAxes = model.radar.map((row) => ({
    key: row.category.toLowerCase().replace(/\s+/g, "_"),
    label: row.category,
  }));
  return (
    <RefereeProfileChrome model={model} active="rankings" preview={profile.preview}>
      <div className="pr-player-v2__grid">
        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>World ranking</h2>
            </div>
            <p className="pr-player-v2__mini-big">#{model.worldRank}</p>
            <p className="pr-player-v2__empty">Overall rating {model.overallRating.toFixed(1)} / 100</p>
          </div>
          <div className="pr-player-v2__card pr-player-v2__widget-card">
            <div className="pr-player-v2__card-head">
              <h2>Performance Radar</h2>
            </div>
            <R365RadarChart
              axes={radarAxes}
              series={[
                {
                  id: "referee",
                  label: model.name,
                  values: model.radar.map((row) => row.referee),
                  color: "#54b989",
                  fillOpacity: 0.28,
                },
                {
                  id: "elite",
                  label: "Elite referee average",
                  values: model.radar.map((row) => row.eliteAverage),
                  color: "#5b8fd9",
                  dashed: true,
                },
              ]}
              drawPolygon
              showScoreLabels
            />
          </div>
          <PlayerRatingHistoryCard
            slug={model.slug}
            points={[]}
            overallSeries={refereeRatingSeries(model)}
            fullHistoryHref={`/referees/${model.slug}/rankings`}
            showMetricSelect={false}
          />
        </div>
      </div>
    </RefereeProfileChrome>
  );
}
