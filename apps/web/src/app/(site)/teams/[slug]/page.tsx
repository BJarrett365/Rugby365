import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTeamProfileView } from "@/components/teams/PublicTeamProfileView";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicTeamProfile } from "@/lib/public-team-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicTeamProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) return { title: "Team not found | Rugby365" };
  return {
    title: profile.seo.title,
    description: profile.seo.description,
    alternates: { canonical: profile.seo.canonicalPath },
    robots: profile.seo.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicTeamPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicTeamProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();
  return <PublicTeamProfileView profile={profile} />;
}
