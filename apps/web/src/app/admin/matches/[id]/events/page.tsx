import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchEventsEditor } from "@/components/admin/MatchEventsEditor";

export default function MatchEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Events / Comment"
      description="Scoring, cards, TMO and timeline events for this match."
      showInfoHeader={false}
    >
      <div className="cms-card">
        <MatchEventsEditor fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
