import { CompetitionTableClient } from "@/components/competitions/CompetitionTableClient";

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
      initialSeason={sp.season}
      initialView={(sp.view as "overall" | "home" | "away") ?? "overall"}
    />
  );
}
