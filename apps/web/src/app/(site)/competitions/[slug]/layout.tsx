import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionNav } from "@/components/competitions/CompetitionNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Competition"
        title={competition.name}
        description="Fixtures, results, tables, player stats, team stats and head-to-head compare."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/competitions/${slug}/compare`} className="cms-btn">
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
      <CompetitionNav slug={slug} />
      {children}
    </div>
  );
}
