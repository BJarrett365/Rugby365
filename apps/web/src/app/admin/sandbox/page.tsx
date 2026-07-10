import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_HUB_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "Sandbox · Rugby365 CMS",
};

export default function AdminSandboxPage() {
  return (
    <AdminHubPage
      title="Sandbox"
      description="Operator sandboxes for agent runs, commentary R&D and live match-day tooling."
      links={ADMIN_HUB_LINKS.sandbox}
    />
  );
}
