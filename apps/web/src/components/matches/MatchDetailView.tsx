import Link from "next/link";
import type { MatchDetailPageData } from "@/lib/match-detail-service";
import {
  KeyEventsPanel,
  MatchDetailsCard,
  MatchSummaryPanel,
  PlayerStatsTabPanel,
  TeamStatsTabPanel,
} from "./MatchDetailSections";
import { MatchDetailTabs } from "./MatchDetailTabs";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { TeamProfileLinkFromContext } from "./EntityProfileLinks";
import { LineupsPitchView } from "./LineupsPitchView";
import { MatchEventTimelineStrip } from "./MatchEventTimelineStrip";
import { MatchMomentumChart } from "./MatchMomentumChart";
import { MatchCentreSidebar } from "./MatchCentreSidebar";
import { MatchHeadToHeadPublic } from "./MatchHeadToHeadPublic";
import { MatchLiveTablesPanel } from "./MatchLiveTablesPanel";
import { MatchAnimationSection } from "./MatchAnimationSection";
import { MatchYoutubeEmbedSection } from "./MatchYoutubeEmbedSection";
import { TeamCrest } from "./TeamCrest";
import { collectHeaderCards, resolveHalfTimeScore } from "@/lib/match-header-utils";
import { buildMatchAnimationPublicPayload } from "@/lib/match-animation-public-service";
import type { MatchAnimationPublicPayload } from "@/lib/match-animation-types";
import type { MatchAnimationTabBadge } from "@/lib/match-animation-availability";
import { youtubeEmbedSrc } from "@/lib/youtube-embed";

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "result" || s === "finished" || s === "complete" || s === "ft") return "FT";
  if (s === "fixture" || s === "scheduled" || s === "upcoming") return "Scheduled";
  if (s.includes("live") || s === "first half" || s === "second half" || s === "half time") return "Live";
  return status;
}

function MatchDetailEditPanel({
  cmsFixture,
  planetRugbyUrl,
  matchId,
  homeName,
  awayName,
  mappedPlayers,
}: {
  cmsFixture: MatchDetailPageData["cmsFixture"];
  planetRugbyUrl: string;
  matchId: string;
  homeName: string;
  awayName: string;
  mappedPlayers: number;
}) {
  return (
    <div className="match-detail-edit cms-card">
      <h2 className="match-detail-section__heading">CMS</h2>
      <p className="match-detail-edit__intro">
        {cmsFixture
          ? `${homeName} vs ${awayName} is in the Rugby365 CMS.${cmsFixture.autoImported ? " This match was auto-imported from SDMS." : ""} Squads, events, and player profiles sync from Planet Rugby automatically.`
          : "Auto-import from SDMS did not complete. Refresh the page or check Admin → Matches import."}
      </p>
      <dl className="match-detail-edit__meta">
        <div>
          <dt>SDMS match id</dt>
          <dd>{matchId}</dd>
        </div>
        {cmsFixture && (
          <>
            <div>
              <dt>CMS slug</dt>
              <dd>{cmsFixture.slug}</dd>
            </div>
            <div>
              <dt>Squad players mapped</dt>
              <dd>{cmsFixture.squadCount}</dd>
            </div>
            <div>
              <dt>Players linked on page</dt>
              <dd>{mappedPlayers}</dd>
            </div>
          </>
        )}
      </dl>
      <div className="match-detail-edit__actions">
        {cmsFixture ? (
          <>
            <Link href={`/admin/matches/${cmsFixture.id}/edit`} className="cms-btn cms-btn--primary">
              Edit match
            </Link>
            <Link href={`/admin/squads/${cmsFixture.id}`} className="cms-btn cms-btn--secondary">
              Edit squad
            </Link>
            <Link href={`/matches/${cmsFixture.slug}/commentary`} className="cms-btn cms-btn--secondary">
              Live commentary
            </Link>
            <Link href="/admin/operator" className="cms-btn cms-btn--secondary">
              Operator console
            </Link>
          </>
        ) : (
          <>
            <Link href="/admin/matches/import" className="cms-btn cms-btn--primary">
              Import to CMS
            </Link>
            <a href={planetRugbyUrl} target="_blank" rel="noreferrer" className="cms-btn cms-btn--secondary">
              Open on Planet Rugby
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function MatchDetailPanel({
  tab,
  data,
  animationPayload,
}: {
  tab: MatchDetailTab;
  data: MatchDetailPageData;
  animationPayload: MatchAnimationPublicPayload | null;
}) {
  const { detail, lineups, matchStats, playerStats, planetRugbyUrl, cmsFixture, entities } = data;
  const mappedPlayers = Object.keys(entities.playersByExternalId).length;
  const homeImageUrl = entities.homeTeam?.imageUrl ?? detail.home_team_icon ?? null;
  const awayImageUrl = entities.awayTeam?.imageUrl ?? detail.away_team_icon ?? null;

  if (tab === "animation") {
    if (!animationPayload) {
      return <p className="match-detail-empty">Match animation is temporarily unavailable.</p>;
    }
    return <MatchAnimationSection payload={animationPayload} />;
  }

  if (tab === "watchalong") {
    return (
      <MatchYoutubeEmbedSection
        title="Watchalong"
        description="Live or full-match watchalong for this fixture."
        youtubeUrl={cmsFixture?.watchalongYoutubeUrl}
        emptyMessage="No watchalong has been added for this match yet."
        autoplay
      />
    );
  }

  if (tab === "highlights") {
    return (
      <MatchYoutubeEmbedSection
        title="Match Highlights"
        description="Highlights package for this fixture."
        youtubeUrl={cmsFixture?.highlightsYoutubeUrl}
        emptyMessage="No highlights have been added for this match yet."
      />
    );
  }

  if (tab === "stats") {
    return (
      <TeamStatsTabPanel
        matchStats={matchStats}
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
      />
    );
  }

  if (tab === "player-stats") {
    return (
      <PlayerStatsTabPanel
        playerStats={playerStats}
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
        entities={entities}
      />
    );
  }

  if (tab === "tables") {
    return <MatchLiveTablesPanel tableContext={data.tableContext} />;
  }

  if (tab === "lineups") {
    if (!lineups) {
      return <p className="match-detail-empty">Lineups are not available for this match yet.</p>;
    }
    return (
      <LineupsPitchView
        lineups={lineups}
        entities={entities}
        ratings={data.matchRatings}
        rugby365PotmName={data.rugby365PotmName}
        officialPotmName={data.officialPotmName}
        matchStatus={detail.status}
      />
    );
  }

  if (tab === "head-to-head") {
    return (
      <MatchHeadToHeadPublic
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
        headToHead={detail.head_to_head ?? []}
        lastFiveMeetings={detail.last_five_meetings ?? []}
        competitionName={detail.competition_name}
      />
    );
  }

  if (tab === "edit") {
    return (
      <MatchDetailEditPanel
        cmsFixture={cmsFixture}
        planetRugbyUrl={planetRugbyUrl}
        matchId={detail.match_id}
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        mappedPlayers={mappedPlayers}
      />
    );
  }

  return (
    <>
      <MatchDetailsCard
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        homeScore={detail.home_team_score}
        awayScore={detail.away_team_score}
        status={detail.status}
        scoringDetail={detail.detail as Record<string, unknown> | undefined}
        matchStats={matchStats}
        entities={entities}
        bonusPoints={data.bonusPoints}
      />
      <MatchSummaryPanel
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
        matchStats={matchStats}
      />
      <KeyEventsPanel
        events={data.keyEvents}
        homeTeamId={detail.home_team_id}
        entities={entities}
      />
      {(data.rugby365PotmName || data.officialPotmName) && (
        <section className="match-detail-section">
          <h2 className="match-detail-section__heading">Player of the Match</h2>
          <div className="match-potm-banner cms-card">
            {data.rugby365PotmName && (
              <p>
                <strong>Rugby365 Player of the Match:</strong> {data.rugby365PotmName}
              </p>
            )}
            {data.officialPotmName && (
              <p>
                <strong>Official Player of the Match:</strong> {data.officialPotmName}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

export async function MatchDetailView({
  data,
  activeTab = "details",
}: {
  data: MatchDetailPageData;
  activeTab?: MatchDetailTab;
}) {
  const {
    detail,
    kickoffAt,
    entities,
    matchStats,
    homeCoach,
    awayCoach,
    referee,
    venue,
    cmsFixture,
  } = data;
  const teamsLabel = `${detail.home_team_name} v ${detail.away_team_name}`;
  const homeImageUrl = entities.homeTeam?.imageUrl ?? detail.home_team_icon ?? null;
  const awayImageUrl = entities.awayTeam?.imageUrl ?? detail.away_team_icon ?? null;
  const keyEvents = detail.key_events ?? [];
  const halfTime = resolveHalfTimeScore(keyEvents);
  const cards = collectHeaderCards(detail, detail.home_team_id);
  const homeCards = cards.filter((c) => c.side === "home");
  const awayCards = cards.filter((c) => c.side === "away");
  const refName = referee?.name ?? detail.referee?.find((r) => /referee/i.test(r.role))?.name ?? detail.referee?.[0]?.name;
  const stadiumName = venue?.name ?? detail.venue_name ?? null;

  const hasHighlights = Boolean(youtubeEmbedSrc(cmsFixture?.highlightsYoutubeUrl));
  const hasWatchalong = Boolean(youtubeEmbedSrc(cmsFixture?.watchalongYoutubeUrl));
  // YouTube tabs are CMS-gated — ignore deep links when that field is empty.
  const resolvedTab =
    (activeTab === "highlights" && !hasHighlights) ||
    (activeTab === "watchalong" && !hasWatchalong)
      ? "details"
      : activeTab;

  // Light availability for tab badge on every render; full payload only for animation tab (lazy engine).
  const animationPayload = await buildMatchAnimationPublicPayload(data);
  const animationBadge: MatchAnimationTabBadge = animationPayload.availability.tabBadge;

  return (
    <div className="pr-match-centre match-detail">
      <nav aria-label="Breadcrumb">
        <ol className="pr-mc-breadcrumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li>
            <Link href="/matches">Scores &amp; Fixtures</Link>
          </li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li>
            <span>{detail.competition_name}</span>
          </li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li className="pr-mc-breadcrumbs__current">{teamsLabel}</li>
        </ol>
      </nav>

      <div className="pr-mc-shell">
        <div className="pr-mc-main">
          <header className="pr-mc-header">
            <h1 className="pr-mc-header__title">
              {teamsLabel}
              <span className="pr-mc-header__title-meta">
                {" "}
                [{detail.competition_name}]
                {kickoffAt ? ` · ${formatKickoff(kickoffAt)}` : ""}
                {stadiumName ? (
                  <>
                    {" · "}
                    {venue ? (
                      <Link href={`/venues/${venue.slug}`} className="pr-mc-header__venue-link">
                        {stadiumName}
                      </Link>
                    ) : (
                      stadiumName
                    )}
                  </>
                ) : null}
                {" · "}
                {statusLabel(detail.status)}
              </span>
            </h1>
            <div className="pr-mc-header__board">
              <div className="pr-mc-header__team">
                <span className="pr-mc-header__crest-oval">
                  <TeamCrest name={detail.home_team_name} imageUrl={homeImageUrl} size="md" />
                </span>
                <span className="pr-mc-header__name">
                  <TeamProfileLinkFromContext
                    name={detail.home_team_name}
                    externalId={detail.home_team_id}
                    context={entities}
                    side="home"
                  />
                </span>
                {homeCards.length > 0 ? (
                  <div className="pr-mc-header__cards" aria-label="Home cards">
                    {homeCards.map((c, i) => (
                      <span
                        key={`h-${c.type}-${c.minute}-${i}`}
                        className={`pr-mc-header__card pr-mc-header__card--${c.type}`}
                        title={`${c.type === "red" ? "Red" : "Yellow"} card${c.minute ? ` ${c.minute}'` : ""}${c.playerName ? ` · ${c.playerName}` : ""}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="pr-mc-header__centre">
                <span className="pr-mc-header__status">{statusLabel(detail.status)}</span>
                <span className="pr-mc-header__score">
                  {detail.home_team_score} – {detail.away_team_score}
                </span>
                {halfTime ? (
                  <span className="pr-mc-header__ht">
                    HT {halfTime.home}–{halfTime.away}
                  </span>
                ) : null}
              </div>
              <div className="pr-mc-header__team">
                <span className="pr-mc-header__crest-oval">
                  <TeamCrest name={detail.away_team_name} imageUrl={awayImageUrl} size="md" />
                </span>
                <span className="pr-mc-header__name">
                  <TeamProfileLinkFromContext
                    name={detail.away_team_name}
                    externalId={detail.away_team_id}
                    context={entities}
                    side="away"
                  />
                </span>
                {awayCards.length > 0 ? (
                  <div className="pr-mc-header__cards" aria-label="Away cards">
                    {awayCards.map((c, i) => (
                      <span
                        key={`a-${c.type}-${c.minute}-${i}`}
                        className={`pr-mc-header__card pr-mc-header__card--${c.type}`}
                        title={`${c.type === "red" ? "Red" : "Yellow"} card${c.minute ? ` ${c.minute}'` : ""}${c.playerName ? ` · ${c.playerName}` : ""}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <MatchEventTimelineStrip
              events={keyEvents}
              homeTeamId={detail.home_team_id}
              homeTeamName={detail.home_team_name}
              awayTeamName={detail.away_team_name}
              halfTimeScore={halfTime}
            />

            <MatchMomentumChart
              matchStats={matchStats}
              events={keyEvents}
              homeTeamId={detail.home_team_id}
              homeName={detail.home_team_name}
              awayName={detail.away_team_name}
              homeImageUrl={homeImageUrl}
              awayImageUrl={awayImageUrl}
              matchStatus={detail.status}
            />

            {(homeCoach || awayCoach || refName) ? (
              <div className="pr-mc-header__footer">
                <div className="pr-mc-header__footer-side pr-mc-header__footer-side--home">
                  {homeCoach ? (
                    <Link href={`/coaches/${homeCoach.slug}`} className="pr-mc-header__footer-link">
                      <span className="pr-mc-header__footer-label">Coach</span>
                      <span className="pr-mc-header__footer-name">{homeCoach.name}</span>
                      {homeCoach.rating?.ratingLabel && homeCoach.rating.ratingLabel !== "—" ? (
                        <span
                          className="pr-mc-header__staff-rating"
                          title={homeCoach.rating.ratingExplanation ?? undefined}
                        >
                          {homeCoach.rating.ratingLabel}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="pr-mc-header__footer-empty" />
                  )}
                </div>
                <div className="pr-mc-header__footer-ref">
                  {refName ? (
                    <>
                      <span className="pr-mc-header__footer-label">Ref</span>
                      {referee ? (
                        <Link href={`/referees/${referee.slug}`} className="pr-mc-header__footer-link">
                          <span className="pr-mc-header__footer-name">{referee.name}</span>
                          {referee.rating?.ratingLabel && referee.rating.ratingLabel !== "—" ? (
                            <span
                              className="pr-mc-header__staff-rating"
                              title={referee.rating.ratingExplanation ?? undefined}
                            >
                              {referee.rating.ratingLabel}
                            </span>
                          ) : null}
                        </Link>
                      ) : (
                        <span className="pr-mc-header__footer-name">{refName}</span>
                      )}
                    </>
                  ) : null}
                </div>
                <div className="pr-mc-header__footer-side pr-mc-header__footer-side--away">
                  {awayCoach ? (
                    <Link href={`/coaches/${awayCoach.slug}`} className="pr-mc-header__footer-link">
                      <span className="pr-mc-header__footer-label">Coach</span>
                      <span className="pr-mc-header__footer-name">{awayCoach.name}</span>
                      {awayCoach.rating?.ratingLabel && awayCoach.rating.ratingLabel !== "—" ? (
                        <span
                          className="pr-mc-header__staff-rating"
                          title={awayCoach.rating.ratingExplanation ?? undefined}
                        >
                          {awayCoach.rating.ratingLabel}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="pr-mc-header__footer-empty" />
                  )}
                </div>
              </div>
            ) : null}
          </header>

          <MatchDetailTabs
            activeTab={resolvedTab}
            animationBadge={animationBadge}
            hasWatchalong={hasWatchalong}
            hasHighlights={hasHighlights}
          />

          <MatchDetailPanel
            tab={resolvedTab}
            data={data}
            animationPayload={resolvedTab === "animation" ? animationPayload : null}
          />
        </div>

        <MatchCentreSidebar
          matchDate={detail.date}
          competitionName={detail.competition_name}
          competitionId={detail.competition_id}
          currentMatchId={detail.match_id}
        />
      </div>
    </div>
  );
}
