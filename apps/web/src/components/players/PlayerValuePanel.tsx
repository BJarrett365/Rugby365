import type { PublicPlayerValue } from "@/lib/player-value-service";
import { ValueBreakdown } from "@/components/players/ValueBreakdown";
import { ValueTimelineChart } from "@/components/players/ValueTimelineChart";
import { PlayerValueCard } from "@/components/players/PlayerValueCard";

export function PlayerValuePanel({ value }: { value: PublicPlayerValue }) {
  return (
    <section className="pr-player-value" aria-labelledby="player-value-heading">
      <header className="pr-player-value__header">
        <div>
          <h2 id="player-value-heading">Player Value</h2>
          <p className="pr-player-value__sub">
            Rugby365 market worth model · {value.modelVersion} · Confidence{" "}
            {value.confidenceLabel}
          </p>
        </div>
        <p className="pr-player-value__trend" aria-label={`Trend ${value.trendLabel}`}>
          {value.trendLabel}
        </p>
      </header>

      <PlayerValueCard value={value} className="pr-player-value__summary-card" />

      <div className="pr-player-value__hero">
        <div className="pr-player-value__hero-main">
          <span className="pr-player-value__hero-label">Current Market Value</span>
          <strong className="pr-player-value__hero-figure">{value.marketValueLabel}</strong>
          <span className="pr-player-value__hero-meta">
            Peak career {value.peakCareerValueLabel} · Band {value.ratingBandLabel}
          </span>
        </div>
        <dl className="pr-player-value__quad">
          <div>
            <dt>Transfer value</dt>
            <dd>{value.transferValueLabel}</dd>
          </div>
          <div>
            <dt>Contract value</dt>
            <dd>
              {value.contractValueLabel}
              <span className="pr-player-value__pa"> / yr</span>
            </dd>
          </div>
          <div>
            <dt>Future value</dt>
            <dd>{value.futureValueLabel}</dd>
          </div>
          <div>
            <dt>Risk score</dt>
            <dd>{value.riskScore}</dd>
          </div>
        </dl>
      </div>

      <div className="pr-player-value__grid">
        <div className="pr-player-value__card">
          <h3>Value breakdown</h3>
          <ValueBreakdown factors={value.factors} />
        </div>

        <div className="pr-player-value__card">
          <h3>Value timeline</h3>
          <ValueTimelineChart
            timeline={value.timeline}
            currentValueGbp={value.marketValueGbp}
            peakValueGbp={value.peakCareerValueGbp}
          />
        </div>
      </div>

      <div className="pr-player-value__recs">
        <h3>Recommendations</h3>
        <dl>
          <div>
            <dt>Transfer</dt>
            <dd>{value.recommendations.transfer}</dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>{value.recommendations.contract}</dd>
          </div>
          <div>
            <dt>Resale potential</dt>
            <dd>{value.recommendations.resale}</dd>
          </div>
        </dl>
      </div>

      {value.mediaCheck && value.mediaCheck.status !== "skipped" ? (
        <div className="pr-player-value__media">
          <h3>Media check</h3>
          <p>{value.mediaCheck.summary}</p>
          {value.mediaCheck.citedUrls.length > 0 ? (
            <ul>
              {value.mediaCheck.citedUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="pr-player-value__disclaimer">{value.disclaimer}</p>
    </section>
  );
}
