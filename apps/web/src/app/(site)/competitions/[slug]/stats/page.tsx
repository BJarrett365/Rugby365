import { CompetitionPlayerStatsClient } from "@/components/competitions/CompetitionPlayerStatsClient";
import type { HemisphereFilter } from "@/lib/competition-player-leaderboards-service";

export default async function CompetitionStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string; hemisphere?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const hemisphere =
    sp.hemisphere === "northern" || sp.hemisphere === "southern" || sp.hemisphere === "all"
      ? (sp.hemisphere as HemisphereFilter)
      : "all";

  return (
    <CompetitionPlayerStatsClient
      slug={slug}
      initialSeason={sp.season}
      initialHemisphere={hemisphere}
    />
  );
}
