import Link from "next/link";
import type { PublicPlayerProfile } from "@/lib/public-player-profile-service";
import { PlayerBadge } from "@/components/players/PlayerBadge";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { formatStatValue } from "@/lib/public-player-intro";

export type PlayerProfileHeaderProps = {
  profile: PublicPlayerProfile;
  compareHref?: string | null;
  /** Link to the Value tab — keeps original market-value shortcut. */
  valueHref?: string | null;
};

/**
 * Public profile header — Player Shield is the identity visual (mockup).
 * Rating / value / contract tiles sit beside bio facts.
 */
export function PlayerProfileHeader({
  profile,
  compareHref,
  valueHref,
}: PlayerProfileHeaderProps) {
  const value = profile.playerValue;
  const rankings = profile.rankings;

  return (
    <header className="pr-player-profile-header">
      <div className="pr-player-profile-header__visuals">
        <p className="pr-player-profile-header__shield-label">Player badge</p>
        <PlayerBadge
          name={profile.name}
          imageUrl={profile.badgeImageUrl ?? profile.imageUrl}
          cutout={Boolean(profile.badgeImageUrl)}
          rating={profile.rating.current}
          positionName={profile.positionName}
          nationName={profile.nationName}
          nationImageUrl={profile.internationalTeam?.imageUrl}
          clubName={profile.club?.name}
          clubImageUrl={profile.club?.imageUrl}
          age={profile.age}
          marketValueLabel={value?.marketValueLabel}
          worldRank={rankings?.overallRank ?? null}
          size="lg"
        />
      </div>

      <div className="pr-player-profile-header__main">
        <p className="pr-mc-pr-badge">Player profile</p>
        <h1 className="pr-player-profile-header__name">
          {profile.squadNumber != null ? (
            <span className="pr-player-header__number">#{profile.squadNumber}</span>
          ) : null}
          {profile.name}
        </h1>
        {profile.fullName && profile.fullName !== profile.name ? (
          <p className="pr-player-header__aka">{profile.fullName}</p>
        ) : null}

        <ul className="pr-player-profile-header__meta">
          {profile.positionName ? <li>{profile.positionName}</li> : null}
          {profile.club ? (
            <li className="pr-player-header__club">
              <TeamCrest name={profile.club.name} imageUrl={profile.club.imageUrl} size="sm" />
              <span>{profile.club.name}</span>
            </li>
          ) : null}
          {profile.competitionName ? <li>{profile.competitionName}</li> : null}
          {profile.nationName ? <li>{profile.nationName}</li> : null}
          {profile.legendScore ? (
            <li>
              <Link href="/legends" className="pr-player-profile-header__compare">
                Legend Score {profile.legendScore.overallScore}
                {profile.legendScore.allTimeRank != null
                  ? ` · #${profile.legendScore.allTimeRank}`
                  : ""}
              </Link>
            </li>
          ) : null}
          <li>
            <span className={`pr-player-status pr-player-status--${profile.status}`}>
              {profile.statusLabel}
            </span>
          </li>
        </ul>

        {profile.latestRecordedSeason &&
        profile.club &&
        profile.latestRecordedSeason.teamName !== profile.club.name ? (
          <p className="pr-player-latest-season">
            Latest recorded season: {profile.latestRecordedSeason.teamName},{" "}
            {profile.latestRecordedSeason.seasonLabel}
          </p>
        ) : null}

        {profile.primaryImage?.credit ? (
          <p className="pr-player-profile-header__credit">
            Photo: {profile.primaryImage.credit}
          </p>
        ) : null}

        <dl className="pr-player-profile-header__vitals">
          <div>
            <dt>Age</dt>
            <dd>{profile.age != null ? profile.age : "—"}</dd>
          </div>
          <div>
            <dt>Height</dt>
            <dd>
              {profile.heightCm != null
                ? `${profile.heightCm} cm (${(profile.heightCm / 100).toFixed(2)}m)`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{profile.weightKg != null ? `${profile.weightKg} kg` : "—"}</dd>
          </div>
        </dl>

        <div className="pr-player-profile-header__icons" aria-label="Career highlights">
          <div>
            <span className="pr-player-profile-header__icon-val">
              {formatStatValue(profile.internationalSummary.caps)}
            </span>
            <span className="pr-player-profile-header__icon-label">Caps</span>
          </div>
          <div>
            <span className="pr-player-profile-header__icon-val">
              {formatStatValue(profile.career.tries)}
            </span>
            <span className="pr-player-profile-header__icon-label">Tries</span>
          </div>
          <div>
            <span className="pr-player-profile-header__icon-val">
              {formatStatValue(profile.titleCounts.worldCup || null)}
            </span>
            <span className="pr-player-profile-header__icon-label">World Cups</span>
          </div>
          <div>
            <span className="pr-player-profile-header__icon-val">
              {formatStatValue(
                profile.titleCounts.top14 || profile.titleCounts.premiership || null,
              )}
            </span>
            <span className="pr-player-profile-header__icon-label">League titles</span>
          </div>
          <div>
            <span className="pr-player-profile-header__icon-val">{profile.statusLabel}</span>
            <span className="pr-player-profile-header__icon-label">Status</span>
          </div>
        </div>

        {compareHref ? (
          <p className="pr-player-profile-header__actions">
            <Link href={compareHref} className="pr-player-profile-header__compare">
              Compare player
            </Link>
          </p>
        ) : null}
      </div>

      <aside className="pr-player-profile-header__aside" aria-label="Ratings and value">
        <div className="pr-player-profile-header__analytics">
          <div className="pr-player-analytics-tile pr-player-analytics-tile--rating">
            <span className="pr-player-analytics-tile__label">Rugby365 Rating</span>
            <strong className="pr-player-analytics-tile__value">
              {formatStatValue(profile.rating.current)}
            </strong>
            <span className="pr-player-analytics-tile__trend">{profile.rating.trendLabel}</span>
            {rankings?.positionLabel || rankings?.overallLabel ? (
              <span className="pr-player-analytics-tile__sub">
                {[rankings.positionLabel, rankings.overallLabel].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>

          {value ? (
            valueHref ? (
              <Link href={valueHref} className="pr-player-analytics-tile pr-player-analytics-tile--link">
                <span className="pr-player-analytics-tile__label">Market Value</span>
                <strong className="pr-player-analytics-tile__value">{value.marketValueLabel}</strong>
                <span className="pr-player-analytics-tile__trend">{value.trendLabel}</span>
                <span className="pr-player-analytics-tile__sub">
                  Confidence {Math.round(value.confidence * 100)}% · Open Value tab
                </span>
              </Link>
            ) : (
              <div className="pr-player-analytics-tile">
                <span className="pr-player-analytics-tile__label">Market Value</span>
                <strong className="pr-player-analytics-tile__value">{value.marketValueLabel}</strong>
                <span className="pr-player-analytics-tile__trend">{value.trendLabel}</span>
                <span className="pr-player-analytics-tile__sub">
                  Confidence {Math.round(value.confidence * 100)}%
                </span>
              </div>
            )
          ) : null}

          <div className="pr-player-analytics-tile">
            <span className="pr-player-analytics-tile__label">Contract</span>
            <strong className="pr-player-analytics-tile__value">
              {profile.contract.reportedSalaryLabel ?? value?.contractValueLabel ?? "—"}
            </strong>
            <span className="pr-player-analytics-tile__sub">
              {profile.club?.name ? profile.club.name : "Club TBD"}
              {profile.contract.expiresLabel ? ` · Exp ${profile.contract.expiresLabel}` : ""}
              {profile.contract.salaryIsReported
                ? " · reported / yr"
                : value
                  ? " · est. / yr"
                  : ""}
            </span>
          </div>
        </div>
      </aside>
    </header>
  );
}
