import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { TeamComparison } from "@/components/teams/TeamComparison";
import { compareTeamsBySlug } from "@/lib/team-compare-service";

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

  // Canonicalize legacy team slugs so URLs like `...__legacy__.../compare/...` still work.
  if (data.teamA.slug !== slug || data.teamB.slug !== team) {
    redirect(`/teams/${data.teamA.slug}/compare/${data.teamB.slug}`);
  }

  return (
    <article className="pr-mc-fixtures-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/teams/compare">Compare teams</Link>
        <span aria-hidden>/</span>
        <Link href={`/teams/${data.teamA.slug}`}>{data.teamA.name}</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">vs {data.teamB.name}</span>
      </nav>

      <h1 className="pr-player-profile-header__name">
        {data.teamA.name} vs {data.teamB.name}
      </h1>
      <p className="text-sm text-[var(--pr-mc-muted)] mt-1 mb-4">
        Planet Rugby Team Intelligence — rating, squad value, form and head-to-head.
      </p>

      <TeamComparison data={data} />
    </article>
  );
}
