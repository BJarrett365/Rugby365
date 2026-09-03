import Link from "next/link";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { coachHeroNameLines } from "@/lib/coach-display-name";
import { formatPublicDate } from "@/lib/public-entity-profile-utils";
import { HonourTrophyIcon } from "@/components/honours/HonourIcons";

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

export function CoachShowcaseHero({ profile }: { profile: PublicCoachProfile }) {
  const names = coachHeroNameLines({
    name: profile.name,
    knownAs: profile.knownAs,
    fullName: profile.fullName,
  });
  const teamName = profile.currentRole?.teamName ?? profile.teamDashboard?.teamName ?? null;
  const teamFlag = flagFor(teamName) ?? flagFor(profile.nationality);
  const appointedYear = profile.appointedOn?.slice(0, 4) ?? profile.currentRole?.startDate?.slice(0, 4) ?? null;
  const contractYear = profile.contractExpiresOn?.slice(0, 4) ?? null;
  const yearsInRole =
    appointedYear != null ? Math.max(1, new Date().getFullYear() - Number(appointedYear)) : null;
  const tiles = profile.majorHonoursGrouped.slice(0, 3).map((h) => ({
    key: h.key,
    count: h.count,
    label: h.label.replace(/^THE\s+/i, ""),
    sub: null as string | null,
  }));
  if (yearsInRole != null && tiles.length < 4) {
    tiles.push({
      key: "years-in-role",
      count: yearsInRole,
      label: "Years in Role",
      sub: appointedYear ? `${appointedYear} – Present` : null,
    });
  }

  return (
    <section className="pr-coach-showcase-hero">
      <div className="pr-coach-showcase-hero__photo">
        {profile.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.imageUrl} alt={profile.displayName} />
        ) : (
          <span className="pr-coach-showcase-hero__photo-fallback" aria-hidden />
        )}
        <dl className="pr-coach-showcase-hero__overlay">
          <div>
            <dt>Nationality</dt>
            <dd>
              {flagFor(profile.nationality) ? <span aria-hidden>{flagFor(profile.nationality)} </span> : null}
              {profile.nationality ?? "—"}
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{profile.currentRole?.roleLabel ?? "Coach"}</dd>
          </div>
          <div>
            <dt>Date of Birth</dt>
            <dd>{profile.birthDate ? formatPublicDate(profile.birthDate) : "—"}</dd>
          </div>
          <div>
            <dt>Place of Birth</dt>
            <dd>
              {[profile.placeOfBirth, profile.countryOfBirth].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="pr-coach-showcase-hero__copy">
        <span className="pr-coach-showcase-hero__badge">
          {profile.currentRole?.roleLabel ?? "Head Coach"}
        </span>
        <h1>
          <span>{names.line1}</span>
          {names.line2 ? <strong>{names.line2}</strong> : null}
        </h1>
        {teamName ? (
          <p className="pr-coach-showcase-hero__team">
            {teamFlag ? <span aria-hidden>{teamFlag} </span> : null}
            {/ireland/i.test(teamName) ? "Ireland National Team" : teamName}
          </p>
        ) : null}
        <dl className="pr-coach-showcase-hero__facts">
          <div>
            <dt>Age</dt>
            <dd>{profile.age ?? "—"}</dd>
          </div>
          <div>
            <dt>Current Role</dt>
            <dd>{profile.currentRole?.roleLabel ?? "Coach"}</dd>
          </div>
          <div>
            <dt>Appointed</dt>
            <dd>{appointedYear ?? "—"}</dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>{contractYear ?? "—"}</dd>
          </div>
        </dl>
        {profile.bioSummary ? <p className="pr-coach-showcase-hero__bio">{profile.bioSummary}</p> : null}
        {tiles.length > 0 ? (
          <div className="pr-coach-showcase-hero__tiles">
            {tiles.map((tile) => (
              <article key={tile.key}>
                <HonourTrophyIcon size={22} />
                <strong>{tile.count}</strong>
                <span>{tile.label}</span>
                {tile.sub ? <em>{tile.sub}</em> : null}
              </article>
            ))}
          </div>
        ) : null}
        <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}`}>
          View full overview &gt;
        </Link>
      </div>
    </section>
  );
}
