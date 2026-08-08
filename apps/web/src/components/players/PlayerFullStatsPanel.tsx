"use client";

import type { PublicPlayerProfile } from "@/lib/public-player-profile-service";

/**
 * Full stats panel for the public player Stats tab.
 * Restored stub after the source file went missing mid-session;
 * expand again when wiring the stats-engine API.
 */
export function PlayerFullStatsPanel({
  profile,
  season: _season,
}: {
  profile: PublicPlayerProfile;
  season?: string | null;
}) {
  return (
    <div className="pr-player-card">
      <p className="pr-mc-transfers-muted m-0">
        Detailed full-stats view for {profile.name} is being rebuilt. Season filters and match logs
        remain on this Stats tab below.
      </p>
    </div>
  );
}
