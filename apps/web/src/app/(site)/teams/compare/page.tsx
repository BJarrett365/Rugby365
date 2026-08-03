import type { Metadata } from "next";
import { CompareTeamsPicker } from "@/components/teams/CompareTeamsPicker";

export const metadata: Metadata = {
  title: "Compare teams | Rugby365",
  description:
    "Head-to-head team comparison — squad value, team rating, form, trophies and H2H.",
};

export default function CompareTeamsPage() {
  return (
    <article className="pr-mc-fixtures-page">
      <header className="mb-4">
        <p className="pr-mc-pr-badge">Teams</p>
        <h1 className="pr-player-profile-header__name">Compare teams</h1>
        <p className="text-sm text-[var(--pr-mc-grey,#a7adac)] mt-1 mb-0">
          Competition → team for each side. Defaults to Nations Championship.
        </p>
      </header>
      <CompareTeamsPicker />
    </article>
  );
}
