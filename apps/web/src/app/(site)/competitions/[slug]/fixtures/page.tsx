import { CompetitionHubClient } from "@/components/competitions/CompetitionHubClient";

export default async function CompetitionFixturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  return <CompetitionHubClient slug={slug} mode="fixtures" initialSeason={sp.season} />;
}
