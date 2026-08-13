import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPlayerStatsV2 } from "@/components/players/PublicPlayerStatsV2";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { getPlayerStats } from "@/lib/public-player-stats-v2-service";
import type { PlayerStatsPeriod, PlayerStatsSection } from "@/lib/public-player-stats-v2-types";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    preview?: string;
    period?: string;
    section?: string;
    season?: string;
    scope?: string;
    competitionId?: string;
    teamId?: string;
  }>;
};

const SECTIONS = new Set<PlayerStatsSection>([
  "summary",
  "attack",
  "kicking",
  "defence",
  "breakdown",
  "discipline",
  "game-log",
]);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: false });
  const name = overview?.displayName ?? slug;
  return {
    title: `Stats | ${name} | Rugby365`,
    description: `Match statistics for ${name}`,
  };
}

export default async function PlayerStatsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const preview = isPreviewParam(sp.preview);
  const overview = await getPublicPlayerOverviewV2(slug, { preview });
  if (!overview) notFound();

  const period: PlayerStatsPeriod = sp.period === "career" ? "career" : "season";
  const section: PlayerStatsSection =
    sp.section && SECTIONS.has(sp.section as PlayerStatsSection)
      ? (sp.section as PlayerStatsSection)
      : "summary";

  const stats = await getPlayerStats(overview.playerId, {
    season: sp.season ?? null,
    scope: sp.scope === "club" || sp.scope === "international" ? sp.scope : "all",
    competitionId: sp.competitionId ?? null,
    teamId: sp.teamId ?? null,
    period,
  });
  if (!stats) notFound();

  return (
    <PublicPlayerStatsV2
      overview={overview}
      stats={stats}
      initialPeriod={period}
      initialSection={section}
    />
  );
}
