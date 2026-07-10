import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_OPTA_STATS_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "Opta Stats · Rugby365 CMS",
};

export default function OptaStatsAdminPage() {
  return (
    <AdminHubPage
      eyebrow="Content"
      title="Opta Stats"
      description="SDMS / Opta-backed performance data and the Stats Brain insight layer. Player, team and match stats are imported via Planet Rugby; editorial insights are managed centrally."
      links={ADMIN_OPTA_STATS_LINKS}
    />
  );
}
