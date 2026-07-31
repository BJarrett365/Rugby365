import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_SCOUT_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "Scout Intelligence · Rugby365 CMS",
};

export default function AdminScoutHubPage() {
  return (
    <AdminHubPage
      eyebrow="Scout"
      title="Scout Intelligence"
      description="Recruitment Index (RRI) tools that enhance player Scouting profiles — not a replacement for scouting bios or the public Scouting view."
      links={ADMIN_SCOUT_LINKS}
    />
  );
}
