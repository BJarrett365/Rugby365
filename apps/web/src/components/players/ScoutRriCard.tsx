import type { PublicScoutIntelligence } from "@/lib/player-scout-intelligence-service";

type Props = {
  scout: PublicScoutIntelligence;
  className?: string;
};

/** Compact RRI teaser — sits beside rankings/value; does not replace the scouting report. */
export function ScoutRriCard({ scout, className }: Props) {
  return (
    <section
      className={`pr-player-value-card pr-scout-rri-card ${className ?? ""}`.trim()}
      aria-label="Recruitment Index"
    >
      <header className="pr-player-value-card__head">
        <h3>Recruitment Index</h3>
        <span className="pr-player-value-card__trend">{scout.rriGrade}</span>
      </header>
      <dl className="pr-player-value-card__grid">
        <div>
          <dt>RRI</dt>
          <dd>{scout.rriScore}</dd>
        </div>
        <div>
          <dt>Band</dt>
          <dd>{scout.rriBand}</dd>
        </div>
        <div>
          <dt>Potential</dt>
          <dd>{scout.potential}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{scout.recommendationConfidence}%</dd>
        </div>
      </dl>
      <p className="pr-player-value-card__meta">
        {scout.recommendationLabel}
        {scout.marketValueLabel ? ` · ${scout.marketValueLabel}` : ""}
      </p>
    </section>
  );
}
