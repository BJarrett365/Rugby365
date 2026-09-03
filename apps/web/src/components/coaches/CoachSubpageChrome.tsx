import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { formatPublicDate } from "@/lib/public-entity-profile-utils";
import { CoachPublicSubNav } from "./CoachPublicSubNav";
import { CoachShowcaseHero } from "./CoachShowcaseHero";
import { PublicEntityPreviewBanner } from "@/components/entities/PublicEntityProfileBits";

const FLAGS: Record<string, string> = {
  ireland: "🇮🇪",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "south africa": "🇿🇦",
  "new zealand": "🇳🇿",
  wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  france: "🇫🇷",
  australia: "🇦🇺",
  argentina: "🇦🇷",
  italy: "🇮🇹",
};

function flagFor(name: string | null | undefined): string | null {
  if (!name) return null;
  return FLAGS[name.trim().toLowerCase()] ?? null;
}

export function CoachSubpageChrome({
  profile,
  active,
  children,
  variant = "sidebar",
}: {
  profile: PublicCoachProfile;
  active: string;
  children: ReactNode;
  variant?: "sidebar" | "showcase";
}) {
  if (variant === "showcase") {
    return (
      <article className="pr-coach-profile">
        <PublicEntityPreviewBanner preview={profile.preview} />
        <CoachPublicSubNav slug={profile.slug} active={active} />
        <CoachShowcaseHero profile={profile} />
        <div className="pr-coach-showcase-body">{children}</div>
      </article>
    );
  }
  const highlights = [
    ...profile.honours.slice(0, 4).map((h) =>
      [h.year, h.competitionName, h.teamName].filter(Boolean).join(" · "),
    ),
    ...profile.awards.slice(0, 2).map((a) => [a.year, a.awardName].filter(Boolean).join(" · ")),
    ...profile.milestones.slice(0, 2).map((m) => [m.milestoneYear, m.title].filter(Boolean).join(" · ")),
  ].filter(Boolean).slice(0, 6);

  const birth = profile.birthDate
    ? `${formatPublicDate(profile.birthDate)}${profile.age != null ? ` (${profile.age})` : ""}`
    : "—";

  return (
    <article className="pr-coach-profile">
      <PublicEntityPreviewBanner preview={profile.preview} />
      <CoachPublicSubNav slug={profile.slug} active={active} />
      <div className="pr-coach-sub">
        <aside className="pr-coach-sub__side">
          <div className="pr-coach-sub__photo">
            {profile.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.imageUrl} alt={profile.displayName} />
            ) : (
              <span className="pr-coach-sub__photo-fallback" aria-hidden />
            )}
          </div>
          <span className="pr-coach-sub__badge">Coach</span>
          <h1 className="pr-coach-sub__name">{profile.displayName}</h1>
          <p className="pr-coach-sub__role">
            {profile.currentRole?.roleLabel ?? "Coach"}
            {profile.currentRole?.teamName ? (
              <>
                {" · "}
                {profile.currentRole.teamName}
                {flagFor(profile.currentRole.teamName) ? (
                  <span aria-hidden> {flagFor(profile.currentRole.teamName)}</span>
                ) : null}
              </>
            ) : null}
          </p>
          <dl className="pr-coach-sub__facts">
            <div>
              <dt>Date of birth</dt>
              <dd>{birth}</dd>
            </div>
            <div>
              <dt>Nationality</dt>
              <dd>
                {profile.nationality ?? "—"}
                {flagFor(profile.nationality) ? (
                  <span aria-hidden> {flagFor(profile.nationality)}</span>
                ) : null}
                {profile.secondNationality ? (
                  <>
                    {" / "}
                    {profile.secondNationality}
                    {flagFor(profile.secondNationality) ? (
                      <span aria-hidden> {flagFor(profile.secondNationality)}</span>
                    ) : null}
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Coach since</dt>
              <dd>{profile.appointedOn?.slice(0, 4) ?? profile.coachingCareerStartYear ?? "—"}</dd>
            </div>
          </dl>
          {highlights.length > 0 ? (
            <div className="pr-coach-sub__highlights">
              <h2>Career highlights</h2>
              <ul>
                {highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link className="pr-coach-sub__back" href={`/coaches/${profile.slug}`}>
            View full overview &gt;
          </Link>
        </aside>
        <div className="pr-coach-sub__main">{children}</div>
      </div>
    </article>
  );
}
