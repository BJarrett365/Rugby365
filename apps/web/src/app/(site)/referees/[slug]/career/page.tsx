import type { Metadata } from "next";
import { PlayerAiScoutSummaryCard } from "@/components/players/PlayerAiScoutSummaryCard";
import { PlayerKeyAchievementsCard } from "@/components/players/PlayerKeyAchievementsCard";
import { RefereeProfileChrome } from "@/components/referees/RefereeProfileChrome";
import { requireRefereeDashboard } from "@/lib/load-referee-dashboard";
import { refereeAchievements } from "@/lib/referee-overview-adapter";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await requireRefereeDashboard(slug);
  return {
    title: `Career | ${loaded.model.name} | Rugby365`,
    description: `Career highlights for ${loaded.model.name}`,
  };
}

export default async function RefereeCareerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { model, profile } = await requireRefereeDashboard(slug, sp.preview);
  return (
    <RefereeProfileChrome model={model} active="career" preview={profile.preview}>
      <div className="pr-player-v2__grid">
        <div className="pr-player-v2__row--3">
          <PlayerKeyAchievementsCard
            slug={model.slug}
            tiles={refereeAchievements(model)}
            viewAllHref={`/referees/${model.slug}/career`}
          />
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Match type breakdown</h2>
            </div>
            <div className="pr-player-v2__bars">
              {model.matchTypeBreakdown.map((row) => (
                <div key={row.competition} className="pr-player-v2__bar-row">
                  <span>{row.competition}</span>
                  <div className="pr-player-v2__bar-track">
                    <div className="pr-player-v2__bar-fill" style={{ width: `${Math.min(100, row.avgRating)}%` }} />
                  </div>
                  <span>{row.avgRating.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <PlayerAiScoutSummaryCard
            slug={model.slug}
            summary={model.about}
            strengths={model.strengths.map((row) => row.detail)}
            development={model.developmentAreas.map((row) => row.detail)}
            bestRole={model.bio.preferredRole}
            provisional={model.isMockAnalytics}
            title="About"
            reportHref={`/referees/${model.slug}`}
            reportLabel="Back to overview >"
          />
        </div>
      </div>
    </RefereeProfileChrome>
  );
}
