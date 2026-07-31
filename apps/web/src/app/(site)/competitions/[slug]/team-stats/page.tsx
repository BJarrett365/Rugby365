import { CompetitionTeamStatsClient } from "@/components/competitions/CompetitionTeamStatsClient";
import type { HemisphereFilter } from "@/lib/competition-player-leaderboards-service";

export default async function CompetitionTeamStatsPage({
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
    <CompetitionTeamStatsClient
      slug={slug}
      initialSeason={sp.season}
      initialHemisphere={hemisphere}
    />
  );
}
