"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TeamCrest } from "@/components/matches/TeamCrest";
import type {
  MatchBettingIntelligence,
  PlayerPropRow,
  TeamTrendsBlock,
} from "@/lib/match-betting-intelligence-types";

type SubId =
  | "overview"
  | "prediction"
  | "insights"
  | "trends"
  | "props"
  | "builder"
  | "referee"
  | "venue"
  | "coming";

const SUBS: Array<{ id: SubId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "prediction", label: "AI Prediction" },
  { id: "insights", label: "Insights" },
  { id: "trends", label: "Team Trends" },
  { id: "props", label: "Player Props" },
  { id: "builder", label: "Bet Builder" },
  { id: "referee", label: "Referee" },
  { id: "venue", label: "Venue" },
  { id: "coming", label: "Odds & Value" },
];

function ProbBar({
  home,
  draw,
  away,
  homeName,
  awayName,
}: {
  home: number;
  draw: number;
  away: number;
  homeName: string;
  awayName: string;
}) {
  return (
    <div className="pr-bi-prob">
      <div className="pr-bi-prob__labels">
        <span>
          {homeName} <strong>{home}%</strong>
        </span>
        <span>
          Draw <strong>{draw}%</strong>
        </span>
        <span>
          {awayName} <strong>{away}%</strong>
        </span>
      </div>
      <div className="pr-bi-prob__track" aria-hidden>
        <span className="pr-bi-prob__home" style={{ width: `${home}%` }} />
        <span className="pr-bi-prob__draw" style={{ width: `${draw}%` }} />
        <span className="pr-bi-prob__away" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function TrendsTable({ block }: { block: TeamTrendsBlock }) {
  if (!block.windows.length) {
    return <p className="pr-bi__muted">No finished matches in the ledger yet for {block.teamName}.</p>;
  }
  return (
    <div className="pr-bi-table-wrap">
      <table className="pr-bi-table">
        <caption className="pr-bi-table__cap">{block.teamName}</caption>
        <thead>
          <tr>
            <th scope="col">Window</th>
            <th scope="col">P</th>
            <th scope="col">W-D-L</th>
            <th scope="col">Win%</th>
            <th scope="col">PF</th>
            <th scope="col">PA</th>
            <th scope="col">Tries</th>
          </tr>
        </thead>
        <tbody>
          {block.windows.map((w) => (
            <tr key={w.key}>
              <td>{w.label}</td>
              <td>{w.played}</td>
              <td>
                {w.won}-{w.drawn}-{w.lost}
              </td>
              <td>{w.winPct != null ? `${w.winPct}%` : "—"}</td>
              <td>{fmt(w.avgPointsFor)}</td>
              <td>{fmt(w.avgPointsAgainst)}</td>
              <td>{fmt(w.avgTriesFor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropsSide({
  title,
  rows,
}: {
  title: string;
  rows: PlayerPropRow[];
}) {
  if (!rows.length) {
    return <p className="pr-bi__muted">No lineup ratings available for {title} props yet.</p>;
  }
  return (
    <div className="pr-bi-table-wrap">
      <table className="pr-bi-table">
        <caption className="pr-bi-table__cap">{title}</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Try</th>
            <th scope="col">Assist</th>
            <th scope="col">MOTM</th>
            <th scope="col">Tackles</th>
            <th scope="col">Carries</th>
            <th scope="col">Breaks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td>
                <strong>{r.playerName}</strong>
                <span className="pr-bi-table__sub">
                  {r.jerseyNumber != null ? `#${r.jerseyNumber}` : ""}
                  {r.positionName ? ` · ${r.positionName}` : ""}
                </span>
              </td>
              <td>{r.tryPct}%</td>
              <td>{r.assistPct}%</td>
              <td>{r.motmPct}%</td>
              <td>{fmt(r.expectedTackles)}</td>
              <td>{fmt(r.expectedCarries)}</td>
              <td>{fmt(r.expectedLineBreaks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="pr-bi-stat-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MatchBettingIntelligencePanel({
  intel,
}: {
  intel: MatchBettingIntelligence;
}) {
  const [sub, setSub] = useState<SubId>("overview");
  const p = intel.prediction;
  const leanName =
    p.lean === "home" ? intel.homeName : p.lean === "away" ? intel.awayName : null;

  const stars = useMemo(
    () => "★".repeat(intel.confidence.stars) + "☆".repeat(5 - intel.confidence.stars),
    [intel.confidence.stars],
  );

  const homeProps = intel.playerProps.filter((r) => r.teamSide === "home").slice(0, 8);
  const awayProps = intel.playerProps.filter((r) => r.teamSide === "away").slice(0, 8);

  return (
    <section className="pr-bi" aria-label="Betting Intelligence">
      <header className="pr-bi__header">
        <p className="pr-bi__eyebrow">Planet Rugby · Betting Intelligence</p>
        <h2>Betting Intelligence</h2>
        <p className="pr-bi__lede">
          Explainable rugby signals for why a selection may have value — built from Rugby365 data,
          not bookmaker prices. Model <code>{p.modelVersion}</code>.
        </p>
      </header>

      <nav className="pr-bi__subs" aria-label="Betting sections">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`pr-bi__sub${sub === s.id ? " is-active" : ""}`}
            onClick={() => setSub(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {(sub === "overview" || sub === "prediction") && (
        <div className="pr-bi-card">
          <div className="pr-bi-card__head">
            <h3>Planet Rugby Prediction</h3>
            <span className="pr-bi-pill">Confidence {p.confidencePct}%</span>
          </div>

          <div className="pr-bi-teams">
            <div className={`pr-bi-team${p.lean === "home" ? " is-lean" : ""}`}>
              <TeamCrest name={intel.homeName} imageUrl={intel.homeImageUrl} size="md" />
              <span>{intel.homeName}</span>
              <strong>{p.homeWinPct}%</strong>
            </div>
            <div className="pr-bi-team pr-bi-team--draw">
              <span>Draw</span>
              <strong>{p.drawPct}%</strong>
            </div>
            <div className={`pr-bi-team${p.lean === "away" ? " is-lean" : ""}`}>
              <TeamCrest name={intel.awayName} imageUrl={intel.awayImageUrl} size="md" />
              <span>{intel.awayName}</span>
              <strong>{p.awayWinPct}%</strong>
            </div>
          </div>

          <ProbBar
            home={p.homeWinPct}
            draw={p.drawPct}
            away={p.awayWinPct}
            homeName={intel.homeName}
            awayName={intel.awayName}
          />

          <div className="pr-bi-metrics">
            <div>
              <span className="pr-bi-metrics__label">Expected score</span>
              <span className="pr-bi-metrics__value">
                {intel.homeName} {p.expectedHomeScore} · {intel.awayName} {p.expectedAwayScore}
              </span>
            </div>
            <div>
              <span className="pr-bi-metrics__label">Expected tries</span>
              <span className="pr-bi-metrics__value">
                {p.expectedHomeTries} · {p.expectedAwayTries}
              </span>
            </div>
          </div>

          <div className="pr-bi-margins">
            <span className="pr-bi-metrics__label">Winning margin</span>
            <ul>
              {p.winningMargin.map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <strong>{m.probability}%</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="pr-bi-confidence">
            <span>Betting Confidence {stars}</span>
            <span>{intel.confidence.bettingConfidence}%</span>
            <span className="pr-bi-confidence__meta">
              Data {intel.confidence.dataConfidence}% · Prediction{" "}
              {intel.confidence.predictionConfidence}% · Market{" "}
              {intel.confidence.marketConfidence != null
                ? `${intel.confidence.marketConfidence}%`
                : "—"}
            </span>
          </div>
        </div>
      )}

      {(sub === "overview" || sub === "insights") && (
        <div className="pr-bi-card">
          <div className="pr-bi-card__head">
            <h3>{intel.whyTitle}</h3>
          </div>
          <p className="pr-bi__why-lead">{intel.whyLead}</p>
          <ul className="pr-bi-signals">
            {intel.signals.map((s) => (
              <li key={s.key} className={`pr-bi-signal pr-bi-signal--${s.side}`}>
                <div className="pr-bi-signal__top">
                  <span className="pr-bi-signal__check" aria-hidden>
                    {s.side === "neutral" ? "○" : "✔"}
                  </span>
                  <strong>{s.label}</strong>
                  {s.side !== "neutral" ? (
                    <span className="pr-bi-signal__side">
                      Favours {s.side === "home" ? intel.homeName : intel.awayName}
                    </span>
                  ) : null}
                </div>
                <p>{s.detail}</p>
                {s.homeValue != null || s.awayValue != null ? (
                  <div className="pr-bi-signal__compare">
                    <span>
                      {intel.homeName}: {s.homeValue ?? "—"}
                    </span>
                    <span>
                      {intel.awayName}: {s.awayValue ?? "—"}
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {leanName ? (
            <p className="pr-bi__footnote">
              Lean: <strong>{leanName}</strong> — Rugby365-owned signals, not bookmaker prices.
            </p>
          ) : null}

          {(intel.availability.homeUnavailable > 0 ||
            intel.availability.awayUnavailable > 0) && (
            <div className="pr-bi-absences">
              <h4>Injury impact</h4>
              <p>
                Unavailable: {intel.homeName} {intel.availability.homeUnavailable} ·{" "}
                {intel.awayName} {intel.availability.awayUnavailable}
              </p>
              <ul>
                {intel.availability.notableAbsences.slice(0, 8).map((a) => (
                  <li key={`${a.side}-${a.playerName}`}>
                    {a.side === "home" ? intel.homeName : intel.awayName}: {a.playerName} (
                    {a.reason})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {sub === "trends" && (
        <div className="pr-bi-card">
          <div className="pr-bi-card__head">
            <h3>Team Trends</h3>
          </div>
          <p className="pr-bi__muted">
            Last 5 / 10, home, away
            {intel.trends.home.windows.some((w) => w.key === "friday" || w.key === "wet") ||
            intel.trends.away.windows.some((w) => w.key === "friday" || w.key === "wet")
              ? ", plus Friday / wet windows when sample size allows"
              : ""}
            . Win% and scoring from finished CMS fixtures.
          </p>
          <div className="pr-bi-split">
            <TrendsTable block={intel.trends.home} />
            <TrendsTable block={intel.trends.away} />
          </div>
        </div>
      )}

      {sub === "props" && (
        <div className="pr-bi-card">
          <div className="pr-bi-card__head">
            <h3>Player Props</h3>
          </div>
          <p className="pr-bi__muted">
            Modelled probabilities from career rating, form, recent performance samples and team
            expected tries — not bookmaker markets.
          </p>
          <div className="pr-bi-split">
            <PropsSide title={intel.homeName} rows={homeProps} />
            <PropsSide title={intel.awayName} rows={awayProps} />
          </div>
        </div>
      )}

      {sub === "builder" && (
        <div className="pr-bi-card">
          <div className="pr-bi-card__head">
            <h3>Bet Builder Intelligence</h3>
          </div>
          <p className="pr-bi__muted">
            Explainable combinations from Planet Rugby probabilities. Confidence is an
            independent-leg estimate — not a sportsbook price.
          </p>
          {intel.betBuilder.length === 0 ? (
            <p className="pr-bi__muted">Not enough signal for a builder on this fixture yet.</p>
          ) : (
            <ul className="pr-bi-builders">
              {intel.betBuilder.map((b) => (
                <li key={b.title} className="pr-bi-builder">
                  <div className="pr-bi-builder__head">
                    <strong>{b.title}</strong>
                    <span className="pr-bi-pill">{b.combinedConfidencePct}% confidence</span>
                  </div>
                  <ol>
                    {b.legs.map((leg) => (
                      <li key={leg.id}>
                        <span>{leg.label}</span>
                        <em>{leg.probabilityPct}%</em>
                        <span className="pr-bi-builder__detail">{leg.detail}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="pr-bi-builder__why">{b.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sub === "referee" && (
        <div className="pr-bi-card">
          <h3>Referee Intelligence</h3>
          {intel.referee?.name ? (
            <>
              <p>
                {intel.referee.slug ? (
                  <Link href={`/referees/${intel.referee.slug}`}>{intel.referee.name}</Link>
                ) : (
                  intel.referee.name
                )}
                {intel.referee.ratingLabel ? ` · ${intel.referee.ratingLabel}` : ""}
                {intel.referee.matchesSampled > 0
                  ? ` · ${intel.referee.matchesSampled} sampled matches`
                  : ""}
              </p>
              <StatGrid
                items={[
                  {
                    label: "Avg penalties",
                    value: fmt(intel.referee.avgPenalties),
                  },
                  {
                    label: "Avg yellow cards",
                    value: fmt(intel.referee.avgYellowCards),
                  },
                  {
                    label: "Avg red cards",
                    value: fmt(intel.referee.avgRedCards),
                  },
                  {
                    label: "Home win %",
                    value:
                      intel.referee.homeWinPct != null
                        ? `${intel.referee.homeWinPct}%`
                        : "—",
                  },
                  {
                    label: "Away win %",
                    value:
                      intel.referee.awayWinPct != null
                        ? `${intel.referee.awayWinPct}%`
                        : "—",
                  },
                  {
                    label: "Avg points",
                    value: fmt(intel.referee.avgTotalPoints),
                  },
                  {
                    label: "Avg tries",
                    value: fmt(intel.referee.avgTotalTries),
                  },
                ]}
              />
            </>
          ) : (
            <p className="pr-bi__muted">Referee not linked for this fixture yet.</p>
          )}
        </div>
      )}

      {sub === "venue" && (
        <div className="pr-bi-card">
          <h3>Venue Intelligence</h3>
          {intel.venue?.name ? (
            <>
              <p>
                <strong>{intel.venue.name}</strong>
                {intel.venue.city ? ` · ${intel.venue.city}` : ""}
                {intel.venue.matchesSampled > 0
                  ? ` · ${intel.venue.matchesSampled} sampled matches`
                  : ""}
              </p>
              {intel.venue.weatherLabel ? <p>Weather: {intel.venue.weatherLabel}</p> : null}
              <StatGrid
                items={[
                  {
                    label: "Home win %",
                    value:
                      intel.venue.homeWinPct != null ? `${intel.venue.homeWinPct}%` : "—",
                  },
                  {
                    label: "Avg home score",
                    value: fmt(intel.venue.avgHomeScore),
                  },
                  {
                    label: "Avg away score",
                    value: fmt(intel.venue.avgAwayScore),
                  },
                  {
                    label: "Avg total points",
                    value: fmt(intel.venue.avgTotalPoints),
                  },
                  {
                    label: "Avg total tries",
                    value: fmt(intel.venue.avgTotalTries),
                  },
                ]}
              />
            </>
          ) : (
            <p className="pr-bi__muted">Venue not linked for this fixture yet.</p>
          )}
        </div>
      )}

      {sub === "coming" && (
        <div className="pr-bi-card">
          <h3>Odds &amp; Value Bets</h3>
          {intel.odds ? (
            <>
              <p>
                Best prices from {intel.odds.provider} · {intel.odds.bookmakerCount} bookmakers
                {intel.odds.scrapedAt
                  ? ` · scraped ${new Date(intel.odds.scrapedAt).toLocaleString("en-GB", { hour12: false })}`
                  : ""}
                {" · "}
                <a href={intel.odds.sourceUrl} target="_blank" rel="noreferrer">
                  Source
                </a>
              </p>
              <StatGrid
                items={[
                  {
                    label: `${intel.homeName} best`,
                    value:
                      intel.odds.bestHomeDecimal != null
                        ? String(intel.odds.bestHomeDecimal)
                        : "—",
                  },
                  {
                    label: "Draw best",
                    value:
                      intel.odds.bestDrawDecimal != null
                        ? String(intel.odds.bestDrawDecimal)
                        : "—",
                  },
                  {
                    label: `${intel.awayName} best`,
                    value:
                      intel.odds.bestAwayDecimal != null
                        ? String(intel.odds.bestAwayDecimal)
                        : "—",
                  },
                  {
                    label: "Market home %",
                    value:
                      intel.odds.impliedHomePct != null
                        ? `${intel.odds.impliedHomePct}%`
                        : "—",
                  },
                  {
                    label: "Market draw %",
                    value:
                      intel.odds.impliedDrawPct != null
                        ? `${intel.odds.impliedDrawPct}%`
                        : "—",
                  },
                  {
                    label: "Market away %",
                    value:
                      intel.odds.impliedAwayPct != null
                        ? `${intel.odds.impliedAwayPct}%`
                        : "—",
                  },
                ]}
              />
              {intel.valueBets.length > 0 ? (
                <div className="pr-bi-absences">
                  <h4>Value vs Planet Rugby</h4>
                  <ul className="pr-bi-value-list">
                    {intel.valueBets.map((v) => (
                      <li key={v.selection}>
                        <strong>{v.selection}</strong>
                        <span>
                          Ours {v.ourPct}% · Market {v.marketPct}% · Edge{" "}
                          {v.edgePct > 0 ? "+" : ""}
                          {v.edgePct}%
                        </span>
                        <span className={`pr-bi-value-tag pr-bi-value-tag--${v.label.toLowerCase()}`}>
                          {v.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="pr-bi__muted">
                No odds snapshot linked to this fixture yet. Import from{" "}
                <a href="/admin/odds/bmbets">/admin/odds/bmbets</a> (competition or match URL).
              </p>
              {intel.comingSoon.length > 0 ? (
                <ul className="pr-bi-coming">
                  {intel.comingSoon.map((c) => (
                    <li key={c.id}>
                      <strong>{c.title}</strong>
                      <span>{c.blurb}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
