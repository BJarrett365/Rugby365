import { notFound } from "next/navigation";
import { CrestLibraryTeamClient } from "@/components/admin/CrestLibraryTeamClient";
import { PageHeader } from "@/components/shell/PageHeader";
import { getDb } from "@/lib/db";
import { teams } from "@rugby365/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CrestLibraryTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ competitionId: string; seasonId: string; teamId: string }>;
  searchParams: Promise<{ crestId?: string }>;
}) {
  const { competitionId, seasonId, teamId } = await params;
  const { crestId } = await searchParams;
  const db = getDb();
  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Crest Library"
        title={team.name}
        description="Edit official / replica crest assets, colours and about text. Approving links this crest to the team’s Shirt Library kits."
      />
      <CrestLibraryTeamClient
        competitionId={competitionId}
        seasonId={seasonId}
        teamId={team.id}
        teamName={team.name}
        initialCrestId={crestId}
      />
    </>
  );
}
