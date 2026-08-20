import Link from "next/link";
import { HonourIcon } from "@/components/honours/HonourIcons";
import type { PublicPlayerKeyAchievementTile } from "@/lib/public-player-overview-v2-service";

export type PlayerKeyAchievementsCardProps = {
  slug: string;
  tiles: PublicPlayerKeyAchievementTile[];
};

/** KEY ACHIEVEMENTS widget — trophies/honours from CMS; never invents titles. */
export function PlayerKeyAchievementsCard({ slug, tiles }: PlayerKeyAchievementsCardProps) {
  const shown = tiles.slice(0, 4);

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card pr-player-v2__achievements-card">
      <div className="pr-player-v2__card-head">
        <h2>Key Achievements</h2>
      </div>
      {shown.length === 0 ? (
        <p className="pr-player-v2__empty">No achievements recorded yet.</p>
      ) : (
        <div
          className="pr-player-v2__honours"
          data-count={shown.length}
          aria-label="Key achievements"
        >
          {shown.map((a) => (
            <div className="pr-player-v2__honours-tile" key={a.id}>
              <div className="pr-player-v2__honours-icon" aria-hidden>
                <HonourIcon iconKey={a.iconKey} size={36} />
              </div>
              <div className="pr-player-v2__honours-title">{a.title}</div>
              <div className="pr-player-v2__honours-years">{a.yearsLabel}</div>
              {a.resultLabel ? (
                <div className="pr-player-v2__honours-result">{a.resultLabel}</div>
              ) : null}
              {a.verificationStatus !== "verified" ? (
                <div className="pr-player-v2__honours-note">
                  {a.verificationStatus === "title_record"
                    ? "Title record"
                    : a.verificationStatus === "review"
                      ? "Pending verification"
                      : "Unverified"}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="pr-player-v2__card-foot">
        <Link className="pr-player-v2__card-link" href={`/players/${slug}/career#honours`}>
          View all achievements &gt;
        </Link>
      </div>
    </div>
  );
}
