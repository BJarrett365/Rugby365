import Link from "next/link";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { formatPublicDate, formatPublicKickoff } from "@/lib/public-entity-profile-utils";
import {
  PublicEntityAvatar,
  PublicEntityBreadcrumbs,
  PublicEntityFact,
  PublicEntityPreviewBanner,
  PublicEntitySection,
} from "@/components/entities/PublicEntityProfileBits";

export function PublicCoachProfileView({ profile }: { profile: PublicCoachProfile }) {
  const currentRoles = profile.assignments.filter((a) => a.isCurrent);
  const pastRoles = profile.assignments.filter((a) => !a.isCurrent);

  return (
    <article className="pr-mc-fixtures-page pr-player-profile pr-entity-profile">
      <PublicEntityPreviewBanner preview={profile.preview} />
      <PublicEntityBreadcrumbs
        items={[
          { href: "/matches", label: "Home" },
          { label: "Coaches" },
          { label: profile.name, current: true },
        ]}
      />

      <header className="pr-entity-header">
        <PublicEntityAvatar name={profile.name} imageUrl={profile.imageUrl} />
        <div>
          <p className="pr-mc-pr-badge">Coach profile</p>
          <h1 className="pr-player-header__name">{profile.name}</h1>
          <ul className="pr-player-header__meta">
            {profile.nationality ? <li>{profile.nationality}</li> : null}
            {profile.age != null ? <li>Age {profile.age}</li> : null}
            {currentRoles[0] ? (
              <li>
                {currentRoles[0].roleLabel}
                {currentRoles[0].teamName ? ` · ${currentRoles[0].teamName}` : ""}
              </li>
            ) : null}
          </ul>
        </div>
      </header>

      <dl className="pr-player-quick-facts">
        <PublicEntityFact label="Born" value={formatPublicDate(profile.birthDate)} />
        <PublicEntityFact label="Nationality" value={profile.nationality} />
        <PublicEntityFact label="Current roles" value={currentRoles.length || "—"} />
        <PublicEntityFact label="Recent matches" value={profile.recentMatches.length || "—"} />
      </dl>

      {profile.bioSummary ? (
        <PublicEntitySection title="About">
          <p className="pr-entity-bio">{profile.bioSummary}</p>
        </PublicEntitySection>
      ) : null}

      <PublicEntitySection title="Coaching roles">
        {profile.assignments.length === 0 ? (
          <p className="pr-entity-empty">No coaching assignments linked.</p>
        ) : (
          <ul className="pr-entity-list">
            {[...currentRoles, ...pastRoles].map((row) => (
              <li key={row.id}>
                <Link href={`/teams/${row.teamSlug}`}>
                  <span className="pr-entity-list__main">
                    {row.teamName ?? "Unknown team"}
                    {row.isCurrent ? " · current" : ""}
                  </span>
                  <span className="pr-entity-list__meta">
                    {row.roleLabel}
                    {row.seasonLabel ? ` · ${row.seasonLabel}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PublicEntitySection>

      <PublicEntitySection title="Recent matches">
        {profile.recentMatches.length === 0 ? (
          <p className="pr-entity-empty">No fixtures linked to this coach yet.</p>
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
                  <span className="pr-entity-list__meta">{row.side === "home" ? "Home" : "Away"}</span>
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
