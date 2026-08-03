import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchPlayerStatsEditor } from "@/components/admin/MatchPlayerStatsEditor";

export default function MatchPlayerStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Player Statistics"
      description="Per-player match performance grid for home and away."
      showInfoHeader={false}
    >
      <div className="cms-card">
        <MatchPlayerStatsEditor fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
