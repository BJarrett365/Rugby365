import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnchoredPlayerCompare } from "@/components/players/AnchoredPlayerCompare";
import { ComparePlayersPicker } from "@/components/players/ComparePlayersPicker";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";
import {
  getCompareLitePlayer,
  toCompareLiteCard,
} from "@/lib/player-compare-lite-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    player1?: string;
    player2?: string;
    player?: string;
    opponent?: string;
    compare?: string;
  }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  const name = competition?.name ?? "Competition";
  return {
    title: `Compare players | ${name}`,
    description: `Head-to-head player comparison for ${name} — ratings, market value and stats.`,
  };
}

export default async function CompetitionComparePlayersPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const sp = await searchParams;
  const playerA = sp.player1?.trim() || sp.player?.trim() || null;
  const playerB = sp.player2?.trim() || sp.opponent?.trim() || sp.compare?.trim() || null;
  const anchoredFromProfile = Boolean(playerA);

  if (anchoredFromProfile && playerA) {
    const [anchoredPlayer, opponentPlayer] = await Promise.all([
      getCompareLitePlayer(playerA, { ensureValueHistory: false }),
      playerB ? getCompareLitePlayer(playerB, { ensureValueHistory: false }) : Promise.resolve(null),
    ]);

    if (anchoredPlayer) {
      const anchored = toCompareLiteCard(anchoredPlayer);
      const initialOpponent = opponentPlayer ? toCompareLiteCard(opponentPlayer) : null;
      return (
        <article className="pr-mc-fixtures-page pr-player-v2">
          <header className="mb-4">
            <p className="pr-mc-pr-badge">{competition.name}</p>
            <h1 className="pr-player-profile-header__name">Compare {anchored.displayName}</h1>
            <p className="text-sm text-[var(--pr-mc-grey,#a7adac)] mt-1 mb-0">
              Full profiles side by side — Overview, Stats, Career, Performance, Intelligence,
              Rating, Comparison and News. Scroll within each column to compare.{" "}
              <Link
                href={`/competitions/${competition.slug}/compare`}
                className="text-[var(--pr-mc-link,#54b989)] hover:underline"
              >
                Choose different players
              </Link>
            </p>
          </header>

          <AnchoredPlayerCompare
            anchored={anchored}
            initialOpponentSlug={playerB}
            initialOpponent={initialOpponent}
          />
        </article>
      );
    }
  }

  return (
    <article className="pr-mc-fixtures-page">
      <header className="mb-4">
        <p className="pr-mc-pr-badge">{competition.name}</p>
        <h1 className="pr-player-profile-header__name">Compare players</h1>
        <p className="text-sm text-[var(--pr-mc-grey,#a7adac)] mt-1 mb-0">
          Search two players by name — no need to pick a club. Profiles open side by side.
        </p>
      </header>
      <ComparePlayersPicker
        competitionSlug={competition.slug}
        competitionName={competition.name}
        searchOnly
      />
    </article>
  );
}
