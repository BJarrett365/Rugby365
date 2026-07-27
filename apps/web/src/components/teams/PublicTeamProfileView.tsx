import Link from "next/link";
import type { PublicTeamProfile } from "@/lib/public-team-profile-service";
import { formatPublicKickoff } from "@/lib/public-entity-profile-utils";
import {
  PublicEntityAvatar,
  PublicEntityBreadcrumbs,
  PublicEntityFact,
  PublicEntityPreviewBanner,
  PublicEntitySection,
} from "@/components/entities/PublicEntityProfileBits";

function resultLabel(result: PublicTeamProfile["recentResults"][number]["result"]) {
  if (result === "won") return "W";
  if (result === "lost") return "L";
  if (result === "draw") return "D";
  return "—";
}

export function PublicTeamProfileView({ profile }: { profile: PublicTeamProfile }) {
  return (
    <article className="pr-mc-fixtures-page pr-player-profile pr-entity-profile">
      <PublicEntityPreviewBanner preview={profile.preview} />
      <PublicEntityBreadcrumbs
        items={[
          { href: "/matches", label: "Home" },
          { label: "Teams" },
          { label: profile.name, current: true },
        ]}
      />

      <header className="pr-entity-header">
        <PublicEntityAvatar name={profile.name} imageUrl={profile.imageUrl} size={104} />
        <div>
          <p className="pr-mc-pr-badge">Team profile</p>
          <h1 className="pr-player-header__name">{profile.name}</h1>
          <ul className="pr-player-header__meta">
            {profile.shortName ? <li>{profile.shortName}</li> : null}
            {profile.countryName ? <li>{profile.countryName}</li> : null}
            {profile.teamType ? <li>{profile.teamType}</li> : null}
            {profile.homeVenueName ? <li>{profile.homeVenueName}</li> : null}
          </ul>
        </div>
      </header>

      <dl className="pr-player-quick-facts">
        <PublicEntityFact label="Founded" value={profile.foundedYear} />
        <PublicEntityFact label="Region" value={profile.region} />
        <PublicEntityFact label="Hemisphere" value={profile.hemisphere} />
        <PublicEntityFact
          label="Record"
          value={`${profile.results.won}W · ${profile.results.drawn}D · ${profile.results.lost}L`}
        />
      </dl>

      {profile.bioSummary ? (
        <PublicEntitySection title="About">
          <p className="pr-entity-bio">{profile.bioSummary}</p>
        </PublicEntitySection>
      ) : null}

      <PublicEntitySection title="Recent results">
        {profile.recentResults.length === 0 ? (
          <p className="pr-entity-empty">No completed matches yet.</p>
        ) : (
          <ul className="pr-entity-list">
            {profile.recentResults.map((row) => (
              <li key={row.id}>
                <Link href={`/matches/${row.slug}`}>
                  <span className="pr-entity-list__date">{formatPublicKickoff(row.kickoffAt)}</span>
                  <span className="pr-entity-list__main">
                    {row.side === "home" ? "vs" : "@"} {row.opponentName}
                  </span>
                  <span className="pr-entity-list__score">
                    {row.teamScore}–{row.opponentScore}
                  </span>
                  <span className="pr-entity-list__result">{resultLabel(row.result)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PublicEntitySection>

      <PublicEntitySection title="Upcoming">
        {profile.upcoming.length === 0 ? (
          <p className="pr-entity-empty">No upcoming fixtures.</p>
        ) : (
          <ul className="pr-entity-list">
            {profile.upcoming.map((row) => (
              <li key={row.id}>
                <Link href={`/matches/${row.slug}`}>
                  <span className="pr-entity-list__date">{formatPublicKickoff(row.kickoffAt)}</span>
                  <span className="pr-entity-list__main">
                    {row.side === "home" ? "vs" : "@"} {row.opponentName}
                  </span>
                  <span className="pr-entity-list__meta">{row.competitionName ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PublicEntitySection>

      <PublicEntitySection title="Squad">
        {profile.squad.length === 0 ? (
          <p className="pr-entity-empty">No recent squad data.</p>
        ) : (
          <>
            {profile.squadFixture ? (
              <p className="pr-entity-note">
                From{" "}
                <Link href={`/matches/${profile.squadFixture.slug}`}>
                  {profile.squadFixture.opponentName}
                </Link>
                {profile.squadFixture.kickoffAt
                  ? ` · ${formatPublicKickoff(profile.squadFixture.kickoffAt)}`
                  : ""}
              </p>
            ) : null}
            <ul className="pr-entity-list pr-entity-list--squad">
              {profile.squad.map((p) => (
                <li key={p.playerId}>
                  <Link href={`/players/${p.slug}`}>
                    <span className="pr-entity-list__num">
                      {p.jerseyNumber != null ? `#${p.jerseyNumber}` : "—"}
                    </span>
                    <span className="pr-entity-list__main">{p.name}</span>
                    <span className="pr-entity-list__meta">
                      {p.positionName ?? p.squadRole}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </PublicEntitySection>

      <PublicEntitySection title="Coaching staff">
        {profile.coachingStaff.current.length === 0 ? (
          <p className="pr-entity-empty">No current coaching staff linked.</p>
        ) : (
          <ul className="pr-entity-list">
            {profile.coachingStaff.current.map((row) => (
              <li key={row.id}>
                <Link href={`/coaches/${row.coachSlug}`}>
                  <span className="pr-entity-list__main">{row.coachName}</span>
                  <span className="pr-entity-list__meta">{row.roleLabel}</span>
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
