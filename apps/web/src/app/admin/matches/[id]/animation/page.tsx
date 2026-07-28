import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchTrackerSettingsPanel } from "@/components/admin/MatchTrackerSettingsPanel";

export default function MatchAnimationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Match Animation"
      description="Public animation / tracker settings for this fixture."
    >
      <div className="cms-card">
        <MatchTrackerSettingsPanel fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
