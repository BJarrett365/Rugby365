import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchTeamStatsEditor } from "@/components/admin/MatchTeamStatsEditor";

export default function MatchStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Match Statistics"
      description="Team-level match stats (possession, metres, tackles, and more)."
      showInfoHeader={false}
    >
      <div className="cms-card">
        <MatchTeamStatsEditor fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
