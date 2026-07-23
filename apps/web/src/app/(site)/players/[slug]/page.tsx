import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PublicPlayerJsonLd,
  PublicPlayerProfileView,
} from "@/components/players/PublicPlayerProfileView";
import { getPublicPlayerProfile } from "@/lib/public-player-profile-service";
import { parsePublicPlayerSearchParams } from "@/lib/public-player-filters";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tab?: string;
    season?: string;
    competition?: string;
    page?: string;
    preview?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const filters = parsePublicPlayerSearchParams(sp);
  const profile = await getPublicPlayerProfile(slug, {
    preview: filters.preview,
    season: filters.season,
    competition: filters.competition,
    view: "domestic",
    page: filters.page,
  });
  if (!profile) {
    return { title: "Player not found | Rugby365" };
  }
  return {
    title: profile.seo.title,
    description: profile.seo.description,
    alternates: { canonical: profile.seo.canonicalPath },
    robots: profile.seo.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: profile.seo.title,
      description: profile.seo.description,
      url: profile.seo.canonicalPath,
      type: "profile",
      ...(profile.seo.ogImageUrl
        ? {
            images: [
              {
                url: profile.seo.ogImageUrl,
                width: 1200,
                height: 630,
                alt: profile.name,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: profile.seo.title,
      description: profile.seo.description,
      ...(profile.seo.ogImageUrl ? { images: [profile.seo.ogImageUrl] } : {}),
    },
  };
}

export default async function PublicPlayerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const filters = parsePublicPlayerSearchParams(sp);
  const profile = await getPublicPlayerProfile(slug, {
    preview: filters.preview,
    season: filters.season,
    competition: filters.competition,
    view: "domestic",
    page: filters.page,
  });
  if (!profile) notFound();

  return (
    <>
      <PublicPlayerJsonLd profile={profile} />
      <PublicPlayerProfileView profile={profile} activeTab={filters.tab} />
    </>
  );
}
