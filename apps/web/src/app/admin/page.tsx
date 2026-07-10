import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ADMIN_HUB_KEYS } from "@/lib/admin-nav";

export const metadata = {
  title: "Admin · Rugby365 CMS",
};

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform admin"
        title="Control panel"
        description="Manage rugby content, data imports, operator sandboxes, parse APIs and Wikipedia enrichment for this Rugby365 environment."
      />

      <div className="cms-grid-2 xl:grid-cols-4 mb-8">
        {ADMIN_HUB_KEYS.map((key) => (
          <Link key={key.id} href={key.href} className="cms-card cms-card--link">
            <p className="page-header__eyebrow m-0 mb-2">{key.label}</p>
            <p className="text-3xl font-bold text-zinc-200 m-0">{key.value}</p>
            <p className="text-sm text-zinc-500 m-0 mt-2 leading-relaxed">{key.description}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-bold m-0 mb-4">Quick links</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/matches" className="cms-btn cms-btn--secondary text-sm">
            Matches
          </Link>
          <Link href="/admin/teams" className="cms-btn cms-btn--secondary text-sm">
            Teams
          </Link>
          <Link href="/admin/players" className="cms-btn cms-btn--secondary text-sm">
            Players
          </Link>
          <Link href="/admin/competitions" className="cms-btn cms-btn--secondary text-sm">
            Competitions
          </Link>
        </div>
      </section>
    </>
  );
}
