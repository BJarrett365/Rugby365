import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_HUB_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "API · Rugby365 CMS",
};

export default function AdminApiPage() {
  return (
    <AdminHubPage
      title="API"
      description="Read-only parse endpoints used by import flows. Open a link to inspect JSON output for a sample URL."
      links={ADMIN_HUB_LINKS.api}
    />
  );
}
