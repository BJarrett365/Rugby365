import Link from "next/link";
import type { PlayerNextMatchCard as NextMatchModel } from "@/lib/player-next-match-service";

function formatKickoffDate(iso: string | null): string {
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatKickoffTime(iso: string | null): string {
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function IconCalendar() {
  return (
    <svg className="pr-player-v2__next-match-icon" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="2"
        y="3"
        width="12"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path d="M2 6.5h12M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="pr-player-v2__next-match-icon" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 5v3.2l2 1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPin() {
  return (
    <svg className="pr-player-v2__next-match-icon" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 14s4.5-4.2 4.5-7.2A4.5 4.5 0 0 0 8 2a4.5 4.5 0 0 0-4.5 4.8C3.5 9.8 8 14 8 14z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle cx="8" cy="6.8" r="1.4" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export type PlayerNextMatchCardProps = {
  nextMatch: NextMatchModel;
};

/** NEXT MATCH widget — resolution in PlayerNextMatchService. */
export function PlayerNextMatchCard({ nextMatch }: PlayerNextMatchCardProps) {
  const empty = !nextMatch.id;

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card pr-player-v2__next-match-card">
      <div className="pr-player-v2__card-head">
        <h2>Next Match</h2>
        {nextMatch.isLive ? <span className="pr-player-v2__live-badge">Live</span> : null}
      </div>

      {empty ? (
        <div className="pr-player-v2__next-match-empty">
          <p className="pr-player-v2__empty">No upcoming fixture scheduled yet.</p>
        </div>
      ) : (
        <>
          {nextMatch.competitionName ? (
            <p className="pr-player-v2__next-match-comp">{nextMatch.competitionName}</p>
          ) : null}

          <div className="pr-player-v2__next-match-teams">
            <div className="pr-player-v2__next-match-team">
              {nextMatch.homeTeamCrestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={nextMatch.homeTeamCrestUrl} alt="" />
              ) : (
                <span className="pr-player-v2__next-match-crest-ph" aria-hidden />
              )}
              <span>{nextMatch.homeTeamName ?? "TBC"}</span>
            </div>
            <span className="pr-player-v2__next-match-vs">VS</span>
            <div className="pr-player-v2__next-match-team">
              {nextMatch.awayTeamCrestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={nextMatch.awayTeamCrestUrl} alt="" />
              ) : (
                <span className="pr-player-v2__next-match-crest-ph" aria-hidden />
              )}
              <span>{nextMatch.awayTeamName ?? "TBC"}</span>
            </div>
          </div>

          <div className="pr-player-v2__next-match-meta">
            <p>
              <IconCalendar /> {formatKickoffDate(nextMatch.kickoffAt)}
              <span className="pr-player-v2__next-match-meta-gap" />
              <IconClock /> {formatKickoffTime(nextMatch.kickoffAt)}
            </p>
            {nextMatch.venueName ? (
              <p>
                <IconPin /> {nextMatch.venueName}
              </p>
            ) : null}
          </div>

          {nextMatch.href ? (
            <Link className="pr-player-v2__next-match-btn" href={nextMatch.href}>
              Match Centre
            </Link>
          ) : (
            <span className="pr-player-v2__next-match-btn pr-player-v2__next-match-btn--disabled">
              Match Centre
            </span>
          )}
        </>
      )}
    </div>
  );
}
