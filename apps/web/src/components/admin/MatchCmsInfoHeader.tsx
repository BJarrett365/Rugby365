"use client";

import Link from "next/link";

type TeamRef = { id?: string | null; name?: string | null };

export function MatchCmsInfoHeader({
  matchId,
  homeTeam,
  awayTeam,
  kickoffAt,
  status,
  halfTimeHome,
  halfTimeAway,
  attendance,
  competitionSlug,
  competitionName,
  actions,
}: {
  matchId: string;
  homeTeam?: TeamRef | null;
  awayTeam?: TeamRef | null;
  kickoffAt?: string | Date | null;
  status?: string | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  attendance?: number | null;
  competitionSlug?: string | null;
  competitionName?: string | null;
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
  const hasHt = halfTimeHome != null && halfTimeAway != null;

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
        {hasHt ? (
          <div>
            <span className="match-cms-info__label">HT</span>
            <span className="match-cms-info__value">
              {halfTimeHome}–{halfTimeAway}
            </span>
          </div>
        ) : null}
        {attendance != null ? (
          <div>
            <span className="match-cms-info__label">Attendance</span>
            <span className="match-cms-info__value">{attendance.toLocaleString("en-GB")}</span>
          </div>
        ) : null}
        {competitionSlug ? (
          <div>
            <span className="match-cms-info__label">Table</span>
            <span className="match-cms-info__value">
              <Link
                href={`/competitions/${competitionSlug}/table`}
                className="match-cms-team-link"
                target="_blank"
                rel="noreferrer"
              >
                {competitionName ? `${competitionName} Full Table` : "Full Table"}
              </Link>
            </span>
          </div>
        ) : null}
        {actions ? <div className="match-cms-info__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
