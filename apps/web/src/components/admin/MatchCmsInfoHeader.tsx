"use client";

import Link from "next/link";

type TeamRef = { id?: string | null; name?: string | null };

export function MatchCmsInfoHeader({
  matchId,
  homeTeam,
  awayTeam,
  kickoffAt,
  status,
  actions,
}: {
  matchId: string;
  homeTeam?: TeamRef | null;
  awayTeam?: TeamRef | null;
  kickoffAt?: string | Date | null;
  status?: string | null;
  actions?: React.ReactNode;
}) {
  const kickoff = kickoffAt ? new Date(kickoffAt) : null;
  const date =
    kickoff && !Number.isNaN(kickoff.getTime())
      ? kickoff.toLocaleDateString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "—";
  const time =
    kickoff && !Number.isNaN(kickoff.getTime())
      ? kickoff.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "—";

  return (
    <div className="match-cms-info">
      <div className="match-cms-info__row">
        <div>
          <span className="match-cms-info__label">Match ID</span>
          <span className="match-cms-info__value font-mono text-xs">{matchId.slice(0, 8)}</span>
        </div>
        <div>
          <span className="match-cms-info__label">Home</span>
          <span className="match-cms-info__value">
            {homeTeam?.id ? (
              <Link href={`/admin/teams/${homeTeam.id}/edit`} className="match-cms-team-link">
                {homeTeam.name ?? "Home"}
              </Link>
            ) : (
              (homeTeam?.name ?? "—")
            )}
          </span>
        </div>
        <div>
          <span className="match-cms-info__label">Away</span>
          <span className="match-cms-info__value">
            {awayTeam?.id ? (
              <Link href={`/admin/teams/${awayTeam.id}/edit`} className="match-cms-team-link">
                {awayTeam.name ?? "Away"}
              </Link>
            ) : (
              (awayTeam?.name ?? "—")
            )}
          </span>
        </div>
        <div>
          <span className="match-cms-info__label">Date</span>
          <span className="match-cms-info__value">{date}</span>
        </div>
        <div>
          <span className="match-cms-info__label">Time</span>
          <span className="match-cms-info__value">{time}</span>
        </div>
        <div>
          <span className="match-cms-info__label">Status</span>
          <span className="match-cms-info__value">{status ?? "—"}</span>
        </div>
        {actions ? <div className="match-cms-info__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
