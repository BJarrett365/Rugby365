import Link from "next/link";
import { notFound } from "next/navigation";
import { SeasonSelect } from "@/components/shirts/SeasonSelect";
import { listShirtLibraryCompetitionHub } from "@/lib/shirt-library-public-service";
import "@/styles/shirt-library-public.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitionSlug: string }>;
}) {
  const { competitionSlug } = await params;
  const hub = await listShirtLibraryCompetitionHub(competitionSlug);
  return {
    title: hub
      ? `${hub.competition.name} Shirt Library · Rugby365`
      : "Shirt Library · Rugby365",
    description: hub
      ? `Browse season shirt guides for ${hub.competition.name} on Rugby365.`
      : "Rugby365 Shirt Library",
  };
}

export default async function ShirtLibraryCompetitionPage({
  params,
}: {
  params: Promise<{ competitionSlug: string }>;
}) {
  const { competitionSlug } = await params;
  const hub = await listShirtLibraryCompetitionHub(competitionSlug);
  if (!hub) notFound();

  const published = hub.seasons.filter((s) => s.isPublished);
  const latest = published.find((s) => s.isActive) ?? published[0] ?? hub.seasons[0];

  return (
    <div className="slp">
      <nav className="slp__breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shirt-library">Shirt Library</Link>
        <span>/</span>
        <span>{hub.competition.name}</span>
      </nav>

      <header className="slp__header">
        <div className="slp__brand">Rugby365 Shirt Library</div>
        <h1 className="slp__title">{hub.competition.name}</h1>
        <p className="slp__subtitle">
          {[hub.competition.countryName, hub.competition.region, hub.competition.catalogGroup]
            .filter(Boolean)
            .join(" · ") || hub.competition.competitionType}
        </p>
        {hub.competition.bioSummary ? (
          <p className="slp__subtitle" style={{ maxWidth: "60ch" }}>
            {hub.competition.bioSummary}
          </p>
        ) : null}
        <div className="slp__meta">
          <span>{hub.competition.competitionType ?? "Competition"}</span>
          {latest ? <span>Latest season: {latest.label}</span> : null}
        </div>
        {latest?.isPublished ? (
          <Link className="slp__btn slp__btn--primary" href={latest.href}>
            Open {latest.label} shirts
          </Link>
        ) : (
          <p className="slp__map-empty">No published shirt season yet for this competition.</p>
        )}
      </header>

      <section className="slp__section">
        <h2 className="slp__section-title">Season</h2>
        {hub.seasons.length > 0 ? (
          <SeasonSelect
            competitionSlug={hub.competition.slug}
            currentSeasonSlug={latest?.slug ?? hub.seasons[0]!.slug}
            seasons={hub.seasons.map((s) => ({ slug: s.slug, label: s.label }))}
          />
        ) : null}
        <div className="slp__season-links" style={{ marginTop: "1rem" }}>
          {hub.seasons.map((s) =>
            s.isPublished ? (
              <Link key={s.id} className="slp__btn" href={s.href}>
                {s.label}
                {s.isActive ? " (current)" : ""} · {s.readinessPct}%
              </Link>
            ) : (
              <span key={s.id} className="slp__btn" style={{ opacity: 0.45 }}>
                {s.label} · unpublished
              </span>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
