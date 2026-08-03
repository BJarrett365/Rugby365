import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicPlayerProfile } from "@/lib/public-player-profile-service";
import { PlayerComparison } from "@/components/players/PlayerComparison";
import { buildPlayerCompareMetrics } from "@/lib/player-compare-metrics";

type PageProps = {
  params: Promise<{ slug: string; player: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, player } = await params;
  const [a, b] = await Promise.all([
    getPublicPlayerProfile(slug, { preview: false }),
    getPublicPlayerProfile(player, { preview: false }),
  ]);
  if (!a || !b) return { title: "Player comparison | Rugby365" };
  return {
    title: `${a.name} vs ${b.name} | Rugby365`,
    description: `Compare ${a.name} and ${b.name} — ratings, market value and stats.`,
    robots: { index: false, follow: true },
  };
}

export default async function PlayerComparePage({ params, searchParams }: PageProps) {
  const { slug, player } = await params;
  const sp = await searchParams;
  const preview = sp.preview === "1";

  if (slug === player) {
    notFound();
  }

  const [playerA, playerB] = await Promise.all([
    getPublicPlayerProfile(slug, { preview }),
    getPublicPlayerProfile(player, { preview }),
  ]);
  if (!playerA || !playerB) notFound();

  const metrics = buildPlayerCompareMetrics(playerA, playerB);

  return (
    <article className="pr-mc-fixtures-page pr-player-profile">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/players">Players</Link>
        <span aria-hidden>/</span>
        <Link href={`/players/${playerA.slug}`}>{playerA.name}</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">vs {playerB.name}</span>
      </nav>

      <h1 className="pr-player-profile-header__name">
        {playerA.name} vs {playerB.name}
      </h1>

      <PlayerComparison
        playerA={playerA}
        playerB={playerB}
        rankingsA={playerA.rankings}
        rankingsB={playerB.rankings}
        metrics={metrics}
      />
    </article>
  );
}
