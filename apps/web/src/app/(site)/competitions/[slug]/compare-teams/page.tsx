import { CompareTeamsPicker } from "@/components/teams/CompareTeamsPicker";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";
import { notFound } from "next/navigation";

export default async function CompetitionCompareTeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  return (
    <article className="space-y-4">
      <header>
        <h1 className="pr-player-profile-header__name m-0">Compare teams</h1>
        <p className="text-sm text-[var(--pr-mc-muted)] mt-1 mb-0">
          Defaults to {competition.name}. Switch either side to another competition anytime.
        </p>
      </header>
      <CompareTeamsPicker
        competitionSlug={competition.slug}
        competitionName={competition.name}
      />
    </article>
  );
}
