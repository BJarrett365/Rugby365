import { CompetitionCatalogClient } from "@/components/admin/CompetitionCatalogClient";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata = {
  title: "Competition catalog · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default function CompetitionCatalogPage() {
  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Competition catalog"
        description="International, club and domestic competitions tagged by country, region, gender, age group, format, level, season structure and current/former status. Only populated competitions are linked in the database."
      />
      <CompetitionCatalogClient />
    </>
  );
}
