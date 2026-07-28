"use client";

import { use } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchSourcesPanel } from "@/components/admin/MatchSourcesPanel";

export default function MatchSourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Sources"
      description="Provider URLs and source mapping for this match."
    >
      <div className="cms-card">
        <MatchSourcesPanel fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
