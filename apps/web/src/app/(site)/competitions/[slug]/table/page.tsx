import { CompetitionTableClient } from "@/components/competitions/CompetitionTableClient";
import { canonicalSeasonQueryForCompetition } from "@/lib/season-label-utils";

export default async function CompetitionTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string; view?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  return (
    <CompetitionTableClient
      slug={slug}
      initialSeason={canonicalSeasonQueryForCompetition(slug, sp.season)}
      initialView={(sp.view as "overall" | "home" | "away") ?? "overall"}
    />
  );
}
