import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_HUB_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "Wiki · Rugby365 CMS",
};

export default function AdminWikiPage() {
  return (
    <AdminHubPage
      title="Wiki"
      description="Wikipedia entity import, Wikimedia API credentials and enrichment for players, teams and venues."
      links={ADMIN_HUB_LINKS.wiki}
    />
  );
}
