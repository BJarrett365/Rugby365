import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPlayerCareerV2 } from "@/components/players/PublicPlayerCareerV2";
import { getPublicPlayerCareerV2 } from "@/lib/public-player-career-v2-service";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: false });
  const name = overview?.displayName ?? slug;
  return {
    title: `Career | ${name} | Rugby365`,
    description: `Career history and season records for ${name}`,
  };
}

export default async function PlayerCareerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: isPreviewParam(sp.preview) });
  if (!overview) notFound();

  const career = await getPublicPlayerCareerV2(overview.playerId, {
    verifiedCaps: overview.verifiedInternationalCaps,
    internationalTeamName: overview.internationalTeam?.name ?? null,
    achievements: overview.achievements.map((a) => ({
      id: a.id,
      year: a.year,
      title: a.title,
      detail: a.detail,
      verificationStatus: a.verificationStatus,
    })),
    dataAsOfIso: overview.dataLastUpdatedIso,
  });
  if (!career) notFound();

  return <PublicPlayerCareerV2 overview={overview} career={career} />;
}
