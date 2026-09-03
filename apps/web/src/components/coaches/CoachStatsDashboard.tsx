import Link from "next/link";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { CoachMetricBreakdownTable } from "./CoachMetricBreakdownTable";
import { CoachRatingTrendsCard } from "./CoachRatingTrendsCard";

function dash(v: string | number | null | undefined): string {
  if (v == null || v === "") return "0";
  return String(v);
}

function Gauge({
  value,
  label,
  sub,
}: {
  value: number | null;
  label: string;
  sub?: string;
}) {
  const pct = value != null ? Math.max(0, Math.min(100, value)) : 0;
  const c = 2 * Math.PI * 54;
  return (
    <div className="pr-coach-gauge" aria-label={`${label} ${value != null ? value.toFixed(1) : "0"} out of 100`}>
      <div className="pr-coach-power__ring">
        <svg className="pr-coach-power__svg" viewBox="0 0 120 120" aria-hidden>
          <circle className="pr-coach-power__track" cx="60" cy="60" r="54" />
          <circle
            className="pr-coach-power__progress"
            cx="60"
            cy="60"
            r="54"
            style={{ strokeDasharray: `${c}`, strokeDashoffset: `${c * (1 - pct / 100)}` }}
          />
        </svg>
        <div className="pr-coach-power__ring-inner">
          <strong>{value != null ? value.toFixed(1) : "0"}</strong>
          <span>OUT OF 100</span>
        </div>
      </div>
      <div className="pr-coach-gauge__label">{label}</div>
      {sub ? <div className="pr-coach-gauge__sub">{sub}</div> : null}
    </div>
  );
}

function intelTone(key: string): string {
  if (/attack|results/.test(key)) return "cyan";
  if (/defence|depth/.test(key)) return "blue";
  if (/form/.test(key)) return "green";
  if (/honour|big_match|experience/.test(key)) return "orange";
  return "purple";
}

export function CoachStatsDashboard({ profile }: { profile: PublicCoachProfile }) {
  const r = profile.ratings;
  const cr = profile.careerRecord;
  const form = cr.form.length ? cr.form : profile.recentMatches.map((m) => m.result).filter(Boolean);
  const intelligence = r.intelligence?.length ? r.intelligence : r.metrics;
  const why = r.coachRatingDetail?.contributions ?? [];
  const powerRows = (r.powerIndexDetail?.contributions ?? []).map((c) => ({
    key: c.key,
    label: c.label,
    score: c.score,
    weight: c.weight,
    contribution: c.contribution,
    trend: c.trend,
    confidence: c.confidence,
  }));

  return (
    <div className="pr-coach-stats">
      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Career Record</h2>
          </div>
          <ul className="pr-coach-stats__record">
            <li>
              Played <strong>{cr.played}</strong>
              <span>
                W{cr.wins} D{cr.draws} L{cr.losses}
              </span>
            </li>
            <li>
              Win rate <strong className="is-green">{cr.winRate != null ? `${cr.winRate}%` : "0"}</strong>
            </li>
            <li>
              Points for / against{" "}
              <strong>
                {cr.pointsFor.toLocaleString()} / {cr.pointsAgainst.toLocaleString()}
              </strong>
            </li>
            <li>
              P/G · PA/G{" "}
              <strong>
                {dash(cr.pointsForPerGame)} · {dash(cr.pointsAgainstPerGame)}
              </strong>
            </li>
            <li>
              Streaks{" "}
              <strong>
                longest {cr.longestWinStreak} · current {cr.currentWinStreak}
              </strong>
            </li>
          </ul>
          <div className="pr-coach-form" style={{ marginTop: "0.75rem" }}>
            {form.length
              ? form.map((f, i) => (
                  <span key={`${f}-${i}`} className={String(f).toLowerCase()}>
                    {f}
                  </span>
                ))
              : null}
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill pr-coach-stats__rating">
          <div className="pr-coach-card__head">
            <h2>Rugby365 Coach Rating</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/rating`}>
              Full breakdown &gt;
            </Link>
          </div>
          <div className="pr-coach-stats__rating-body">
            {profile.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pr-coach-stats__portrait" src={profile.imageUrl} alt={profile.displayName} />
            ) : (
              <span className="pr-coach-stats__portrait is-fallback" aria-hidden />
            )}
            <Gauge
              value={r.overallRating}
              label="Overall"
              sub={`World Rank ${r.worldRank != null ? `#${r.worldRank}` : "—"} of ${r.rankedOutOf ?? "—"}`}
            />
          </div>
          <p className="pr-coach-empty">
            Confidence {r.coachRatingDetail ? `${r.coachRatingDetail.confidence}% (${r.coachRatingDetail.confidenceBand})` : "0"}
            {r.coachRatingDetail ? ` · Coverage ${r.coachRatingDetail.weightedCoverage}%` : ""}
          </p>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Why this rating</h2>
          </div>
          {why.length === 0 ? (
            <p className="pr-coach-empty">No contribution breakdown yet.</p>
          ) : (
            <div className="pr-coach-dash__bars">
              {why.map((row) => (
                <div className="pr-coach-dash__bar-row" key={row.key}>
                  <span>{row.label}</span>
                  <div className="pr-coach-dash__bar">
                    <i style={{ width: `${Math.max(4, Math.min(100, row.score))}%` }} />
                  </div>
                  <strong className="pr-coach-dash__rank">{Math.round(row.score)}</strong>
                  <em className="pr-coach-stats__why-weight">
                    {row.weight}% → {row.contribution.toFixed(1)}
                  </em>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--2">
        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Power Index</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/power-index`}>
              View breakdown &gt;
            </Link>
          </div>
          <Gauge
            value={r.powerIndex}
            label="Current strength"
            sub={`World Rank ${r.worldRank != null ? `#${r.worldRank}` : "—"} · ${
              r.powerIndexDetail
                ? `${r.powerIndexDetail.confidence}% ${r.powerIndexDetail.confidenceBand}`
                : "0"
            }`}
          />
          {r.powerIndexDetail?.modifiers?.length ? (
            <ul className="pr-coach-stats__mods">
              {r.powerIndexDetail.modifiers.map((m) => (
                <li key={m.key}>
                  {m.label}{" "}
                  <strong>
                    {m.effect > 0 ? "+" : ""}
                    {m.effect}
                  </strong>
                </li>
              ))}
              <li>
                Total modifier{" "}
                <strong className="is-green">
                  {r.powerIndexDetail.modifierTotal > 0 ? "+" : ""}
                  {r.powerIndexDetail.modifierTotal}
                </strong>
              </li>
            </ul>
          ) : null}
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Power Index breakdown</h2>
          </div>
          <CoachMetricBreakdownTable rows={powerRows} showConfidence />
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--1">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Coach Intelligence</h2>
          </div>
          <div className="pr-coach-stats__intel">
            <Gauge
              value={r.overallRating}
              label="Overall"
              sub={`World Rank ${r.worldRank != null ? `#${r.worldRank}` : "—"} · Confidence ${r.dataConfidence}`}
            />
            <div className="pr-coach-stats__intel-list">
              {intelligence.map((m) => (
                <div className={`pr-coach-stats__intel-row is-${intelTone(m.key)}`} key={m.key}>
                  <span>{m.label}</span>
                  <div className="pr-coach-dash__bar">
                    <i style={{ width: `${m.score != null ? Math.max(4, m.score) : 0}%` }} />
                  </div>
                  <strong>{m.score != null ? Math.round(m.score) : "0"}</strong>
                  <em>{m.worldRank != null ? `#${m.worldRank}` : "—"}</em>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <CoachRatingTrendsCard slug={profile.slug} initial={profile.ratingTrends} compact />

      <div className="pr-coach-stats__footer">
        <div>
          <span>Win rate</span>
          <strong>{cr.winRate != null ? `${cr.winRate}%` : "0"}</strong>
        </div>
        <div>
          <span>Points for</span>
          <strong>{cr.pointsFor.toLocaleString()}</strong>
        </div>
        <div>
          <span>Points against</span>
          <strong>{cr.pointsAgainst.toLocaleString()}</strong>
        </div>
        <div>
          <span>Longest win streak</span>
          <strong>{cr.longestWinStreak}</strong>
        </div>
      </div>
    </div>
  );
}
