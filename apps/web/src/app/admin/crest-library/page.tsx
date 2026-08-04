import { CrestLibraryClient } from "@/components/admin/CrestLibraryClient";
import { PageHeader } from "@/components/shell/PageHeader";
import { listCrestLibraryCompetitions } from "@/lib/crest-library-service";

export const metadata = {
  title: "Crest Library · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default async function CrestLibraryPage() {
  const competitions = await listCrestLibraryCompetitions();

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Crest Library"
        description="Manage official and replica club crests — colours, descriptions, and about copy. Approved crests sync to the team record and link to Shirt Library kits."
      />
      <CrestLibraryClient competitions={competitions} />
    </>
  );
}
