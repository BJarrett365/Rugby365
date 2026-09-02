import Link from "next/link";
import { R365RadarChart } from "@/components/charts/R365RadarChart";
import { PlayerAiScoutSummaryCard } from "@/components/players/PlayerAiScoutSummaryCard";
import { PlayerKeyAchievementsCard } from "@/components/players/PlayerKeyAchievementsCard";
import { PlayerNextMatchCard } from "@/components/players/PlayerNextMatchCard";
import { PlayerRatingHistoryCard } from "@/components/players/PlayerRatingHistoryCard";
import { PlayerRecentFormCard } from "@/components/players/PlayerRecentFormCard";
import { PlayerRecentMatchesCard } from "@/components/players/PlayerRecentMatchesCard";
import { RefereeProfileChrome } from "@/components/referees/RefereeProfileChrome";
import {
  refereeAchievements,
  refereeForm,
  refereeMatchRows,
  refereeNextMatch,
  refereeRatingSeries,
  refereeStars,
} from "@/lib/referee-overview-adapter";
import type { RefereeDashboardModel } from "@/lib/referee-dashboard-types";

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="pr-player-v2__stars" aria-label={`${stars} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.max(0, Math.min(1, stars - i)) * 100;
        return (
          <span key={i} style={{ position: "relative", display: "inline-block" }}>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>★</span>
            <span
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                width: `${pct}%`,
              }}
            >
              ★
            </span>
          </span>
        );
      })}
    </span>
  );
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  const size = 112;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div className="pr-player-v2__vs-ring" aria-label={`${label} ${value} out of 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="pr-player-v2__vs-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="pr-player-v2__vs-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="url(#ref-vs-ring)"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="ref-vs-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#54b989" />
            <stop offset="100%" stopColor="#c9a227" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pr-player-v2__vs-ring-value">
        <strong>{Math.round(value)}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

function OverviewAside({ model }: { model: RefereeDashboardModel }) {
  const accuracy =
    Number.parseFloat(model.careerStats.find((s) => s.key === "accuracy")?.value ?? "93") || 93;
  const stars = refereeStars(model.overallRating);
  return (
    <aside className="pr-player-v2__rating-card" aria-label="Overview rating">
      <div className="pr-player-v2__value-stack" aria-label="Referee rating stack">
        <section className="pr-player-v2__mini-card pr-player-v2__mini-card--overview">
          <div className="pr-player-v2__mini-head">
            <h3>OVERVIEW</h3>
          </div>
          <div className="pr-player-v2__overview-grid" aria-label="Overview ratings">
            <div className="pr-player-v2__overview-col">
              <span className="pr-player-v2__mini-kicker">OVR</span>
              <strong className="pr-player-v2__mini-big">{model.overallRating.toFixed(1)}</strong>
              <span className="pr-player-v2__overview-sublabel">Overall Rating</span>
            </div>
            <div className="pr-player-v2__overview-col">
              <span className="pr-player-v2__mini-kicker">WORLD RANK</span>
              <strong className="pr-player-v2__mini-big">#{model.worldRank}</strong>
              <span className="pr-player-v2__overview-sublabel">Officials panel</span>
            </div>
            <div className="pr-player-v2__overview-col">
              <span className="pr-player-v2__mini-kicker">RUGBY365 RATING</span>
              <div className="pr-player-v2__rating-stars">
                <StarRating stars={stars} />
                <span className="pr-player-v2__rating-label">
                  {stars >= 4.5 ? "Elite" : stars >= 4 ? "World class" : "International"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="pr-player-v2__mini-card pr-player-v2__mini-card--market">
          <div className="pr-player-v2__market-header-row">
            <div className="pr-player-v2__market-header-label">CAREER APPOINTMENTS</div>
            <div className="pr-player-v2__market-header-label">INTERNATIONAL</div>
          </div>
          <div className="pr-player-v2__market-split">
            <div className="pr-player-v2__market-left">
              <p className="pr-player-v2__market-value">{model.totalMatches}</p>
              <p className="pr-player-v2__market-move pr-player-v2__market-move--muted">Career matches</p>
              <div className="pr-player-v2__confidence-block">
                <div className="pr-player-v2__confidence-label">DECISION ACCURACY</div>
                <div className="pr-player-v2__confidence-row">
                  <span className="pr-player-v2__confidence-pct">{accuracy}%</span>
                  <div className="pr-player-v2__confidence-track" aria-hidden>
                    <div className="pr-player-v2__confidence-fill" style={{ width: `${accuracy}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="pr-player-v2__market-right">
              <p className="pr-player-v2__market-value">{model.internationalMatches}</p>
              <p className="pr-player-v2__market-move pr-player-v2__market-move--muted">Tests &amp; championships</p>
            </div>
          </div>
        </section>

        <section className="pr-player-v2__mini-card pr-player-v2__mini-card--contract">
          <div className="pr-player-v2__contract-header-row">
            <div className="pr-player-v2__contract-header-label">PANEL</div>
            <div className="pr-player-v2__contract-header-label pr-player-v2__contract-header-label--vs">
              <span>ACCURACY SCORE</span>
              {model.isMockAnalytics ? (
                <span className="pr-player-v2__vs-review-badge pr-player-v2__vs-review-badge--provisional">
                  SAMPLE
                </span>
              ) : null}
            </div>
          </div>
          <div className="pr-player-v2__contract-value-score">
            <div className="pr-player-v2__contract-left">
              <dl className="pr-player-v2__contract-dl">
                <div>
                  <dt>Union</dt>
                  <dd>{model.bio.union}</dd>
                </div>
                <div>
                  <dt>World Rugby debut</dt>
                  <dd>{model.bio.worldRugbyDebut}</dd>
                </div>
              </dl>
            </div>
            <div className="pr-player-v2__contract-right">
              <ScoreRing value={accuracy} label="Decision accuracy" />
              <div className="pr-player-v2__vs-rows">
                {model.disciplinary.map((row) => (
                  <div className="pr-player-v2__vs-line" key={row.key}>
                    <span>{row.label}</span>
                    <span className="pr-player-v2__vs-line-value">{row.careerTotal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function PublicRefereeOverviewV2({
  model,
  preview = false,
}: {
  model: RefereeDashboardModel;
  preview?: boolean;
}) {
  const matches = refereeMatchRows(model);
  const form = refereeForm(model);
  const next = refereeNextMatch(model);
  const honours = refereeAchievements(model);
  const ratingSeries = refereeRatingSeries(model);
  const radarAxes = model.radar.map((row) => ({
    key: row.category.toLowerCase().replace(/\s+/g, "_"),
    label: row.category,
  }));

  return (
    <RefereeProfileChrome
      model={model}
      active="overview"
      preview={preview}
      showHeroAside={<OverviewAside model={model} />}
    >
      <div className="pr-player-v2__grid">
        <div className="pr-player-v2__row--3">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Match type breakdown</h2>
            </div>
            <div className="pr-player-v2__bars">
              {model.matchTypeBreakdown.map((row) => (
                <div key={row.competition} className="pr-player-v2__bar-row">
                  <span>
                    {row.competition}
                    <small style={{ display: "block", opacity: 0.7 }}>{row.matches} matches</small>
                  </span>
                  <div className="pr-player-v2__bar-track">
                    <div
                      className="pr-player-v2__bar-fill"
                      style={{ width: `${Math.min(100, row.avgRating)}%` }}
                    />
                  </div>
                  <span>{row.avgRating.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Rankings</h2>
            </div>
            <ul className="pr-player-v2__position-list">
              <li>
                <div className="pr-player-v2__position-row">
                  <span>World</span>
                  <span className="pr-player-v2__position-pct">#{model.worldRank}</span>
                </div>
              </li>
              <li>
                <div className="pr-player-v2__position-row">
                  <span>International matches</span>
                  <span className="pr-player-v2__position-pct">{model.internationalMatches}</span>
                </div>
              </li>
              <li>
                <div className="pr-player-v2__position-row">
                  <span>Career matches</span>
                  <span className="pr-player-v2__position-pct">{model.totalMatches}</span>
                </div>
              </li>
            </ul>
            <div className="pr-player-v2__card-foot">
              <Link className="pr-player-v2__card-link" href={`/referees/${model.slug}/rankings`}>
                View rankings &gt;
              </Link>
            </div>
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Key statistics</h2>
            </div>
            <ul className="pr-player-v2__position-list">
              {model.careerStats.slice(0, 8).map((row) => (
                <li key={row.key}>
                  <div className="pr-player-v2__position-row">
                    <span>{row.label}</span>
                    <span className="pr-player-v2__position-pct">
                      {row.value}
                      {row.hint ? ` ${row.hint}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets pr-player-v2__row--analytics">
          <div className="pr-player-v2__card pr-player-v2__widget-card">
            <div className="pr-player-v2__card-head">
              <h2>Performance Radar</h2>
            </div>
            <R365RadarChart
              axes={radarAxes}
              series={[
                {
                  id: "referee",
                  label: model.name,
                  values: model.radar.map((row) => row.referee),
                  color: "#54b989",
                  fillOpacity: 0.28,
                },
                {
                  id: "elite",
                  label: "Elite referee average",
                  values: model.radar.map((row) => row.eliteAverage),
                  color: "#5b8fd9",
                  dashed: true,
                },
              ]}
              drawPolygon
              showScoreLabels
              className="pr-player-v2__widget-radar"
            />
          </div>
          <PlayerRatingHistoryCard
            slug={model.slug}
            points={[]}
            overallSeries={ratingSeries}
            fullHistoryHref={`/referees/${model.slug}/rankings`}
            showMetricSelect={false}
          />
          <div className="pr-player-v2__card pr-player-v2__widget-card">
            <div className="pr-player-v2__card-head">
              <h2>Vs elite average</h2>
            </div>
            <div className="pr-player-v2__table-wrap">
              <table className="pr-player-v2__table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>{model.name}</th>
                    <th>Elite avg</th>
                  </tr>
                </thead>
                <tbody>
                  {model.radar.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.referee}</td>
                      <td>{row.eliteAverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets">
          <PlayerRecentFormCard form={form} />
          <PlayerNextMatchCard nextMatch={next} />
          <div className="pr-player-v2__card pr-player-v2__widget-card">
            <div className="pr-player-v2__card-head">
              <h2>Season summary</h2>
              <span className="pr-player-v2__card-head-muted">{model.seasonLabel}</span>
            </div>
            <div className="pr-player-v2__appearance-role-grid">
              {model.seasonSummary.map((row) => (
                <div key={row.key}>
                  <strong>{row.value}</strong>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets">
          <PlayerRecentMatchesCard
            slug={model.slug}
            matches={matches.slice(0, 5)}
            viewAllHref={`/referees/${model.slug}/matches`}
          />
          <PlayerKeyAchievementsCard
            slug={model.slug}
            tiles={honours}
            viewAllHref={`/referees/${model.slug}/career`}
          />
          <PlayerAiScoutSummaryCard
            slug={model.slug}
            summary={model.about}
            strengths={model.strengths.map((row) => row.label)}
            development={model.developmentAreas.map((row) => row.label)}
            bestRole={model.bio.preferredRole}
            provisional={model.isMockAnalytics}
            title="Official profile"
            reportHref={`/referees/${model.slug}/career`}
            reportLabel="Read full profile >"
          />
        </div>
      </div>

      <footer className="pr-player-v2__disclaimer">
        {model.isMockAnalytics
          ? "Career analytics on this page are sample model values until match-official feeds are connected."
          : "Data and ratings provided by Rugby365 Intelligence."}
      </footer>
    </RefereeProfileChrome>
  );
}
