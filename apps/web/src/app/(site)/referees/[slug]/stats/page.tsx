import type { Metadata } from "next";
import { RefereeCareerStatsPanel } from "@/components/referees/RefereeCareerStatsPanel";
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
    title: `Stats | ${loaded.model.name} | Rugby365`,
    description: `Career statistics for ${loaded.model.name}`,
  };
}

export default async function RefereeStatsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { model, profile } = await requireRefereeDashboard(slug, sp.preview);
  return (
    <RefereeProfileChrome model={model} active="stats" preview={profile.preview}>
      <RefereeCareerStatsPanel model={model} />
    </RefereeProfileChrome>
  );
}
