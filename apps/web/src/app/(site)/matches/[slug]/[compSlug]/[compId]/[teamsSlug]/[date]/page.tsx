import { notFound } from "next/navigation";
import { MatchDetailView } from "@/components/matches/MatchDetailView";
import { parseMatchDetailTab } from "@/lib/match-detail-tabs";
import { getMatchDetailForPage } from "@/lib/match-detail-service";

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    slug: string;
    compSlug: string;
    compId: string;
    teamsSlug: string;
    date: string;
  }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug: matchId } = await params;
  const { tab } = await searchParams;
  const data = await getMatchDetailForPage(matchId);
  if (!data) notFound();

  return <MatchDetailView data={data} activeTab={parseMatchDetailTab(tab)} />;
}
