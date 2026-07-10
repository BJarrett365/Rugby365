import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_HUB_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "Imports · Rugby365 CMS",
};

export default function AdminImportsPage() {
  return (
    <AdminHubPage
      title="Imports"
      description="Pull leagues, matches, players and rankings from external rugby data sources into the CMS."
      links={ADMIN_HUB_LINKS.imports}
    />
  );
}
