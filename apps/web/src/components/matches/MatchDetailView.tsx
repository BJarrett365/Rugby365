import Link from "next/link";
import type { MatchDetailPageData } from "@/lib/match-detail-service";
import {
  KeyEventsPanel,
  KeyPlayerStatsPanel,
  MatchSummaryPanel,
  MatchTeamStatsPanel,
  PlayerStatsPanel,
} from "./MatchDetailSections";
import { MatchDetailTabs } from "./MatchDetailTabs";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { TeamProfileLinkFromContext } from "./EntityProfileLinks";
import { MatchLineupsWithRatings } from "./MatchLineupsWithRatings";

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
  if (status === "Result") return "Full time";
  if (status === "Fixture") return "Scheduled";
  return status;
}

function RecentFormBlock({ label, data }: { label: string; data: Record<string, unknown> | undefined }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="match-detail-form">
      <h3 className="match-detail-section__title">{label}</h3>
      <dl className="match-detail-form__grid">
        {entries.slice(0, 8).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/_/g, " ")}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
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

  if (tab === "stats") {
    return (
      <>
        <section className="match-detail-section">
          <h2 className="match-detail-section__heading">Match stats</h2>
          <MatchTeamStatsPanel matchStats={matchStats} />
        </section>
        <PlayerStatsPanel
          playerStats={playerStats}
          homeName={detail.home_team_name}
          awayName={detail.away_team_name}
          entities={entities}
        />
        <KeyPlayerStatsPanel
          playerStats={playerStats}
          homeName={detail.home_team_name}
          awayName={detail.away_team_name}
          entities={entities}
        />
      </>
    );
  }

  if (tab === "lineups") {
    if (!lineups) {
      return <p className="match-detail-empty">Lineups are not available for this match yet.</p>;
    }
    return (
      <MatchLineupsWithRatings
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
    const h2h = detail.head_to_head ?? [];
    const lastFive = detail.last_five_meetings ?? [];
    if (h2h.length === 0 && lastFive.length === 0) {
      return <p className="match-detail-empty">Head-to-head data is not available for this match yet.</p>;
    }
    return (
      <>
        {h2h.length > 0 && (
          <section className="match-detail-section">
            <h2 className="match-detail-section__heading">Overall record</h2>
            {h2h.map((row, i) => (
              <div key={i} className="match-detail-h2h cms-card">
                <p className="match-detail-h2h__comp m-0 text-sm text-zinc-400">
                  {String(row.competition_name ?? detail.competition_name)}
                </p>
                <div className="match-detail-h2h__wins">
                  <div>
                    <span className="match-detail-h2h__num">{String(row.home_team_wins ?? "—")}</span>
                    <span className="match-detail-h2h__label">{detail.home_team_name} wins</span>
                  </div>
                  <div>
                    <span className="match-detail-h2h__num">{String(row.away_team_wins ?? "—")}</span>
                    <span className="match-detail-h2h__label">{detail.away_team_name} wins</span>
                  </div>
                </div>
                {(row.home_team_avg_tries || row.away_team_avg_tries) && (
                  <dl className="match-detail-h2h__avg">
                    <div>
                      <dt>Avg tries</dt>
                      <dd>
                        {String(row.home_team_avg_tries ?? "—")} · {String(row.away_team_avg_tries ?? "—")}
                      </dd>
                    </div>
                    <div>
                      <dt>Avg carries</dt>
                      <dd>
                        {String(row.home_team_avg_carries ?? "—")} · {String(row.away_team_avg_carries ?? "—")}
                      </dd>
                    </div>
                    <div>
                      <dt>Avg tackles</dt>
                      <dd>
                        {String(row.home_team_avg_tackles ?? "—")} · {String(row.away_team_avg_tackles ?? "—")}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            ))}
          </section>
        )}
        {lastFive.length > 0 && (
          <section className="match-detail-section">
            <h2 className="match-detail-section__heading">Last five meetings</h2>
            <ul className="match-detail-meetings">
              {lastFive.map((row, i) => (
                <li key={i} className="match-detail-meetings__item cms-card">
                  {Object.entries(row)
                    .filter(([, v]) => v != null && v !== "")
                    .map(([key, value]) => (
                      <span key={key}>
                        <strong>{key.replace(/_/g, " ")}:</strong> {String(value)}
                      </span>
                    ))}
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
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
      <MatchSummaryPanel
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        matchStats={matchStats}
        scoringDetail={detail.detail as Record<string, unknown> | undefined}
        entities={entities}
      />
      <KeyEventsPanel events={keyEvents} homeTeamId={detail.home_team_id} entities={entities} />
      <section className="match-detail-section match-detail-section--grid">
        <RecentFormBlock label={detail.home_team_name} data={detail.home_recent_results} />
        <RecentFormBlock label={detail.away_team_name} data={detail.away_recent_results} />
      </section>
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
      {lineups && (
        <MatchLineupsWithRatings
          lineups={lineups}
          entities={entities}
          ratings={data.matchRatings}
          rugby365PotmName={data.rugby365PotmName}
          officialPotmName={data.officialPotmName}
          matchStatus={detail.status}
        />
      )}
      <MatchTeamStatsPanel matchStats={matchStats} />
      <PlayerStatsPanel
        playerStats={playerStats}
        homeName={detail.home_team_name}
        awayName={detail.away_team_name}
        entities={entities}
      />
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
  const { detail, planetRugbyUrl, kickoffAt, cmsFixture, entities } = data;
  const mainRef = detail.referee?.find((r) => /referee/i.test(r.role)) ?? detail.referee?.[0];

  return (
    <div className="match-detail">
      <nav className="match-detail__nav">
        <Link href="/matches" className="match-detail__back">
          ← All matches
        </Link>
        <div className="match-detail__actions">
          {cmsFixture && activeTab !== "edit" && (
            <Link href={`/admin/matches/${cmsFixture.id}/edit`} className="cms-btn cms-btn--secondary">
              Edit
            </Link>
          )}
          {cmsFixture && (
            <Link href={`/matches/${cmsFixture.slug}/commentary`} className="cms-btn cms-btn--secondary">
              Live commentary
            </Link>
          )}
          <a href={planetRugbyUrl} target="_blank" rel="noreferrer" className="cms-btn cms-btn--secondary">
            Planet Rugby
          </a>
        </div>
      </nav>

      <header className="match-detail-hero">
        <p className="match-detail-hero__comp">{detail.competition_name}</p>
        {detail.round && <p className="match-detail-hero__round">{detail.round}</p>}
        <div className="match-detail-hero__scoreboard">
          <div className="match-detail-hero__team">
            <span className="match-detail-hero__name">
              <TeamProfileLinkFromContext
                name={detail.home_team_name}
                externalId={detail.home_team_id}
                context={entities}
                side="home"
              />
            </span>
            <span className="match-detail-hero__score">{detail.home_team_score}</span>
          </div>
          <span className="match-detail-hero__vs">{statusLabel(detail.status)}</span>
          <div className="match-detail-hero__team match-detail-hero__team--away">
            <span className="match-detail-hero__name">
              <TeamProfileLinkFromContext
                name={detail.away_team_name}
                externalId={detail.away_team_id}
                context={entities}
                side="away"
              />
            </span>
            <span className="match-detail-hero__score">{detail.away_team_score}</span>
          </div>
        </div>
        <p className="match-detail-hero__meta">
          {formatKickoff(kickoffAt)}
          {detail.venue_name ? ` · ${detail.venue_name}` : ""}
          {mainRef?.name ? ` · ${mainRef.name}` : ""}
        </p>
      </header>

      <MatchDetailTabs activeTab={activeTab} />

      <MatchDetailPanel tab={activeTab} data={data} />
    </div>
  );
}
