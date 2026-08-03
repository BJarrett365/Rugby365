import Link from "next/link";
import type { PublicPlayerProfile } from "@/lib/public-player-profile-service";
import { formatStatValue } from "@/lib/public-player-intro";
import { MediaGallery } from "@/components/media/MediaGallery";
import { RugbyPositionPitch } from "@/components/media/RugbyPositionPitch";
import { PlayerDevelopmentTimeline } from "@/components/players/PlayerDevelopmentTimeline";
import { PlayerPerformanceRadar } from "@/components/players/PlayerPerformanceRadar";
import { PlayerValuePanel } from "@/components/players/PlayerValuePanel";
import { PlayerProfileHeader } from "@/components/players/PlayerProfileHeader";
import { PlayerValueCard } from "@/components/players/PlayerValueCard";
import { PlayerRankingCard } from "@/components/players/PlayerRankingCard";
import { ValueTimelineChart } from "@/components/players/ValueTimelineChart";
import { ValueBreakdown } from "@/components/players/ValueBreakdown";
import { PlayerBadge } from "@/components/players/PlayerBadge";
import { ScoutIntelligencePanel } from "@/components/players/ScoutIntelligencePanel";
import { ScoutRriCard } from "@/components/players/ScoutRriCard";
import { movementTypeLabel } from "@/lib/transfer-types";
import { buildPublicPlayerPath, PUBLIC_PLAYER_TABS } from "@/lib/public-player-filters";
import type { PublicPlayerView } from "@/lib/public-player-filters";

const TAB_LABELS: Record<(typeof PUBLIC_PLAYER_TABS)[number], string> = {
  overview: "Overview",
  stats: "Stats",
  value: "Value",
  matches: "Matches",
  events: "Events",
  transfers: "Transfers",
  absences: "Injuries and Absences",
  international: "International",
  news: "News",
  achievements: "Achievements",
  career: "Career",
};

const VIEWS: Array<{ id: PublicPlayerView; label: string }> = [
  { id: "domestic", label: "Domestic" },
  { id: "international", label: "International" },
  { id: "scouting", label: "Scouting" },
];

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="pr-player-fact">
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function pathFor(
  profile: PublicPlayerProfile,
  overrides: Partial<{
    tab: string;
    season: string;
    competition: string;
    page: number;
    view: PublicPlayerView;
  }> = {},
) {
  return buildPublicPlayerPath({
    slug: profile.slug,
    view: overrides.view ?? profile.view,
    tab: overrides.tab,
    season: overrides.season ?? profile.filters.season,
    competition: overrides.competition ?? profile.filters.competition,
    page: overrides.page,
    preview: profile.preview,
  });
}

export function PublicPlayerProfileView({
  profile,
  activeTab = "overview",
}: {
  profile: PublicPlayerProfile;
  activeTab?: string;
}) {
  const tab = (PUBLIC_PLAYER_TABS as readonly string[]).includes(activeTab)
    ? activeTab
    : "overview";
  const season = profile.seasonSnapshot;
  const totalPages = Math.max(1, Math.ceil(profile.matches.total / profile.matches.pageSize));
  const comparePeer = profile.rankings?.peers.find((p) => !p.isCurrent);
  const compareHref = comparePeer
    ? `/players/${profile.slug}/compare/${comparePeer.slug}${profile.preview ? "?preview=1" : ""}`
    : null;

  const positionSummary = profile.positionName
    ? `${profile.name} has played mainly as ${profile.positionName}${
        profile.otherPositions.length
          ? `, with additional appearances at ${profile.otherPositions.join(", ")}`
          : ""
      }.`
    : null;

  return (
    <article className="pr-mc-fixtures-page pr-player-profile">
      {profile.preview ? (
        <p className="pr-player-preview-banner" role="status">
          Preview mode — this profile may not be published yet. Not for indexing.
        </p>
      ) : null}

      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/players">Players</Link>
        {profile.nationName ? (
          <>
            <span aria-hidden>/</span>
            <span>{profile.nationName}</span>
          </>
        ) : null}
        {profile.club ? (
          <>
            <span aria-hidden>/</span>
            <span>{profile.club.name}</span>
          </>
        ) : null}
        <span aria-hidden>/</span>
        <span aria-current="page">{profile.name}</span>
      </nav>

      <PlayerProfileHeader
        profile={profile}
        compareHref={compareHref}
        valueHref={profile.playerValue ? pathFor(profile, { tab: "value" }) : null}
      />

      <nav className="pr-player-view-switcher" aria-label="Profile type">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={pathFor(profile, { view: v.id, tab: "overview" })}
            className={`pr-player-view-switcher__item${
              profile.view === v.id ? " is-active" : ""
            }`}
            aria-current={profile.view === v.id ? "page" : undefined}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <dl className="pr-player-quick-facts">
        <Fact
          label="Age"
          value={
            profile.age != null
              ? `${profile.age}${profile.birthDate ? ` (${formatDate(profile.birthDate)})` : ""}`
              : formatDate(profile.birthDate)
          }
        />
        <Fact label="Height" value={profile.heightCm != null ? `${profile.heightCm} cm` : null} />
        <Fact label="Weight" value={profile.weightKg != null ? `${profile.weightKg} kg` : null} />
        <Fact label="Preferred foot" value={profile.preferredFoot} />
        <Fact label="Season apps" value={season ? formatStatValue(season.appearances) : "—"} />
        <Fact label="Season tries" value={season ? formatStatValue(season.tries) : "—"} />
        <Fact label="Season points" value={season ? formatStatValue(season.points) : "—"} />
        <Fact
          label="Updated"
          value={formatDate(profile.sources.profileUpdatedAt ?? profile.sources.lastVerifiedAt)}
        />
      </dl>

      <form className="pr-player-filters" method="get">
        {profile.preview ? <input type="hidden" name="preview" value="1" /> : null}
        {tab !== "overview" ? <input type="hidden" name="tab" value={tab} /> : null}
        <label>
          Season
          <select name="season" defaultValue={profile.filters.season}>
            <option value="current">Current season</option>
            <option value="all">All seasons</option>
            {profile.filters.seasonOptions.map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.label} ({opt.appearanceCount})
              </option>
            ))}
          </select>
        </label>
        <label>
          Competition
          <select name="competition" defaultValue={profile.filters.competition}>
            <option value="all">All competitions</option>
            {profile.filters.competitionOptions.map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.name} ({opt.appearanceCount})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="pr-player-filters__submit">
          Apply
        </button>
      </form>

      <nav className="pr-player-tabs" aria-label="Player sections">
        <div className="pr-player-tabs__scroll">
          {PUBLIC_PLAYER_TABS.map((id) => (
            <Link
              key={id}
              href={pathFor(profile, { tab: id })}
              className={`pr-player-tabs__item${tab === id ? " is-active" : ""}`}
              aria-current={tab === id ? "page" : undefined}
            >
              {TAB_LABELS[id]}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "overview" ? (
        <section className="pr-player-section" aria-labelledby="overview-heading">
          <h2 id="overview-heading">
            {profile.view === "scouting" ? "Scouting report" : "Overview"}
          </h2>
          {profile.intro ? <p className="pr-player-intro">{profile.intro}</p> : null}
          {profile.view === "scouting" ? (
            <>
              {profile.biography?.scoutingSummary ||
              profile.biography?.fullBio ||
              profile.biography?.internationalSummary ? (
                <p className="pr-player-bio">
                  {profile.biography.scoutingSummary ||
                    profile.biography.fullBio ||
                    profile.biography.internationalSummary}
                </p>
              ) : null}
              {profile.biography &&
              (profile.biography.strengths ||
                profile.biography.areasToImprove ||
                profile.biography.playingStyle) ? (
                <div className="pr-player-grid">
                  {profile.biography.playingStyle ? (
                    <div className="pr-player-card">
                      <h3>Playing style</h3>
                      <p className="pr-player-bio pr-player-bio--compact">
                        {profile.biography.playingStyle}
                      </p>
                    </div>
                  ) : null}
                  {profile.biography.strengths ? (
                    <div className="pr-player-card">
                      <h3>Strengths</h3>
                      <p className="pr-player-bio pr-player-bio--compact">
                        {profile.biography.strengths}
                      </p>
                    </div>
                  ) : null}
                  {profile.biography.areasToImprove ? (
                    <div className="pr-player-card">
                      <h3>Areas to improve</h3>
                      <p className="pr-player-bio pr-player-bio--compact">
                        {profile.biography.areasToImprove}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : profile.biography?.fullBio || profile.biography?.scoutingSummary ? (
            <p className="pr-player-bio">
              {profile.biography.fullBio ||
                profile.biography.scoutingSummary ||
                profile.biography.internationalSummary}
            </p>
          ) : null}

          <div className="pr-player-analytics-row">
            {profile.rankings ? <PlayerRankingCard rankings={profile.rankings} /> : null}
            {profile.playerValue ? <PlayerValueCard value={profile.playerValue} /> : null}
            {profile.view === "scouting" && profile.scoutIntelligence ? (
              <ScoutRriCard scout={profile.scoutIntelligence} />
            ) : null}
          </div>

          {profile.playerValue ? (
            <div className="pr-player-grid pr-player-grid--value">
              <div className="pr-player-card">
                <h3>Value timeline</h3>
                <ValueTimelineChart
                  timeline={profile.playerValue.timeline}
                  currentValueGbp={profile.playerValue.marketValueGbp}
                  peakValueGbp={profile.playerValue.peakCareerValueGbp}
                />
              </div>
              <div className="pr-player-card">
                <h3>Value breakdown</h3>
                <ValueBreakdown factors={profile.playerValue.factors} />
              </div>
            </div>
          ) : null}

          {profile.rankings && profile.rankings.peers.length > 1 ? (
            <div className="pr-player-card pr-player-card--wide">
              <div className="pr-player-compare-teaser__head">
                <h3>Player comparison</h3>
                {compareHref ? (
                  <Link href={compareHref} className="pr-player-profile-header__compare">
                    Open full compare
                  </Link>
                ) : null}
              </div>
              <div className="pr-player-badge-row">
                <PlayerBadge
                  name={profile.name}
                  imageUrl={profile.badgeImageUrl ?? profile.imageUrl}
                  cutout={Boolean(profile.badgeImageUrl)}
                  rating={profile.rating.current}
                  positionName={profile.positionName}
                  nationName={profile.nationName}
                  clubName={profile.club?.name}
                  age={profile.age}
                  marketValueLabel={profile.playerValue?.marketValueLabel}
                  worldRank={profile.rankings.overallRank}
                  size="sm"
                />
                {comparePeer ? (
                  <PlayerBadge
                    name={comparePeer.name}
                    imageUrl={comparePeer.imageUrl}
                    rating={comparePeer.rating}
                    marketValueLabel={null}
                    worldRank={comparePeer.rank}
                    slug={comparePeer.slug}
                    size="sm"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {profile.view === "scouting" ? (
            <div className="pr-player-card pr-player-card--wide">
              <h3>Performance (Scouting)</h3>
              <PlayerPerformanceRadar
                radar={profile.performanceRadar}
                playerName={profile.name}
              />
            </div>
          ) : null}

          {profile.gallery.length > 0 ? (
            <MediaGallery items={profile.gallery} playerName={profile.name} title="Player gallery" />
          ) : null}

          <div className="pr-player-grid">
            <div className="pr-player-card">
              <h3>Player information</h3>
              <dl className="pr-player-info-list">
                <Fact label="Full name" value={profile.fullName ?? profile.name} />
                <Fact label="Known as" value={profile.name} />
                <Fact label="Date of birth" value={formatDate(profile.birthDate)} />
                <Fact label="Place of birth" value={profile.birthPlace} />
                <Fact label="Nationality" value={profile.nationName} />
                <Fact label="Preferred foot" value={profile.preferredFoot} />
                <Fact label="Playing style" value={profile.playingStyle} />
                <Fact
                  label="Club debut"
                  value={profile.clubDebutOn ? formatDate(profile.clubDebutOn) : null}
                />
                <Fact
                  label="Agent"
                  value={
                    profile.agent
                      ? [profile.agent.name, profile.agent.agency].filter(Boolean).join(" · ")
                      : null
                  }
                />
                <Fact label="Contract expires" value={profile.contract.expiresLabel} />
                <Fact
                  label="Salary"
                  value={
                    profile.contract.reportedSalaryLabel
                      ? `${profile.contract.reportedSalaryLabel}/yr (reported)`
                      : profile.playerValue?.contractValueLabel
                        ? `${profile.playerValue.contractValueLabel}/yr (estimate)`
                        : null
                  }
                />
                <Fact label="Main position" value={profile.positionName} />
                <Fact
                  label="Other positions"
                  value={profile.otherPositions.length ? profile.otherPositions.join(", ") : null}
                />
                <Fact label="Current club" value={profile.club?.name} />
                <Fact label="Current competition" value={profile.competitionName} />
                <Fact label="International team" value={profile.internationalTeam?.name} />
                <Fact label="Career status" value={profile.careerStatus} />
              </dl>
            </div>

            <div className="pr-player-card">
              <h3>{season ? `${season.seasonLabel} snapshot` : "Season snapshot"}</h3>
              {season ? (
                <dl className="pr-player-stat-grid">
                  <Fact label="Appearances" value={formatStatValue(season.appearances)} />
                  <Fact label="Starts" value={formatStatValue(season.starts)} />
                  <Fact label="Bench" value={formatStatValue(season.bench)} />
                  <Fact label="Minutes" value={formatStatValue(season.minutesPlayed)} />
                  <Fact label="Tries" value={formatStatValue(season.tries)} />
                  <Fact label="Points" value={formatStatValue(season.points)} />
                  <Fact label="Carries" value={formatStatValue(season.carries)} />
                  <Fact label="Metres" value={formatStatValue(season.metresCarried)} />
                  <Fact label="Tackles" value={formatStatValue(season.tacklesMade)} />
                  <Fact label="Turnovers" value={formatStatValue(season.turnoversWon)} />
                </dl>
              ) : (
                <p className="pr-mc-transfers-muted">No appearances for this filter.</p>
              )}
              <p className="pr-player-footnote">
                <Link href={pathFor(profile, { tab: "stats" })}>Full stats</Link>
              </p>
            </div>

            <div className="pr-player-card">
              <h3>Position</h3>
              <RugbyPositionPitch
                mainPosition={profile.positionName}
                otherPositions={profile.otherPositions}
                compact
                summary={positionSummary}
              />
              <p className="pr-player-footnote">
                <Link href={pathFor(profile, { tab: "stats" })}>Position detail</Link>
              </p>
            </div>

            <div className="pr-player-card">
              <h3>Performance radar</h3>
              <PlayerPerformanceRadar
                radar={profile.performanceRadar}
                playerName={profile.name}
                compact
              />
            </div>

            <div className="pr-player-card">
              <h3>Development</h3>
              <Fact label="Current" value={formatStatValue(profile.rating.current)} />
              <Fact label="Trend" value={profile.rating.trendLabel} />
              <PlayerDevelopmentTimeline
                playerName={profile.name}
                points={profile.developmentTimeline}
                currentDomesticSlug={profile.developmentChart.currentDomesticSlug}
                careerAverage={profile.developmentChart.careerAverage}
                settings={{
                  enabled: profile.developmentChart.enabled,
                  showRollingAverage: profile.developmentChart.showRollingAverage,
                  showSeasonAverage: profile.developmentChart.showSeasonAverage,
                  showCareerAverage: profile.developmentChart.showCareerAverage,
                  minMinutes: profile.developmentChart.minMinutes,
                  summaryOverride: profile.developmentChart.summaryOverride,
                }}
                compact
                seasonLabel={season?.seasonLabel}
                basePath={pathFor(profile, { tab: "overview" }).split("?")[0]!}
                initialSeason={profile.filters.season}
              />
            </div>

            <div className="pr-player-card">
              <h3>Career scoring</h3>
              <dl className="pr-player-stat-grid">
                <Fact label="Appearances" value={formatStatValue(profile.career.appearances)} />
                <Fact label="Tries" value={formatStatValue(profile.career.tries)} />
                <Fact label="Points" value={formatStatValue(profile.career.points)} />
                <Fact
                  label="International apps"
                  value={formatStatValue(profile.career.internationalApps)}
                />
              </dl>
            </div>

            <div className="pr-player-card">
              <h3>International summary</h3>
              <dl className="pr-player-stat-grid">
                <Fact label="Nation" value={profile.internationalSummary.nation} />
                <Fact label="Caps" value={formatStatValue(profile.internationalSummary.caps)} />
                <Fact label="Tries" value={formatStatValue(profile.internationalSummary.tries)} />
                <Fact
                  label="Competitions"
                  value={
                    profile.internationalSummary.competitions.length
                      ? profile.internationalSummary.competitions.join(", ")
                      : null
                  }
                />
              </dl>
              <p className="pr-player-footnote">
                <Link href={pathFor(profile, { view: "international", tab: "overview" })}>
                  International profile
                </Link>
              </p>
            </div>
          </div>

          <div className="pr-player-card pr-player-card--wide">
            <h3>Recent form</h3>
            {profile.recentForm.length === 0 ? (
              <p className="pr-mc-transfers-muted">No recent match appearances on record.</p>
            ) : (
              <div className="pr-player-table-wrap">
                <table className="pr-mc-transfers-table pr-player-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Team</th>
                      <th scope="col">Opponent</th>
                      <th scope="col">Result</th>
                      <th scope="col">Role</th>
                      <th scope="col">Tries</th>
                      <th scope="col">Pts</th>
                      <th scope="col">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.recentForm.map((row, i) => (
                      <tr key={`${row.fixtureSlug ?? "m"}-${i}`}>
                        <td>{formatDate(row.date) ?? "—"}</td>
                        <td>{row.teamName ?? "—"}</td>
                        <td>
                          {row.fixtureSlug ? (
                            <Link href={`/matches/${row.fixtureSlug}`}>
                              {row.opponentName ?? "Match"}
                            </Link>
                          ) : (
                            row.opponentName ?? "—"
                          )}
                          {row.homeAway ? ` (${row.homeAway})` : ""}
                        </td>
                        <td>{row.result ?? "—"}</td>
                        <td>{row.started == null ? "—" : row.started ? "Start" : "Bench"}</td>
                        <td>{formatStatValue(row.tries)}</td>
                        <td>{formatStatValue(row.points)}</td>
                        <td>{formatStatValue(row.rating)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {profile.insights.length > 0 ? (
            <div className="pr-player-card pr-player-card--wide">
              <h3>Rugby365 insights</h3>
              <ul className="pr-player-insights">
                {profile.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {profile.view === "scouting" && profile.scoutIntelligence ? (
            <section className="pr-player-section pr-scout-enhance" aria-labelledby="rri-section-heading">
              <ScoutIntelligencePanel
                scout={profile.scoutIntelligence}
                playerName={profile.name}
                compareHref={compareHref}
              />
            </section>
          ) : null}

          <div className="pr-player-card pr-player-card--wide">
            <h3>Sources</h3>
            <p>{profile.sources.labels.join(" · ")}</p>
            <p className="pr-player-footnote">
              Last updated{" "}
              {formatDate(profile.sources.profileUpdatedAt ?? profile.sources.lastVerifiedAt) ??
                "—"}
            </p>
          </div>
        </section>
      ) : null}

      {tab === "stats" ? (
        <section className="pr-player-section" aria-labelledby="stats-heading">
          <h2 id="stats-heading">Stats</h2>
          {season ? (
            <dl className="pr-player-stat-grid pr-player-stat-grid--wide">
              <Fact label="Appearances" value={formatStatValue(season.appearances)} />
              <Fact label="Starts" value={formatStatValue(season.starts)} />
              <Fact label="Bench" value={formatStatValue(season.bench)} />
              <Fact label="Minutes" value={formatStatValue(season.minutesPlayed)} />
              <Fact label="Tries" value={formatStatValue(season.tries)} />
              <Fact label="Points" value={formatStatValue(season.points)} />
              <Fact label="Carries" value={formatStatValue(season.carries)} />
              <Fact label="Metres" value={formatStatValue(season.metresCarried)} />
              <Fact
                label="Metres / carry"
                value={
                  season.carries && season.metresCarried && season.carries > 0
                    ? (season.metresCarried / season.carries).toFixed(1)
                    : "—"
                }
              />
              <Fact label="Tackles" value={formatStatValue(season.tacklesMade)} />
              <Fact label="Turnovers" value={formatStatValue(season.turnoversWon)} />
              <Fact
                label="Per 80 tackles"
                value={
                  season.minutesPlayed && season.minutesPlayed > 0 && season.tacklesMade != null
                    ? ((season.tacklesMade / season.minutesPlayed) * 80).toFixed(1)
                    : "—"
                }
              />
              <Fact
                label="Avg rating"
                value={
                  season.ratingAverage != null ? season.ratingAverage.toFixed(1) : "—"
                }
              />
            </dl>
          ) : (
            <p className="pr-mc-transfers-muted">No stats for this season filter.</p>
          )}

          <div className="pr-player-grid">
            <div className="pr-player-card">
              <h3>Positions played</h3>
              <RugbyPositionPitch
                mainPosition={profile.positionName}
                otherPositions={[
                  ...profile.otherPositions,
                  ...profile.positionsPlayed.map((p) => p.position),
                ]}
                summary={positionSummary}
              />
              {profile.positionsPlayed.length ? (
                <ul>
                  {profile.positionsPlayed.map((p) => (
                    <li key={p.position}>
                      {p.position}: {p.appearances}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="pr-player-card pr-player-card--wide">
              <h3>Position analysis · Performance radar</h3>
              <PlayerPerformanceRadar
                radar={profile.performanceRadar}
                playerName={profile.name}
              />
            </div>
          </div>

          <PlayerDevelopmentTimeline
            playerName={profile.name}
            points={profile.developmentTimeline}
            currentDomesticSlug={profile.developmentChart.currentDomesticSlug}
            careerAverage={profile.developmentChart.careerAverage}
            settings={{
              enabled: profile.developmentChart.enabled,
              showRollingAverage: profile.developmentChart.showRollingAverage,
              showSeasonAverage: true,
              showCareerAverage: profile.developmentChart.showCareerAverage,
              minMinutes: profile.developmentChart.minMinutes,
              summaryOverride: profile.developmentChart.summaryOverride,
            }}
            seasonLabel={season?.seasonLabel}
            basePath={pathFor(profile, { tab: "stats" }).split("?")[0]!}
            initialSeason={profile.filters.season}
          />
        </section>
      ) : null}

      {tab === "value" ? (
        profile.playerValue ? (
          <PlayerValuePanel value={profile.playerValue} />
        ) : (
          <section className="pr-player-section" aria-labelledby="value-heading">
            <h2 id="value-heading">Player Value</h2>
            <p className="pr-mc-transfers-muted">
              Value appears once Rugby365 has a career or match rating for this player.
            </p>
          </section>
        )
      ) : null}

      {tab === "matches" ? (
        <section className="pr-player-section" aria-labelledby="matches-heading">
          <h2 id="matches-heading">Matches</h2>
          <p className="pr-player-footnote">{profile.matches.total} appearances in selection.</p>
          {profile.matches.rows.length === 0 ? (
            <p className="pr-mc-transfers-muted">No matches for this filter.</p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Comp</th>
                    <th scope="col">Team</th>
                    <th scope="col">Opponent</th>
                    <th scope="col">Result</th>
                    <th scope="col">Pos</th>
                    <th scope="col">#</th>
                    <th scope="col">Role</th>
                    <th scope="col">Min</th>
                    <th scope="col">Tries</th>
                    <th scope="col">Pts</th>
                    <th scope="col">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.matches.rows.map((row) => (
                    <tr key={row.fixtureId}>
                      <td>{formatDate(row.kickoffAt) ?? "—"}</td>
                      <td>{row.competitionName ?? "—"}</td>
                      <td>{row.teamName}</td>
                      <td>
                        {row.fixtureSlug ? (
                          <Link href={`/matches/${row.fixtureSlug}`}>
                            {row.opponentName ?? "Match centre"}
                          </Link>
                        ) : (
                          row.opponentName ?? "—"
                        )}
                      </td>
                      <td>{row.resultLabel ?? "—"}</td>
                      <td>{row.positionName ?? "—"}</td>
                      <td>{row.jerseyNumber ?? "—"}</td>
                      <td>{row.started == null ? "—" : row.started ? "Start" : "Bench"}</td>
                      <td>{formatStatValue(row.minutes)}</td>
                      <td>{formatStatValue(row.tries)}</td>
                      <td>{formatStatValue(row.points)}</td>
                      <td>{formatStatValue(row.rating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 ? (
            <nav className="pr-player-pagination" aria-label="Match pages">
              {profile.matches.page > 1 ? (
                <Link href={pathFor(profile, { tab: "matches", page: profile.matches.page - 1 })}>
                  Previous
                </Link>
              ) : null}
              <span>
                Page {profile.matches.page} of {totalPages}
              </span>
              {profile.matches.page < totalPages ? (
                <Link href={pathFor(profile, { tab: "matches", page: profile.matches.page + 1 })}>
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      ) : null}

      {tab === "events" ? (
        <section className="pr-player-section" aria-labelledby="events-heading">
          <h2 id="events-heading">Match events</h2>
          {profile.events.length === 0 ? (
            <p className="pr-mc-transfers-muted">No public match events for this filter.</p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Min</th>
                    <th scope="col">Event</th>
                    <th scope="col">Team</th>
                    <th scope="col">Opponent</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.events.map((e, i) => (
                    <tr key={`${e.fixtureSlug}-${e.minute}-${i}`}>
                      <td>
                        {e.fixtureSlug ? (
                          <Link href={`/matches/${e.fixtureSlug}`}>{formatDate(e.date) ?? "Match"}</Link>
                        ) : (
                          formatDate(e.date) ?? "—"
                        )}
                      </td>
                      <td>{e.minute}&apos;</td>
                      <td>{e.eventType}</td>
                      <td>{e.teamName ?? "—"}</td>
                      <td>{e.opponentName ?? "—"}</td>
                      <td>{e.resultLabel ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "transfers" ? (
        <section className="pr-player-section" aria-labelledby="transfers-heading">
          <h2 id="transfers-heading">Transfers</h2>
          {profile.transfers.length === 0 ? (
            <p className="pr-mc-transfers-muted">No transfer records published.</p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Season</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.transfers.map((t, i) => (
                    <tr key={`${t.fromLabel}-${t.toLabel}-${i}`}>
                      <td>{formatDate(t.date) ?? "—"}</td>
                      <td>{t.seasonLabel ?? "—"}</td>
                      <td>{t.fromLabel}</td>
                      <td>{t.toLabel}</td>
                      <td>{movementTypeLabel(t.movementType)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "absences" ? (
        <section className="pr-player-section" aria-labelledby="absences-heading">
          <h2 id="absences-heading">Injuries and absences</h2>
          {profile.absences.length === 0 ? (
            <p className="pr-mc-transfers-muted">
              No public injury or suspension records for this player.
            </p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Start</th>
                    <th scope="col">Return / end</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.absences.map((a, i) => (
                    <tr key={`${a.kind}-${i}`}>
                      <td>{a.kind === "injury" ? "Injury" : "Suspension"}</td>
                      <td>{a.label}</td>
                      <td>{formatDate(a.startDate) ?? "—"}</td>
                      <td>{formatDate(a.endDate) ?? "—"}</td>
                      <td>{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "international" ? (
        <section className="pr-player-section" aria-labelledby="intl-heading">
          <h2 id="intl-heading">International</h2>
          <dl className="pr-player-stat-grid">
            <Fact label="Nation" value={profile.internationalSummary.nation} />
            <Fact label="Caps" value={formatStatValue(profile.internationalSummary.caps)} />
            <Fact label="Tries" value={formatStatValue(profile.internationalSummary.tries)} />
            <Fact label="Points" value={formatStatValue(profile.internationalSummary.points)} />
          </dl>
          {profile.internationalHistory.length === 0 ? (
            <p className="pr-mc-transfers-muted">No international record on file.</p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Years</th>
                    <th scope="col">Apps</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.internationalHistory.map((row, i) => (
                    <tr key={`${row.teamName}-${i}`}>
                      <td>{row.teamName}</td>
                      <td>{row.yearsLabel}</td>
                      <td>{formatStatValue(row.apps)}</td>
                      <td>{formatStatValue(row.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pr-player-footnote">
            <Link href={pathFor(profile, { view: "international", tab: "matches" })}>
              International match list
            </Link>
          </p>
        </section>
      ) : null}

      {tab === "news" ? (
        <section className="pr-player-section" aria-labelledby="news-heading">
          <h2 id="news-heading">News</h2>
          <p className="pr-mc-transfers-muted">
            Player-linked news will appear here when published article links are available in
            the CMS.
          </p>
        </section>
      ) : null}

      {tab === "achievements" ? (
        <section className="pr-player-section" aria-labelledby="achievements-heading">
          <h2 id="achievements-heading">Achievements</h2>
          {profile.achievements.length === 0 ? (
            <p className="pr-mc-transfers-muted">No published achievements yet.</p>
          ) : (
            <ul className="pr-player-achievements">
              {profile.achievements.map((a, i) => (
                <li key={`${a.title}-${i}`}>
                  <strong>{a.title}</strong>
                  {a.detail ? <span> — {a.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "career" ? (
        <section className="pr-player-section" aria-labelledby="career-heading">
          <h2 id="career-heading">Career</h2>
          <PlayerDevelopmentTimeline
            playerName={profile.name}
            points={profile.developmentTimeline}
            currentDomesticSlug={profile.developmentChart.currentDomesticSlug}
            careerAverage={profile.developmentChart.careerAverage}
            settings={{
              enabled: profile.developmentChart.enabled,
              showRollingAverage: profile.developmentChart.showRollingAverage,
              showSeasonAverage: true,
              showCareerAverage: true,
              minMinutes: profile.developmentChart.minMinutes,
              summaryOverride: profile.developmentChart.summaryOverride,
            }}
            seasonLabel="Career"
            basePath={pathFor(profile, { tab: "career" }).split("?")[0]!}
          />
          <h3>Club career</h3>
          {profile.clubHistory.length === 0 ? (
            <p className="pr-mc-transfers-muted">No club career rows yet.</p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Years</th>
                    <th scope="col">Apps</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.clubHistory.map((row, i) => (
                    <tr key={`${row.teamName}-${i}`}>
                      <td>{row.teamName}</td>
                      <td>{row.yearsLabel}</td>
                      <td>{formatStatValue(row.apps)}</td>
                      <td>{formatStatValue(row.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3>International career</h3>
          {profile.internationalHistory.length === 0 ? (
            <p className="pr-mc-transfers-muted">No international career rows yet.</p>
          ) : (
            <div className="pr-player-table-wrap">
              <table className="pr-mc-transfers-table pr-player-table">
                <thead>
                  <tr>
                    <th scope="col">Nation</th>
                    <th scope="col">Years</th>
                    <th scope="col">Apps</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.internationalHistory.map((row, i) => (
                    <tr key={`intl-${row.teamName}-${i}`}>
                      <td>{row.teamName}</td>
                      <td>{row.yearsLabel}</td>
                      <td>{formatStatValue(row.apps)}</td>
                      <td>{formatStatValue(row.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </article>
  );
}

export function PublicPlayerJsonLd({ profile }: { profile: PublicPlayerProfile }) {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    alternateName: profile.fullName,
    birthDate: profile.birthDate ?? undefined,
    birthPlace: profile.birthPlace ?? undefined,
    nationality: profile.nationName ?? undefined,
    height: profile.heightCm != null ? `${profile.heightCm} cm` : undefined,
    weight: profile.weightKg != null ? `${profile.weightKg} kg` : undefined,
    url: profile.seo.canonicalPath,
    jobTitle: profile.positionName ?? "Rugby player",
    image: profile.imageUrl
      ? {
          "@type": "ImageObject",
          url: profile.imageUrl,
          description: profile.primaryImage?.altText ?? profile.name,
        }
      : undefined,
    memberOf: [
      profile.club
        ? { "@type": "SportsTeam", name: profile.club.name, url: profile.club.slug ?? undefined }
        : null,
      profile.internationalTeam
        ? {
            "@type": "SportsTeam",
            name: profile.internationalTeam.name,
            url: profile.internationalTeam.slug ?? undefined,
          }
        : null,
    ].filter(Boolean),
    sameAs: [profile.sources.wikipediaUrl, profile.social.website].filter(Boolean),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/matches" },
      { "@type": "ListItem", position: 2, name: "Players" },
      ...(profile.nationName
        ? [{ "@type": "ListItem", position: 3, name: profile.nationName }]
        : []),
      ...(profile.club
        ? [
            {
              "@type": "ListItem",
              position: profile.nationName ? 4 : 3,
              name: profile.club.name,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: (profile.nationName ? 1 : 0) + (profile.club ? 1 : 0) + 3,
        name: profile.name,
        item: profile.seo.canonicalPath,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  );
}
