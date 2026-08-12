import Link from "next/link";
import type { PlayerRecentMatchRow } from "@/lib/player-recent-matches-service";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CardCounts({ yellow, red }: { yellow: number; red: number }) {
  return (
    <span className="pr-player-v2__match-cards" aria-label={`${yellow} yellow, ${red} red`}>
      <span className="pr-player-v2__match-card pr-player-v2__match-card--yellow" title="Yellow cards">
        {yellow}
      </span>
      <span className="pr-player-v2__match-card pr-player-v2__match-card--red" title="Red cards">
        {red}
      </span>
    </span>
  );
}

function MatchRowCells({ m }: { m: PlayerRecentMatchRow }) {
  return (
    <>
      <span className="pr-player-v2__rm-date">{formatDate(m.kickoffAt)}</span>
      <span className="pr-player-v2__rm-match">
        <span className="pr-player-v2__rm-match-line">{m.matchLabel}</span>
        {m.result ? (
          <span
            className={`pr-player-v2__result-chip pr-player-v2__form-chip--square pr-player-v2__form-chip--${m.result.toLowerCase()}`}
            aria-label={`Result ${m.result}`}
          >
            {m.result}
          </span>
        ) : null}
      </span>
      <span className="pr-player-v2__rm-comp" title={m.competitionName ?? undefined}>
        {m.competitionName ?? "—"}
      </span>
      <span className="pr-player-v2__rm-rating">
        {m.rating != null ? m.rating.toFixed(1) : "—"}
      </span>
      <span className="pr-player-v2__rm-cards">
        <CardCounts yellow={m.yellowCards} red={m.redCards} />
      </span>
    </>
  );
}

export type PlayerRecentMatchesCardProps = {
  slug: string;
  matches: PlayerRecentMatchRow[];
};

/** RECENT MATCHES — display only; rows from getPlayerRecentMatches. */
export function PlayerRecentMatchesCard({ slug, matches }: PlayerRecentMatchesCardProps) {
  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card pr-player-v2__matches-card">
      <div className="pr-player-v2__card-head">
        <h2>Recent Matches</h2>
      </div>

      {matches.length === 0 ? (
        <p className="pr-player-v2__empty">No recent matches recorded yet.</p>
      ) : (
        <div className="pr-player-v2__rm" role="table" aria-label="Recent matches">
          <div className="pr-player-v2__rm-head" role="row">
            <span role="columnheader">Date</span>
            <span role="columnheader">Match</span>
            <span role="columnheader">Competition</span>
            <span role="columnheader">Rating</span>
            <span role="columnheader">Cards</span>
          </div>
          {matches.map((m) =>
            m.href ? (
              <Link
                key={m.id}
                href={m.href}
                className="pr-player-v2__rm-row pr-player-v2__rm-row--link"
                role="row"
              >
                <MatchRowCells m={m} />
              </Link>
            ) : (
              <div key={m.id} className="pr-player-v2__rm-row" role="row">
                <MatchRowCells m={m} />
              </div>
            ),
          )}
        </div>
      )}

      <div className="pr-player-v2__matches-foot">
        <Link
          className="pr-player-v2__matches-all-btn"
          href={`/players/${slug}/stats?view=matches`}
        >
          View all matches
        </Link>
      </div>
    </div>
  );
}
