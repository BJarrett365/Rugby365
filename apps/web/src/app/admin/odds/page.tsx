import { AdminHubPage } from "@/components/admin/AdminHubPage";
import { ADMIN_ODDS_LINKS } from "@/lib/admin-nav";

export const metadata = {
  title: "Odds · Rugby365 CMS",
};

export default function AdminOddsHubPage() {
  return (
    <AdminHubPage
      eyebrow="Odds"
      title="Odds & betting"
      description="Import BMbets Rugby Union odds, review market snapshots and feed Match Centre Betting Intelligence value bets."
      links={ADMIN_ODDS_LINKS}
    />
  );
}
