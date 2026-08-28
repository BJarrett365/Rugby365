import type { Metadata } from "next";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PublicPlayerRankingsBoardView } from "@/components/rankings/PublicPlayerRankingsBoardView";
import {
  RANKING_POSITION_GROUPS,
  buildPlayerRankingsTitle,
  type PlayerRankingMode,
} from "@/lib/player-ranking-engine";
import {
  getPublicPlayerRankingsBoard,
  listRankingFilterOptions,
} from "@/lib/public-player-rankings-product-service";

/** Rankings boards are snapshot-backed + memory-cached; refresh at most every minute. */
export const revalidate = 60;

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const mode = (one(sp.mode) as PlayerRankingMode | null) ?? "current";
  const position = one(sp.position);
  const positionLabel =
    RANKING_POSITION_GROUPS.find((g) => g.key === position)?.label ?? null;
  const title = buildPlayerRankingsTitle({
    mode,
    top: 10,
    positionLabel,
    nationLabel: one(sp.nation),
    clubLabel: one(sp.club),
    competitionLabel: one(sp.competition),
  });
  return {
    title: `${title} | Rugby365 Player Rankings`,
    description:
      "Rugby365 Player Rankings — current and all-time boards powered by the R365 Rating Model. Filter by position, country, club and competition.",
  };
}

export default async function PlayerRankingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = (await searchParams) ?? {};
  const mode = (one(sp.mode) as PlayerRankingMode | null) ?? "current";
  const filters = {
    mode,
    position: one(sp.position),
    nation: one(sp.nation),
    club: one(sp.club),
    competition: one(sp.competition),
    top: 10,
    era: one(sp.era),
  };

  const [board, options] = await Promise.all([
    getPublicPlayerRankingsBoard(filters),
    listRankingFilterOptions(),
  ]);

  return (
    <article className="pr-player-v2">
      <div className="pr-player-v2__inner pr-rankings-page">
        <PlayerPublicBreadcrumb
          items={[
            { label: "Rankings", href: "/rankings" },
            { label: "Player Rankings" },
          ]}
        />
        <PublicPlayerRankingsBoardView board={board} options={options} />
      </div>
    </article>
  );
}
