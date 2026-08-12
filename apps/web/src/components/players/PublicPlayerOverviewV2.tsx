import Link from "next/link";
import type { PublicPlayerOverviewV2 as PublicPlayerOverviewV2Type } from "@/lib/public-player-overview-v2-service";
import type { PositionUsageRow } from "@/lib/player-position-usage-service";
import { RugbyPositionPitch } from "@/components/media/RugbyPositionPitch";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PlayerRankingsCard } from "@/components/players/PlayerRankingsCard";
import { PlayerValueTimelineCard } from "@/components/players/PlayerValueTimelineCard";
import { PlayerPerformanceRadarCard } from "@/components/players/PlayerPerformanceRadarCard";
import { PlayerRatingHistoryCard } from "@/components/players/PlayerRatingHistoryCard";
import { PlayerRecentFormCard } from "@/components/players/PlayerRecentFormCard";
import { PlayerComparisonCard } from "@/components/players/PlayerComparisonCard";
import { PlayerNextMatchCard } from "@/components/players/PlayerNextMatchCard";
import { PlayerRecentMatchesCard } from "@/components/players/PlayerRecentMatchesCard";
import { PlayerKeyAchievementsCard } from "@/components/players/PlayerKeyAchievementsCard";
import { PlayerAiScoutSummaryCard } from "@/components/players/PlayerAiScoutSummaryCard";
import { PlayerMarketValueTrendLineChart } from "@/components/players/PlayerMarketValueTrendLineChart";
import { formatGbpCompact } from "@/lib/player-value-math";
import {
  resolveValueScoreRingBand,
  resolveValueScoreRingFillPct,
} from "@/lib/player-value-score-engine";

function positionHoverTitle(p: PositionUsageRow): string {
  return [
    p.positionName,
    `${p.usagePercent}%`,
    `${p.appearances} apps`,
    `${p.starts} starts`,
    p.minutes != null ? `${p.minutes.toLocaleString()} mins` : null,
    p.averageMatchRating != null ? `avg ${p.averageMatchRating.toFixed(1)} / 10` : null,
    p.positionRating != null ? `position ${p.positionRating}` : null,
    p.lastPlayed ? `last ${formatDate(p.lastPlayed)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StarRating({ stars, tone = "gold" }: { stars: number; tone?: "gold" | "green" }) {
  return (
    <span
      className={`pr-player-v2__stars${tone === "green" ? " pr-player-v2__stars--green" : ""}`}
      aria-label={`${stars} out of 5 stars`}
    >
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

function formatValueTrendLabel(trend: string | null): string {
  if (!trend) return "—";
  if (trend === "Rising") return "Rising ↑";
  if (trend === "Falling") return "Falling ↓";
  return trend;
}

function ValueScoreRing({
  value,
  status,
}: {
  value: number | null;
  status: string;
}) {
  const size = 112;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Ring fill = Value Score % — never confidence.
  const fillPct = resolveValueScoreRingFillPct(value);
  const pct = fillPct ?? 0;
  const offset = c * (1 - pct / 100);
  const band = resolveValueScoreRingBand(value);
  const gradId = `pv2-vs-ring-grad-${band.gradientIdSuffix}`;
  const empty = fillPct == null;

  return (
    <div
      className={`pr-player-v2__vs-ring${empty ? " pr-player-v2__vs-ring--empty" : ""} pr-player-v2__vs-ring--${band.band}`}
      title={`Rugby365 Value Score · ${status.replace(/_/g, " ")}`}
      aria-label={
        value != null
          ? `Value score ${Math.round(value)} out of 100. Status ${status.replace(/_/g, " ")}.`
          : `Value score under review. Status ${status.replace(/_/g, " ")}.`
      }
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {band.stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
        <circle
          className="pr-player-v2__vs-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        {!empty ? (
          <circle
            className="pr-player-v2__vs-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            stroke={`url(#${gradId})`}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        ) : null}
      </svg>
      <div className="pr-player-v2__vs-ring-value">
        <strong>{value != null ? Math.round(value) : "—"}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

export function PublicPlayerOverviewV2({ overview }: { overview: PublicPlayerOverviewV2Type }) {
  const factors = overview.playerValue?.factors ?? [];
  const classification = overview.classification;
  const latestMarketPoint = overview.marketValueTimeline24m.points.at(-1) ?? null;
  const marketValueLabel = latestMarketPoint
    ? formatGbpCompact(latestMarketPoint.marketValueGbp)
    : overview.playerValue?.marketValueLabel ?? "—";
  const marketMove30d = overview.marketValueChange30d;
  const marketMove30dTone =
    marketMove30d.state === "OK" && marketMove30d.changePct != null && marketMove30d.changePct !== 0
      ? marketMove30d.changePct > 0
        ? "up"
        : "down"
      : "muted";
  const marketMove30dText =
    marketMove30d.state === "OK"
      ? marketMove30d.changePct === 0
        ? "→ Stable"
        : `${marketMove30d.movementLabel ?? "—"} (30 days)`
      : "Insufficient history";
  const confidencePct = Math.round(overview.valueHealth.displayConfidence * 100);

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="overview" />

      {/* ── Hero lead: coach-parity identity card + facts | value stack ── */}
      <div className="pr-player-v2__hero-lead">
        <PlayerIdentityHero overview={overview} />

        <aside className="pr-player-v2__rating-card" aria-label="Overview rating and value">
          <div className="pr-player-v2__value-stack" aria-label="Value stack">
            {/* ── Card 1: OVERVIEW (OVR | POTENTIAL | RUGBY365 RATING) ── */}
            <section className="pr-player-v2__mini-card pr-player-v2__mini-card--overview">
              <div className="pr-player-v2__mini-head">
                <h3>OVERVIEW</h3>
              </div>
              <div className="pr-player-v2__overview-grid" aria-label="Overview ratings">
                <div className="pr-player-v2__overview-col">
                  <span className="pr-player-v2__mini-kicker">OVR</span>
                  <strong className="pr-player-v2__mini-big">
                    {overview.rating.current != null
                      ? overview.rating.current.toFixed(1)
                      : "—"}
                  </strong>
                  <span className="pr-player-v2__overview-sublabel">Overall Rating</span>
                </div>

                <div className="pr-player-v2__overview-col">
                  <span className="pr-player-v2__mini-kicker">POTENTIAL</span>
                  <strong
                    className="pr-player-v2__mini-big"
                    title={`Potential confidence: ${Math.round(overview.potential.confidence)}% · ${overview.potential.note}`}
                  >
                    {overview.potential.potential != null ? overview.potential.potential.toFixed(1) : "—"}
                  </strong>
                  <span className="pr-player-v2__overview-sublabel">Potential Rating</span>
                </div>

                <div className="pr-player-v2__overview-col">
                  <span className="pr-player-v2__mini-kicker">RUGBY365 RATING</span>
                  <div className="pr-player-v2__rating-stars">
                    <StarRating stars={classification.stars ?? 0} />
                    <span className="pr-player-v2__rating-label" title={`Rugby365 rating trust: ${overview.ratingState}`}>
                      {classification.label ?? "Unrated"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Card 2: MARKET VALUE (value + 30d move + confidence + 24m trend) ── */}
            <section className="pr-player-v2__mini-card pr-player-v2__mini-card--market">
              <div className="pr-player-v2__market-header-row" aria-label="Market value headers">
                <div className="pr-player-v2__market-header-label">ESTIMATED MARKET VALUE</div>
                <div className="pr-player-v2__market-header-label">VALUE TREND (LAST 24 MONTHS)</div>
              </div>

              <div className="pr-player-v2__market-split" aria-label="Market value">
                <div className="pr-player-v2__market-left">
                  <p className="pr-player-v2__market-value">{marketValueLabel}</p>

                  <p className={`pr-player-v2__market-move pr-player-v2__market-move--${marketMove30dTone}`}>
                    {marketMove30dText}
                  </p>

                  <div
                    className="pr-player-v2__confidence-block"
                    role="group"
                    aria-label="Market value confidence"
                    title={`Confidence adjusted by data health: ${confidencePct}% · ${overview.valueHealth.reasons.join("; ")}`}
                  >
                    <div className="pr-player-v2__confidence-label">CONFIDENCE</div>
                    <div className="pr-player-v2__confidence-row">
                      <span className="pr-player-v2__confidence-pct">{confidencePct}%</span>
                      <div className="pr-player-v2__confidence-track" aria-hidden>
                        <div
                          className="pr-player-v2__confidence-fill"
                          style={{ width: `${confidencePct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pr-player-v2__market-right">
                  <PlayerMarketValueTrendLineChart
                    points={overview.marketValueTimeline24m.points}
                    rangeStartIso={overview.marketValueTimeline24m.rangeStartIso}
                    rangeEndIso={overview.marketValueTimeline24m.rangeEndIso}
                    state={overview.marketValueTimeline24m.state}
                    limitedHistory={overview.marketValueTimeline24m.limitedHistory}
                    hideCaptionAndLegend
                    className="pr-player-v2__market-chart"
                  />
                </div>
              </div>
            </section>

            {/* ── Card 3: ESTIMATED CONTRACT + VALUE SCORE ── */}
            <section className="pr-player-v2__mini-card pr-player-v2__mini-card--contract">
              <div className="pr-player-v2__contract-header-row" aria-label="Contract and value score headers">
                <div className="pr-player-v2__contract-header-label">ESTIMATED CONTRACT</div>
                <div className="pr-player-v2__contract-header-label pr-player-v2__contract-header-label--vs">
                  <Link
                    href={`/players/${overview.slug}/intelligence?section=value-score`}
                    className="pr-player-v2__vs-title-link"
                  >
                    <span>RUGBY365 VALUE SCORE</span>
                  </Link>
                  {overview.valueScore.status === "UNDER_REVIEW" ? (
                    <span className="pr-player-v2__vs-review-badge">UNDER REVIEW</span>
                  ) : overview.valueScore.status === "PROVISIONAL" ? (
                    <span className="pr-player-v2__vs-review-badge pr-player-v2__vs-review-badge--provisional">
                      PROVISIONAL
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="pr-player-v2__contract-value-score" aria-label="Contract and value score">
                <div className="pr-player-v2__contract-left">
                  <dl className="pr-player-v2__contract-dl">
                    <div>
                      <dt>Contract value</dt>
                      <dd>
                        {overview.playerValue?.contractValueLabel
                          ? `${overview.playerValue.contractValueLabel}/yr`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Contract ends</dt>
                      <dd>
                        {overview.contract.expiresOn && overview.contract.datesVerified
                          ? formatDate(overview.contract.expiresOn)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="pr-player-v2__contract-right">
                  <ValueScoreRing
                    value={overview.valueScore.score}
                    status={overview.valueScore.status}
                  />

                  <div className="pr-player-v2__vs-rows" aria-label="Value score breakdown">
                    <div className="pr-player-v2__vs-line">
                      <span>Rating</span>
                      <span className="pr-player-v2__vs-line-value">
                        {classification.stars > 0 ? (
                          <StarRating stars={classification.stars} tone="green" />
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    <div className="pr-player-v2__vs-line">
                      <span>Value Trend</span>
                      <span
                        className={`pr-player-v2__vs-line-value${
                          overview.valueScore.valueTrend ? " pr-player-v2__vs-line-value--accent" : ""
                        }`}
                      >
                        {formatValueTrendLabel(overview.valueScore.valueTrend)}
                      </span>
                    </div>
                    <div className="pr-player-v2__vs-line">
                      <span>Market Demand</span>
                      <span
                        className={`pr-player-v2__vs-line-value${
                          overview.valueScore.marketDemand ? " pr-player-v2__vs-line-value--accent" : ""
                        }`}
                      >
                        {overview.valueScore.marketDemand ?? "—"}
                      </span>
                    </div>
                    <div className="pr-player-v2__vs-line">
                      <span>Transfer Interest</span>
                      <span
                        className={`pr-player-v2__vs-line-value${
                          overview.valueScore.transferInterest
                            ? " pr-player-v2__vs-line-value--accent"
                            : ""
                        }`}
                      >
                        {overview.valueScore.transferInterest ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>

      <div className="pr-player-v2__grid">
        {/* ── Positions | Rankings | Value breakdown ── */}
        <div className="pr-player-v2__row--3">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Positions Played</h2>
              {overview.positionHistory.usage.statsHref ? (
                <Link
                  href={overview.positionHistory.usage.statsHref}
                  className="pr-player-v2__card-link"
                >
                  View position stats
                </Link>
              ) : null}
            </div>
            <div className="pr-player-v2__positions">
              <RugbyPositionPitch
                mainPosition={overview.positionName}
                otherPositions={overview.otherPositions}
                highlights={overview.positionHistory.usage.positions.map((p) => ({
                  position: p.positionName,
                  classification: p.classification,
                  number: p.number,
                  usagePercent: p.usagePercent,
                  appearances: p.appearances,
                  starts: p.starts,
                  minutes: p.minutes,
                  averageMatchRating: p.averageMatchRating,
                  positionRating: p.positionRating,
                  lastPlayed: p.lastPlayed,
                  statsHref: overview.positionHistory.usage.statsHref
                    ? `${overview.positionHistory.usage.statsHref}&position=${p.positionSlug}`
                    : null,
                }))}
                compact
                showLegend
              />
              <div className="pr-player-v2__positions-panel">
                <p className="pr-player-v2__positions-title">{overview.positionHistory.title}</p>
                {overview.positionHistory.usage.positions.length === 0 ? (
                  <p className="pr-player-v2__empty">No linked appearance data yet.</p>
                ) : (
                  <ul className="pr-player-v2__position-list">
                    {overview.positionHistory.usage.positions.slice(0, 6).map((p) => (
                      <li key={p.positionId} title={positionHoverTitle(p)}>
                        <div className="pr-player-v2__position-row">
                          <span>{p.positionName}</span>
                          {overview.positionHistory.usage.mode === "START_POSITION_ONLY" ? (
                            <span className="pr-player-v2__position-meta">{p.starts} starts</span>
                          ) : null}
                          <span className="pr-player-v2__position-pct">{p.usagePercent}%</span>
                          <div className="pr-player-v2__position-bar">
                            <div
                              className={`pr-player-v2__position-bar-fill pr-player-v2__position-bar-fill--${p.barTone}`}
                              style={{ width: `${Math.min(100, p.usagePercent)}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pr-player-v2__appearance-role">
                  <p className="pr-player-v2__positions-title">Appearance role</p>
                  <div className="pr-player-v2__appearance-role-grid">
                    <div>
                      <strong>{overview.positionHistory.appearanceRole.starts}</strong>
                      <span>
                        Starts
                        {overview.positionHistory.appearanceRole.total > 0
                          ? ` · ${Math.round(overview.positionHistory.appearanceRole.startsPct)}%`
                          : ""}
                      </span>
                    </div>
                    <div>
                      <strong>{overview.positionHistory.appearanceRole.bench}</strong>
                      <span>
                        Bench
                        {overview.positionHistory.appearanceRole.total > 0
                          ? ` · ${Math.round(overview.positionHistory.appearanceRole.benchPct)}%`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <PlayerRankingsCard rankings={overview.rankings} />

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Value Breakdown</h2>
            </div>
            {factors.length === 0 ? (
              <p className="pr-player-v2__empty">No value factors available.</p>
            ) : (
              <div className="pr-player-v2__bars">
                {factors.map((f) => (
                  <div key={f.key} className="pr-player-v2__bar-row">
                    <span>{f.label}</span>
                    <div className="pr-player-v2__bar-track">
                      <div
                        className={`pr-player-v2__bar-fill${f.pct < 0 ? " pr-player-v2__bar-fill--negative" : ""}`}
                        style={{ width: `${Math.min(100, Math.abs(f.pct) * 2)}%` }}
                      />
                    </div>
                    <span>
                      {f.pct > 0 ? "+" : ""}
                      {f.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Value Timeline | Performance Radar | Rating History ── */}
        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets">
          <PlayerValueTimelineCard
            slug={overview.slug}
            displayPoints={overview.valueTimeline.displayPoints}
            rangeStartIso={overview.valueTimeline.rangeStartIso}
            rangeEndIso={overview.valueTimeline.rangeEndIso}
            summary={overview.valueTimeline.summary}
            estimatedMarketValueGbp={
              overview.marketValueTimeline24m.points.at(-1)?.marketValueGbp ??
              overview.playerValue?.marketValueGbp ??
              null
            }
          />
          <PlayerPerformanceRadarCard
            playerName={overview.displayName || overview.name}
            periods={overview.performanceRadarPeriods}
            defaultPeriodId="current"
          />
          <PlayerRatingHistoryCard
            slug={overview.slug}
            points={overview.ratingHistory}
            overallSeries={overview.ratingHistoryOverall.series}
          />
        </div>

        {/* ── Recent Form | Player Comparison | Next Match ── */}
        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets">
          <PlayerRecentFormCard form={overview.playerForm} />
          <PlayerComparisonCard comparison={overview.comparison} />
          <PlayerNextMatchCard nextMatch={overview.nextMatch} />
        </div>

        {/* ── Recent Matches | Key Achievements | AI Scout Summary ── */}
        <div className="pr-player-v2__row--3 pr-player-v2__row--widgets">
          <PlayerRecentMatchesCard
            slug={overview.slug}
            matches={overview.recentMatches.slice(0, 5)}
          />
          <PlayerKeyAchievementsCard slug={overview.slug} tiles={overview.keyAchievements} />
          <PlayerAiScoutSummaryCard
            slug={overview.slug}
            summary={overview.scoutSummary}
            strengths={overview.scoutStrengths}
            development={overview.scoutAreas}
            bestRole={overview.scoutBestRole}
            provisional={overview.scoutProvisional}
            recommendationLabel={overview.scoutIntelligence?.recommendationLabel ?? null}
            rriScore={overview.scoutIntelligence?.rriScore ?? null}
            rriBand={overview.scoutIntelligence?.rriBand ?? null}
          />
        </div>
      </div>

      <footer className="pr-player-v2__disclaimer">
        Data, ratings and values provided by Rugby365 Intelligence.
        {overview.dataLastUpdatedIso ? (
          <> Last updated: {formatDate(overview.dataLastUpdatedIso)}</>
        ) : null}
      </footer>
    </article>
  );
}
