import { ShirtLibraryClient } from "@/components/admin/ShirtLibraryClient";
import { PageHeader } from "@/components/shell/PageHeader";
import { listShirtLibraryCompetitions } from "@/lib/shirt-library-service";

export const metadata = {
  title: "Shirt Library · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default async function ShirtLibraryPage() {
  const competitions = await listShirtLibraryCompetitions();

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Shirt Library"
        description="Standalone kit approval centre. Create, review and approve sponsor-free shirts before they can appear on Team of the Week, line-ups or pitch overlays."
      />
      <ShirtLibraryClient competitions={competitions} />
    </>
  );
}
