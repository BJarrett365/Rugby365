import { ComparePlayersPicker } from "@/components/players/ComparePlayersPicker";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";
import { notFound } from "next/navigation";

export default async function CompetitionComparePlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  return (
    <ComparePlayersPicker
      competitionSlug={competition.slug}
      competitionName={competition.name}
    />
  );
}
