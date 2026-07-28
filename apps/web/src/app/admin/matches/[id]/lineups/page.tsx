import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchLineupsEditor } from "@/components/admin/MatchLineupsEditor";

export default function MatchLineupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Lineups"
      description="Starting XV, bench and formation for both teams."
      showInfoHeader={false}
    >
      <div className="cms-card">
        <MatchLineupsEditor fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
