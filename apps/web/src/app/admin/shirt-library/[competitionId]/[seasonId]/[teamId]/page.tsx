import { notFound } from "next/navigation";
import { ShirtLibraryTeamClient } from "@/components/admin/ShirtLibraryTeamClient";
import { PageHeader } from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db";
import { competitionSeasons, competitions, teams } from "@rugby365/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ShirtLibraryTeamPage({
  params,
}: {
  params: Promise<{ competitionId: string; seasonId: string; teamId: string }>;
}) {
  const { competitionId, seasonId, teamId } = await params;
  const db = getDb();

  const [[competition], [season], [team]] = await Promise.all([
    db
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1),
    db
      .select({ id: competitionSeasons.id, label: competitionSeasons.label })
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, seasonId))
      .limit(1),
    db
      .select({
        id: teams.id,
        name: teams.name,
        imageUrl: teams.imageUrl,
        countryName: teams.countryName,
      })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1),
  ]);

  if (!competition || !season || !team) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Shirt Library"
        title={`${team.name} kits`}
        description={`${competition.name} · ${season.label} — review against reference, then approve for pitch use.`}
      />
      <ShirtLibraryTeamClient
        competitionId={competitionId}
        seasonId={seasonId}
        teamId={teamId}
        competitionName={competition.name}
        seasonLabel={season.label}
        teamName={team.name}
        teamImageUrl={team.imageUrl}
        countryName={team.countryName}
      />
    </>
  );
}
