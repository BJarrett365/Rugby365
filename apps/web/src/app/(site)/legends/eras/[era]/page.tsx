import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegendsGrid } from "@/components/legends/LegendsGrid";
import { listPublicLegends, resolveLegendEraParam } from "@/lib/public-legends-service";
import { LEGEND_ERAS } from "@/lib/legends-catalog";

type PageProps = {
  params: Promise<{ era: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { era: raw } = await params;
  const era = resolveLegendEraParam(raw);
  if (!era) return { title: "Legends era" };
  return {
    title: `${era.label} Rugby Legends | Planet Rugby Legends`,
    description: `Planet Rugby Legends from the ${era.label} — iconic players linked to full Rugby365 profiles.`,
    alternates: { canonical: `/legends/eras/${era.slug}` },
  };
}

export default async function LegendsEraPage({ params }: PageProps) {
  const { era: raw } = await params;
  const era = resolveLegendEraParam(raw);
  if (!era) notFound();

  const legends = await listPublicLegends({ era: era.slug });

  return (
    <article className="pr-mc-fixtures-page pr-legends-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/legends">Legends</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{era.label}</span>
      </nav>

      <header className="pr-legends-header">
        <p className="pr-mc-pr-badge">Planet Rugby Legends</p>
        <h1>{era.label}</h1>
        <p className="pr-legends-header__lede">
          Players who defined the {era.label} — each card opens their full player profile.
        </p>
      </header>

      <ul className="pr-legends-chip-row">
        {LEGEND_ERAS.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/legends/eras/${e.slug}`}
              className={`pr-legends-chip${e.slug === era.slug ? " is-active" : ""}`}
            >
              {e.label}
            </Link>
          </li>
        ))}
      </ul>

      <LegendsGrid legends={legends} />
    </article>
  );
}
