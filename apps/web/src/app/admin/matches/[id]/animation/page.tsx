import Link from "next/link";
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
      <div className="cms-card space-y-4">
        <p className="m-0 text-sm text-zinc-400">
          Public Listen control lives on Match Animation. Manage Lead/Analyst drafts in{" "}
          <Link href={`/admin/matches/${id}/audio`} className="text-[var(--pr-gold)] hover:underline">
            Audio
          </Link>{" "}
          or{" "}
          <Link
            href={`/admin/matches/${id}/commentary`}
            className="text-[var(--pr-gold)] hover:underline"
          >
            Live Commentary
          </Link>
          .
        </p>
        <MatchTrackerSettingsPanel fixtureId={id} />
      </div>
    </MatchCmsFeatureShell>
  );
}
