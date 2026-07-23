import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PublicPlayerJsonLd,
  PublicPlayerProfileView,
} from "@/components/players/PublicPlayerProfileView";
import { getPublicPlayerProfile } from "@/lib/public-player-profile-service";
import {
  isPublicPlayerView,
  parsePublicPlayerSearchParams,
  type PublicPlayerView,
} from "@/lib/public-player-filters";

type PageProps = {
  params: Promise<{ slug: string; view: string }>;
  searchParams: Promise<{
    tab?: string;
    season?: string;
    competition?: string;
    page?: string;
    preview?: string;
  }>;
};

async function loadProfile(slug: string, view: PublicPlayerView, sp: Awaited<PageProps["searchParams"]>) {
  const filters = parsePublicPlayerSearchParams(sp);
  return getPublicPlayerProfile(slug, {
    preview: filters.preview,
    season: filters.season,
    competition: filters.competition,
    view,
    page: filters.page,
  });
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug, view: viewParam } = await params;
  if (!isPublicPlayerView(viewParam) || viewParam === "domestic") {
    return { title: "Player not found | Rugby365" };
  }
  const sp = await searchParams;
  const profile = await loadProfile(slug, viewParam, sp);
  if (!profile) return { title: "Player not found | Rugby365" };
  return {
    title: profile.seo.title,
    description: profile.seo.description,
    alternates: { canonical: profile.seo.canonicalPath },
    robots: profile.seo.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicPlayerViewPage({ params, searchParams }: PageProps) {
  const { slug, view: viewParam } = await params;
  if (!isPublicPlayerView(viewParam)) notFound();
  // Domestic lives at /players/[slug]
  if (viewParam === "domestic") notFound();

  const sp = await searchParams;
  const filters = parsePublicPlayerSearchParams(sp);
  const profile = await loadProfile(slug, viewParam, sp);
  if (!profile) notFound();

  return (
    <>
      <PublicPlayerJsonLd profile={profile} />
      <PublicPlayerProfileView profile={profile} activeTab={filters.tab} />
    </>
  );
}
