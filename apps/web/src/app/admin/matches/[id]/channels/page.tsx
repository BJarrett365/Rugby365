import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchBroadcastersEditor } from "@/components/admin/MatchBroadcastersEditor";

export default function MatchChannelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Add Match Channel"
      description="TV and streaming by territory — UK, South Africa, Australia, New Zealand, France."
    >
      <div className="cms-card">
        <MatchBroadcastersEditor fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
