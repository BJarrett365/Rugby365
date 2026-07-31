import { CompetitionRankingsClient } from "@/components/competitions/CompetitionRankingsClient";

export default async function CompetitionRankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  return <CompetitionRankingsClient slug={slug} initialSeason={sp.season} />;
}
