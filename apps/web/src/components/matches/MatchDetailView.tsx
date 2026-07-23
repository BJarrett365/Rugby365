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
import { MatchCentreSidebar } from "./MatchCentreSidebar";
import { MatchHeadToHeadPublic } from "./MatchHeadToHeadPublic";
import { MatchLiveTablesPanel } from "./MatchLiveTablesPanel";
import { TeamCrest } from "./TeamCrest";

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

function MatchDetailPanel({ tab, data }: { tab: MatchDetailTab; data: MatchDetailPageData }) {
  const { detail, lineups, matchStats, playerStats, planetRugbyUrl, cmsFixture, entities } = data;
  const keyEvents = detail.key_events ?? [];
  const mappedPlayers = Object.keys(entities.playersByExternalId).length;
  const homeImageUrl = entities.homeTeam?.imageUrl ?? detail.home_team_icon ?? null;
  const awayImageUrl = entities.awayTeam?.imageUrl ?? detail.away_team_icon ?? null;

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
      />
      <MatchSummaryPanel
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
        matchStats={matchStats}
      />
      <KeyEventsPanel events={keyEvents} homeTeamId={detail.home_team_id} entities={entities} />
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

export function MatchDetailView({
  data,
  activeTab = "details",
}: {
  data: MatchDetailPageData;
  activeTab?: MatchDetailTab;
}) {
  const { detail, kickoffAt, entities } = data;
  const mainRef = detail.referee?.find((r) => /referee/i.test(r.role)) ?? detail.referee?.[0];
  const teamsLabel = `${detail.home_team_name} v ${detail.away_team_name}`;
  const homeImageUrl = entities.homeTeam?.imageUrl ?? detail.home_team_icon ?? null;
  const awayImageUrl = entities.awayTeam?.imageUrl ?? detail.away_team_icon ?? null;
  const keyEvents = detail.key_events ?? [];

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
                {detail.venue_name ? ` · ${detail.venue_name}` : ""}
                {" · "}
                {statusLabel(detail.status)}
              </span>
            </h1>
            <div className="pr-mc-header__board">
              <div className="pr-mc-header__team">
                <TeamCrest name={detail.home_team_name} imageUrl={homeImageUrl} size="lg" />
                <span className="pr-mc-header__name">
                  <TeamProfileLinkFromContext
                    name={detail.home_team_name}
                    externalId={detail.home_team_id}
                    context={entities}
                    side="home"
                  />
                </span>
              </div>
              <div className="pr-mc-header__centre">
                <span className="pr-mc-header__status">{statusLabel(detail.status)}</span>
                <span className="pr-mc-header__score">
                  {detail.home_team_score} – {detail.away_team_score}
                </span>
                <MatchEventTimelineStrip events={keyEvents} homeTeamId={detail.home_team_id} />
              </div>
              <div className="pr-mc-header__team">
                <TeamCrest name={detail.away_team_name} imageUrl={awayImageUrl} size="lg" />
                <span className="pr-mc-header__name">
                  <TeamProfileLinkFromContext
                    name={detail.away_team_name}
                    externalId={detail.away_team_id}
                    context={entities}
                    side="away"
                  />
                </span>
              </div>
            </div>
            {mainRef?.name ? (
              <p className="pr-mc-header__meta">Ref: {mainRef.name}</p>
            ) : null}
          </header>

          <MatchDetailTabs activeTab={activeTab} />

          <MatchDetailPanel tab={activeTab} data={data} />
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
