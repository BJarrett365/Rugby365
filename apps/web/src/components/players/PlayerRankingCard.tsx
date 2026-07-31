import type { PublicPlayerRankings } from "@/lib/public-player-rankings-service";
import Link from "next/link";

export type PlayerRankingCardProps = {
  rankings: PublicPlayerRankings;
  className?: string;
};

export function PlayerRankingCard({ rankings, className }: PlayerRankingCardProps) {
  const chips = [
    rankings.overallLabel,
    rankings.positionLabel,
    rankings.countryLabel,
    rankings.competitionLabel,
  ].filter(Boolean) as string[];

  return (
    <section className={`pr-player-ranking-card ${className ?? ""}`.trim()} aria-label="Player rankings">
      <header className="pr-player-ranking-card__head">
        <h3>Player Ranking</h3>
      </header>
      {chips.length === 0 ? (
        <p className="pr-mc-transfers-muted">Rankings unlock when a Rugby365 rating is available.</p>
      ) : (
        <ul className="pr-player-ranking-card__chips">
          {chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
      )}
      {rankings.peers.length > 0 ? (
        <ol className="pr-player-ranking-card__peers">
          {rankings.peers.slice(0, 5).map((peer) => (
            <li key={peer.slug} className={peer.isCurrent ? "is-current" : undefined}>
              <span className="pr-player-ranking-card__peer-rank">#{peer.rank}</span>
              {peer.isCurrent ? (
                <span className="pr-player-ranking-card__peer-name">{peer.name}</span>
              ) : (
                <Link href={`/players/${peer.slug}`} className="pr-player-ranking-card__peer-name">
                  {peer.name}
                </Link>
              )}
              <span className="pr-player-ranking-card__peer-rating">{peer.rating}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
