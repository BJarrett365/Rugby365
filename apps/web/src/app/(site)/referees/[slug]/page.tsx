import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicRefereeProfileView } from "@/components/referees/PublicRefereeProfileView";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicRefereeProfile } from "@/lib/public-referee-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicRefereeProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) return { title: "Referee not found | Rugby365" };
  return {
    title: profile.seo.title,
    description: profile.seo.description,
    alternates: { canonical: profile.seo.canonicalPath },
    robots: profile.seo.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicRefereePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicRefereeProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();
  return <PublicRefereeProfileView profile={profile} />;
}
