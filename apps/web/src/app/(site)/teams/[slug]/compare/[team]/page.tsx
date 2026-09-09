import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TeamCompareH2HBoard } from "@/components/teams/TeamCompareH2HBoard";
import { compareTeamsBySlug } from "@/lib/team-compare-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string; team: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, team } = await params;
  const data = await compareTeamsBySlug(slug, team);
  if (!data) return { title: "Team comparison | Rugby365" };
  return {
    title: `${data.teamA.name} vs ${data.teamB.name} | Rugby365`,
    description: `Compare ${data.teamA.name} and ${data.teamB.name} — squad value, team rating, form and head-to-head.`,
    robots: { index: false, follow: true },
  };
}

export default async function TeamComparePage({ params }: PageProps) {
  const { slug, team } = await params;
  if (slug === team) notFound();

  const data = await compareTeamsBySlug(slug, team);
  if (!data) notFound();

  if (data.teamA.slug !== slug || data.teamB.slug !== team) {
    redirect(`/teams/${data.teamA.slug}/compare/${data.teamB.slug}`);
  }

  return (
    <article className="pr-mc-fixtures-page pr-h2h-page">
      <TeamCompareH2HBoard data={data} />
    </article>
  );
}
