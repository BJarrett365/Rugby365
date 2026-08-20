import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPlayerJsonLd } from "@/components/players/PublicPlayerProfileView";
import { PublicPlayerOverviewV2 } from "@/components/players/PublicPlayerOverviewV2";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; compare?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, {
    preview: isPreviewParam(sp.preview),
    compareSlug: sp.compare?.trim() || null,
  });
  if (!overview) {
    return { title: "Player not found | Rugby365" };
  }
  const profile = overview.base;
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
  const overview = await getPublicPlayerOverviewV2(slug, {
    preview: isPreviewParam(sp.preview),
    compareSlug: sp.compare?.trim() || null,
  });
  if (!overview) notFound();

  return (
    <>
      <PublicPlayerJsonLd profile={overview.base} />
      <PublicPlayerOverviewV2 overview={overview} />
    </>
  );
}
