import { CompetitionHubClient } from "@/components/competitions/CompetitionHubClient";

export default async function CompetitionResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  return <CompetitionHubClient slug={slug} mode="results" initialSeason={sp.season} />;
}
