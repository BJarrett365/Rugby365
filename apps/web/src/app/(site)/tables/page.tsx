import Link from "next/link";
import { PublicFixturesTabs } from "@/components/matches/PublicFixturesTabs";
import { listPublicCompetitionTables } from "@/lib/public-tables-service";

/** Tables hub is TTL-cached; refresh at most every 2 minutes. */
export const revalidate = 120;

export const metadata = {
  title: "League Tables · Rugby365",
  description: "Public rugby league tables and standings by competition and season.",
};

export default async function PublicTablesPage() {
  const cards = await listPublicCompetitionTables();

  return (
    <div className="pr-mc-fixtures-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Live Centre</Link>
        <span className="pr-mc-breadcrumbs__sep" aria-hidden>
          ›
        </span>
        <span className="pr-mc-breadcrumbs__current">Tables</span>
      </nav>

      <header className="pr-mc-fixtures-page__header">
        <div className="pr-mc-fixtures-page__title-row">
          <h1 className="pr-mc-fixtures-page__title">Tables</h1>
          <span className="pr-mc-pr-badge" title="Planet Rugby" aria-hidden>
            PR
          </span>
        </div>
        <Link href="/admin/tables" className="pr-mc-fixtures-page__manage no-print">
          Manage tables
        </Link>
      </header>

      <PublicFixturesTabs active="tables" />

      {cards.length === 0 ? (
        <div className="cms-card mt-4">
          <p className="text-sm text-[var(--pr-grey)] mb-0">
            No published competition tables yet. Sync standings from Planet Rugby or Table Lab to
            populate this page.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.competitionId} href={c.href} className="cms-card block no-underline">
              <p className="text-xs uppercase tracking-wide text-[var(--pr-grey)] mb-1">
                {c.competitionType ?? "Competition"}
              </p>
              <h2 className="text-base font-semibold text-white mt-0 mb-1">{c.name}</h2>
              <p className="text-sm text-[var(--pr-grey)] mb-2">
                {[c.countryName, c.region].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="text-sm text-[var(--pr-gold)] mb-0">
                {c.seasonLabel} · {c.teamCount} teams
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
