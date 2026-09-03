import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachStatsDashboard } from "@/components/coaches/CoachStatsDashboard";
import { CoachSubpageChrome } from "@/components/coaches/CoachSubpageChrome";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicCoachProfile(slug, { preview: false });
  const name = profile?.displayName ?? slug;
  return { title: `Stats | ${name} | Rugby365`, description: `Stats and ratings for ${name}` };
}

export default async function CoachStatsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  return (
    <CoachSubpageChrome profile={profile} active="stats">
      <CoachStatsDashboard profile={profile} />
    </CoachSubpageChrome>
  );
}
