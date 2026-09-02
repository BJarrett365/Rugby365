import type { Metadata } from "next";
import { PlayerRecentMatchesCard } from "@/components/players/PlayerRecentMatchesCard";
import { PlayerNextMatchCard } from "@/components/players/PlayerNextMatchCard";
import { RefereeProfileChrome } from "@/components/referees/RefereeProfileChrome";
import { requireRefereeDashboard } from "@/lib/load-referee-dashboard";
import { refereeMatchRows, refereeNextMatch } from "@/lib/referee-overview-adapter";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await requireRefereeDashboard(slug);
  return {
    title: `Matches | ${loaded.model.name} | Rugby365`,
    description: `Appointments for ${loaded.model.name}`,
  };
}

export default async function RefereeMatchesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { model, profile } = await requireRefereeDashboard(slug, sp.preview);
  return (
    <RefereeProfileChrome model={model} active="matches" preview={profile.preview}>
      <div className="pr-player-v2__grid">
        <div className="pr-player-v2__row--3">
          <div className="pr-player-v2__span-2" style={{ gridColumn: "span 2" }}>
            <PlayerRecentMatchesCard
              slug={model.slug}
              matches={refereeMatchRows(model)}
              showViewAll={false}
            />
          </div>
          <PlayerNextMatchCard nextMatch={refereeNextMatch(model)} />
        </div>
      </div>
    </RefereeProfileChrome>
  );
}
