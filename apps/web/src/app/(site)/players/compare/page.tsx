import type { Metadata } from "next";
import Link from "next/link";
import { AnchoredPlayerCompare } from "@/components/players/AnchoredPlayerCompare";
import { ComparePlayersPicker } from "@/components/players/ComparePlayersPicker";
import {
  getCompareLitePlayer,
  toCompareLiteCard,
} from "@/lib/player-compare-lite-service";

export const metadata: Metadata = {
  title: "Compare players | Rugby365",
  description: "Head-to-head player comparison — ratings, market value and stats.",
};

type PageProps = {
  searchParams: Promise<{
    player1?: string;
    player2?: string;
    player?: string;
    opponent?: string;
    compare?: string;
  }>;
};

export default async function ComparePlayersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const playerA = sp.player1?.trim() || sp.player?.trim() || null;
  const playerB = sp.player2?.trim() || sp.opponent?.trim() || sp.compare?.trim() || null;

  const anchoredFromProfile = Boolean(sp.player?.trim() && !sp.player1?.trim());

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
            <p className="pr-mc-pr-badge">Players</p>
            <h1 className="pr-player-profile-header__name">Compare {anchored.displayName}</h1>
            <p className="text-sm text-[var(--pr-mc-grey,#a7adac)] mt-1 mb-0">
              Full profiles side by side — Overview, Stats, Career, Performance, Intelligence,
              Rating, Comparison and News. Scroll within each column to compare.{" "}
              <Link
                href={`/players/${anchored.slug}`}
                className="text-[var(--pr-mc-link,#54b989)] hover:underline"
              >
                Back to profile
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
        <p className="pr-mc-pr-badge">Players</p>
        <h1 className="pr-player-profile-header__name">Compare players</h1>
        <p className="text-sm text-[var(--pr-mc-grey,#a7adac)] mt-1 mb-0">
          Player A vs Player B — search or pick from the lists. No clubs or competitions to choose.
        </p>
      </header>
      <ComparePlayersPicker initialPlayerA={playerA} initialPlayerB={playerB} />
    </article>
  );
}
