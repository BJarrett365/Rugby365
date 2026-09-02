import { PublicRefereeOverviewV2 } from "@/components/referees/PublicRefereeOverviewV2";
import { mergeRefereeDashboard } from "@/lib/referee-dashboard-merge";
import type { PublicRefereeProfile } from "@/lib/public-referee-profile-service";

export function PublicRefereeProfileView({ profile }: { profile: PublicRefereeProfile }) {
  const model = mergeRefereeDashboard(profile);
  return <PublicRefereeOverviewV2 model={model} preview={profile.preview} />;
}
