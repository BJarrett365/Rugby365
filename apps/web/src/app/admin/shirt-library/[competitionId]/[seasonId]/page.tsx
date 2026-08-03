import { ShirtLibraryClient } from "@/components/admin/ShirtLibraryClient";
import { PageHeader } from "@/components/shell/PageHeader";
import { listShirtLibraryCompetitions } from "@/lib/shirt-library-service";

export const dynamic = "force-dynamic";

export default async function ShirtLibraryCompetitionSeasonPage({
  params,
}: {
  params: Promise<{ competitionId: string; seasonId: string }>;
}) {
  const { competitionId, seasonId } = await params;
  const competitions = await listShirtLibraryCompetitions();
  const competition = competitions.find((c) => c.id === competitionId);

  return (
    <>
      <PageHeader
        eyebrow="Shirt Library"
        title={competition?.name ?? "Competition shirts"}
        description="Approve home and away kits for every participating team. Unapproved shirts never appear on public pitches."
      />
      <ShirtLibraryClient
        competitions={competitions}
        initialCompetitionId={competitionId}
        initialSeasonId={seasonId}
      />
    </>
  );
}
