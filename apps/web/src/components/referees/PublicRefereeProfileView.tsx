import Link from "next/link";
import type { PublicRefereeProfile } from "@/lib/public-referee-profile-service";
import { formatPublicDate, formatPublicKickoff } from "@/lib/public-entity-profile-utils";
import {
  PublicEntityAvatar,
  PublicEntityBreadcrumbs,
  PublicEntityFact,
  PublicEntityPreviewBanner,
  PublicEntitySection,
} from "@/components/entities/PublicEntityProfileBits";

export function PublicRefereeProfileView({ profile }: { profile: PublicRefereeProfile }) {
  return (
    <article className="pr-mc-fixtures-page pr-player-profile pr-entity-profile">
      <PublicEntityPreviewBanner preview={profile.preview} />
      <PublicEntityBreadcrumbs
        items={[
          { href: "/matches", label: "Home" },
          { label: "Referees" },
          { label: profile.name, current: true },
        ]}
      />

      <header className="pr-entity-header">
        <PublicEntityAvatar name={profile.name} imageUrl={profile.imageUrl} />
        <div>
          <p className="pr-mc-pr-badge">Referee profile</p>
          <h1 className="pr-player-header__name">{profile.name}</h1>
          <ul className="pr-player-header__meta">
            {profile.countryName ? <li>{profile.countryName}</li> : null}
            {profile.nationality ? <li>{profile.nationality}</li> : null}
            <li>{profile.matchCount} matches</li>
          </ul>
        </div>
      </header>

      <dl className="pr-player-quick-facts">
        <PublicEntityFact label="Born" value={formatPublicDate(profile.birthDate)} />
        <PublicEntityFact label="Country" value={profile.countryName} />
        <PublicEntityFact label="Nationality" value={profile.nationality} />
        <PublicEntityFact label="Fixtures" value={profile.matchCount} />
      </dl>

      {profile.bioSummary ? (
        <PublicEntitySection title="About">
          <p className="pr-entity-bio">{profile.bioSummary}</p>
        </PublicEntitySection>
      ) : null}

      <PublicEntitySection title="Recent appointments">
        {profile.recentMatches.length === 0 ? (
          <p className="pr-entity-empty">No fixtures linked to this referee yet.</p>
        ) : (
          <ul className="pr-entity-list">
            {profile.recentMatches.map((row) => (
              <li key={row.id}>
                <Link href={`/matches/${row.slug}`}>
                  <span className="pr-entity-list__date">{formatPublicKickoff(row.kickoffAt)}</span>
                  <span className="pr-entity-list__main">
                    {row.homeTeamName ?? "TBC"} {row.homeScore}–{row.awayScore}{" "}
                    {row.awayTeamName ?? "TBC"}
                  </span>
                  <span className="pr-entity-list__meta">{row.competitionName ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PublicEntitySection>

      {profile.wikipediaUrl ? (
        <p className="pr-entity-source">
          <a href={profile.wikipediaUrl} target="_blank" rel="noreferrer">
            Wikipedia
          </a>
        </p>
      ) : null}
    </article>
  );
}
