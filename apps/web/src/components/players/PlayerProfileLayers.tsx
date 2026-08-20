import type { PublicPlayerProfile } from "@/lib/public-player-profile-service";
import { ProfileFact } from "@/components/players/ProfileFact";

/** Profile layer stubs — keep imports resolvable while layers are restored. */
export function PlayerOverviewIdentity({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact label="Player" value={profile.name} />
    </div>
  );
}

export function PlayerClubLayer({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact label="Club" value={profile.club?.name ?? null} />
    </div>
  );
}

export function PlayerInternationalLayer({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact label="International" value={profile.nationName} />
    </div>
  );
}

export function PlayerScoutLayer({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact label="Scout" value={profile.name} />
    </div>
  );
}

export function PlayerEducationLayer({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact label="School" value={profile.school} />
      <ProfileFact label="University" value={profile.university} />
    </div>
  );
}

export function PlayerResearchLayer({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact label="Research" value={profile.name} />
    </div>
  );
}

export function PlayerSourcesLayer({ profile }: { profile: PublicPlayerProfile }) {
  return (
    <div className="pr-player-card">
      <ProfileFact
        label="Sources"
        value={profile.sources?.labels?.join(" · ") ?? null}
      />
    </div>
  );
}
