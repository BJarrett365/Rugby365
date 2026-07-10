import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata = {
  title: "Insight Stats · Rugby365 CMS",
};

export default function InsightStatsAdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Opta Stats"
        title="Insight Stats"
        description="Central Stats Brain hub for generating, reviewing and publishing insight stats across players, teams, matches, competitions and more."
      />
      <div className="cms-card max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Phase 1 of Insight Stats is planned but not yet built in the CMS. Performance data is
          already available on player, team and match pages after Planet Rugby / SDMS import.
        </p>
        <p className="text-sm text-zinc-500 m-0 mt-3">
          Specification:{" "}
          <code className="text-zinc-400">docs/stats-brain/INSIGHT_STATS.md</code>
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/admin/opta-stats" className="cms-btn cms-btn--secondary">
            Back to Opta Stats
          </Link>
          <Link href="/admin/players" className="cms-btn cms-btn--secondary">
            Players
          </Link>
          <Link href="/admin/matches/import" className="cms-btn cms-btn--primary">
            Import match stats
          </Link>
        </div>
      </div>
    </>
  );
}
