import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionNav } from "@/components/competitions/CompetitionNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";
import {
  canonicalRugbyChampionshipSlug,
  isRugbyChampionshipLineageSlug,
} from "@/lib/rugby-championship-lineage";

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canonicalSlug = isRugbyChampionshipLineageSlug(slug)
    ? canonicalRugbyChampionshipSlug(slug)
    : slug;

  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const title = isRugbyChampionshipLineageSlug(slug)
    ? "The Rugby Championship"
    : competition.name;
  const description = isRugbyChampionshipLineageSlug(slug)
    ? "Tri Nations (1996–2011) and The Rugby Championship (2012–). Fixtures, results, tables, player stats, Team of the Week and head-to-head compare."
    : "Fixtures, results, tables, player stats, Team of the Week and head-to-head compare.";

  return (
    <div className="competition-layout">
      <PageHeader
        eyebrow="Competition"
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/competitions/${canonicalSlug}/compare`} className="cms-btn">
              Compare players
            </Link>
            <Link href="/admin/tables" className="cms-btn cms-btn--secondary">
              Tables
            </Link>
            <Link href="/admin/competitions" className="cms-btn cms-btn--secondary">
              Competitions
            </Link>
          </div>
        }
      />
      <CompetitionNav slug={canonicalSlug} />
      {children}
    </div>
  );
}
