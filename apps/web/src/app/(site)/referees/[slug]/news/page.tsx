import type { Metadata } from "next";
import { RefereeProfileChrome } from "@/components/referees/RefereeProfileChrome";
import { requireRefereeDashboard } from "@/lib/load-referee-dashboard";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await requireRefereeDashboard(slug);
  return {
    title: `News | ${loaded.model.name} | Rugby365`,
    description: `News for ${loaded.model.name}`,
  };
}

export default async function RefereeNewsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { model, profile } = await requireRefereeDashboard(slug, sp.preview);
  return (
    <RefereeProfileChrome model={model} active="news" preview={profile.preview}>
      <section className="pr-player-v2__card">
        <div className="pr-player-v2__card-head">
          <h2>Latest</h2>
        </div>
        <p className="pr-player-v2__empty">No linked news items yet for this official.</p>
      </section>
    </RefereeProfileChrome>
  );
}
