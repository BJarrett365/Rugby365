import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PublicPlayerRatingV2 } from "@/components/players/PublicPlayerRatingV2";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Rating | Player | Rugby365`,
    description: `Rating history and breakdown for ${slug}`,
  };
}

export default async function PlayerRatingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, {
    preview: isPreviewParam(sp.preview),
  });
  if (!overview) notFound();

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Rating" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="rating" />
      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <PlayerIdentityHero overview={overview} />
        <PublicPlayerRatingV2 overview={overview} />
      </div>
    </article>
  );
}
