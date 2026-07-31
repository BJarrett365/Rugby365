import type { Metadata } from "next";
import { ComparePlayersPicker } from "@/components/players/ComparePlayersPicker";

export const metadata: Metadata = {
  title: "Compare players | Rugby365",
  description: "Head-to-head player comparison — ratings, market value and stats.",
};

export default function ComparePlayersPage() {
  return (
    <article className="pr-mc-fixtures-page">
      <header className="mb-4">
        <p className="pr-mc-pr-badge">Players</p>
        <h1 className="pr-player-profile-header__name">Compare players</h1>
        <p className="text-sm text-[var(--pr-mc-grey,#a7adac)] mt-1 mb-0">
          For each side: competition → team → player (or search). Players can come from different competitions.
        </p>
      </header>
      <ComparePlayersPicker />
    </article>
  );
}
