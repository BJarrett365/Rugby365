import type { PublicPlayerValue } from "@/lib/player-value-service";
import { formatGbpCompact } from "@/lib/player-value-math";

export type PlayerValueCardProps = {
  value: PublicPlayerValue;
  className?: string;
};

/** Compact market-value analytics card for profile header / overview. */
export function PlayerValueCard({ value, className }: PlayerValueCardProps) {
  return (
    <section className={`pr-player-value-card ${className ?? ""}`.trim()} aria-label="Market value">
      <header className="pr-player-value-card__head">
        <h3>Market Value</h3>
        <span className="pr-player-value-card__trend">{value.trendLabel}</span>
      </header>
      <dl className="pr-player-value-card__grid">
        <div>
          <dt>Current Value</dt>
          <dd>{value.marketValueLabel}</dd>
        </div>
        <div>
          <dt>Highest</dt>
          <dd>{value.peakCareerValueLabel}</dd>
        </div>
        <div>
          <dt>Trend</dt>
          <dd>{value.trendLabel}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(value.confidence * 100)}%</dd>
        </div>
      </dl>
      <p className="pr-player-value-card__meta">
        Band {value.ratingBandLabel}
        {value.contractValueLabel ? ` · Contract ~${value.contractValueLabel}/yr` : ""}
      </p>
    </section>
  );
}

export function formatValueShort(gbp: number): string {
  return formatGbpCompact(gbp);
}
