import { TeamOfWeekAdminClient } from "@/components/admin/TeamOfWeekAdminClient";
import { PageHeader } from "@/components/shell/PageHeader";
import { listCompetitions, listSeasonsForPicker } from "@/lib/competition-admin-service";

export const metadata = {
  title: "Team of the Week · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default async function AdminTeamOfWeekPage() {
  const competitions = await listCompetitions();
  const active = competitions.filter((c) => !c.name.toLowerCase().includes("test"));
  const withSeasons = await Promise.all(
    active.slice(0, 40).map(async (c) => {
      const seasons = await listSeasonsForPicker(c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        seasons: seasons.map((s) => ({
          id: s.id,
          label: s.label,
          year: s.year,
          isActive: s.isActive,
        })),
      };
    }),
  );

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Team of the Week"
        description="Generate round-based XVs from completed fixtures and match ratings. Publish only when the round is complete — never auto-publishes."
      />
      <TeamOfWeekAdminClient competitions={withSeasons} />
    </>
  );
}
