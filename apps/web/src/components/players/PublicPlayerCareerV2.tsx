"use client";

import { useState } from "react";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import type { PublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import type {
  CareerSeasonRow,
  PublicPlayerCareerV2Dto,
} from "@/lib/public-player-career-v2-types";

const SECTIONS = [
  { id: "timeline", label: "Career Timeline" },
  { id: "club", label: "Club Career" },
  { id: "international", label: "International Career" },
  { id: "competitions", label: "Competitions" },
  { id: "honours", label: "Honours" },
  { id: "milestones", label: "Milestones" },
  { id: "awards", label: "Awards" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function dash(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-GB");
}

function dashPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0%";
  return `${value}%`;
}

function formatAsOf(iso: string | null): string {
  if (!iso) return "latest available feed data";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "latest available feed data";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function scrollTo(id: SectionId) {
  document.getElementById(`pcareer-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SeasonTable({
  rows,
  title,
  empty,
  showRates,
}: {
  rows: CareerSeasonRow[];
  title: string;
  empty: string;
  showRates?: boolean;
}) {
  return (
    <section className="pr-player-v2__card pr-pcareer__table-card">
      <div className="pr-player-v2__card-head">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="pr-player-v2__empty">{empty}</p>
      ) : (
        <div className="pr-player-v2__table-wrap">
          <table className="pr-player-v2__table pr-pcareer__table">
            <thead>
              <tr>
                <th scope="col">Season</th>
                <th scope="col">Club</th>
                <th scope="col">Competition</th>
                <th scope="col">M</th>
                <th scope="col">Mins</th>
                <th scope="col">Pts</th>
                <th scope="col">Tries</th>
                <th scope="col">Conv</th>
                <th scope="col">Pen</th>
                <th scope="col">DG</th>
                <th scope="col">TB</th>
                <th scope="col">CB</th>
                <th scope="col">Ast</th>
                {showRates ? (
                  <>
                    <th scope="col">Pass %</th>
                    <th scope="col">Kick %</th>
                    <th scope="col">Win %</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.seasonLabel}</td>
                  <td>{r.clubName}</td>
                  <td>{r.competitionName}</td>
                  <td>{r.matches}</td>
                  <td>{dash(r.minutes)}</td>
                  <td>{r.points}</td>
                  <td>{r.tries}</td>
                  <td>{r.conversions}</td>
                  <td>{r.penalties}</td>
                  <td>{r.dropGoals}</td>
                  <td>{dash(r.tackleBreaks)}</td>
                  <td>{dash(r.cleanBreaks)}</td>
                  <td>{dash(r.assists)}</td>
                  {showRates ? (
                    <>
                      <td>{dashPct(r.passPct)}</td>
                      <td>{dashPct(r.kickAccuracyPct)}</td>
                      <td>{dashPct(r.winPct)}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TimelineChart({ points }: { points: PublicPlayerCareerV2Dto["timeline"] }) {
  if (points.length === 0) {
    return <p className="pr-player-v2__empty">No timeline data yet.</p>;
  }
  const w = 520;
  const h = 200;
  const pad = { t: 16, r: 44, b: 28, l: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxM = Math.max(...points.map((p) => p.matches), 1);
  const maxP = Math.max(...points.map((p) => p.points), 1);
  const x = (i: number) =>
    pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yM = (v: number) => pad.t + innerH - (v / maxM) * innerH;
  const yP = (v: number) => pad.t + innerH - (v / maxP) * innerH;
  const path = (vals: number[], yFn: (v: number) => number) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yFn(v).toFixed(1)}`)
      .join(" ");

  return (
    <div className="pr-pcareer__chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Career matches and points by year">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={pad.l}
              x2={w - pad.r}
              y1={yy}
              y2={yy}
              stroke="rgba(255,255,255,0.06)"
            />
          );
        })}
        <path
          d={path(
            points.map((p) => p.matches),
            yM,
          )}
          fill="none"
          stroke="var(--pv2-green)"
          strokeWidth="2.5"
        />
        <path
          d={path(
            points.map((p) => p.points),
            yP,
          )}
          fill="none"
          stroke="var(--pv2-blue)"
          strokeWidth="2.5"
        />
        {points.map((p, i) => (
          <g key={p.year}>
            <circle cx={x(i)} cy={yM(p.matches)} r="3.5" fill="var(--pv2-green)" />
            <circle cx={x(i)} cy={yP(p.points)} r="3.5" fill="var(--pv2-blue)" />
            <text
              x={x(i)}
              y={h - 8}
              textAnchor="middle"
              fill="var(--pv2-muted)"
              fontSize="10"
              fontWeight="700"
            >
              {p.year}
            </text>
          </g>
        ))}
        <text x={pad.l - 8} y={pad.t + 4} textAnchor="end" fill="var(--pv2-green)" fontSize="9">
          {maxM}
        </text>
        <text x={w - pad.r + 8} y={pad.t + 4} textAnchor="start" fill="var(--pv2-blue)" fontSize="9">
          {maxP}
        </text>
      </svg>
      <div className="pr-pcareer__chart-legend">
        <span className="pr-pcareer__leg pr-pcareer__leg--green">Matches</span>
        <span className="pr-pcareer__leg pr-pcareer__leg--blue">Points</span>
      </div>
    </div>
  );
}

function PositionDonut({
  total,
  slices,
}: {
  total: number;
  slices: PublicPlayerCareerV2Dto["positions"]["slices"];
}) {
  if (total <= 0 || slices.length === 0) {
    return <p className="pr-player-v2__empty">No position labels on linked matches yet.</p>;
  }
  // Single position at ~100% — compact stat tile instead of a full donut.
  if (slices.length === 1 || (slices[0] && slices[0].percent >= 98)) {
    const only = slices[0]!;
    return (
      <div className="pr-pcareer__pos-single" aria-label={`${only.positionName}: ${only.appearances} appearances`}>
        <strong>{only.positionName}</strong>
        <span>
          {only.appearances} appearance{only.appearances === 1 ? "" : "s"}
          {only.percent < 100 ? ` (${only.percent}%)` : ""}
        </span>
      </div>
    );
  }
  let cursor = 0;
  const stops = slices.map((s) => {
    const start = cursor;
    cursor += s.percent;
    return `${s.color} ${start}% ${cursor}%`;
  });
  return (
    <div className="pr-pcareer__donut-wrap">
      <div
        className="pr-pcareer__donut"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
        aria-label={`${total} matches with known field positions`}
      >
        <div className="pr-pcareer__donut-inner">
          <strong>{total}</strong>
          <span>Matches</span>
        </div>
      </div>
      <ul className="pr-pcareer__donut-legend">
        {slices.map((s) => (
          <li key={s.positionName}>
            <span className="pr-pcareer__swatch" style={{ background: s.color }} />
            <span>
              {s.positionName}: {s.appearances} ({s.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicPlayerCareerV2({
  overview,
  career,
}: {
  overview: PublicPlayerOverviewV2;
  career: PublicPlayerCareerV2Dto;
}) {
  const [section, setSection] = useState<SectionId>("timeline");

  const onSection = (id: SectionId) => {
    setSection(id);
    scrollTo(id);
  };

  const metaBits = [
    career.meta.careerSpanLabel
      ? `Career Span: ${career.meta.careerSpanLabel}${career.meta.seasonCount != null ? ` (${career.meta.seasonCount} Seasons)` : ""}`
      : null,
    career.meta.clubCount != null
      ? `Clubs: ${career.meta.clubCount}${
          career.meta.clubNames.length
            ? ` (${career.meta.clubNames.join(", ")})`
            : ""
        }`
      : null,
    career.meta.internationalCaps != null
      ? `International Caps: ${career.meta.internationalCaps}${career.meta.internationalTeamName ? ` (${career.meta.internationalTeamName})` : ""}`
      : null,
  ].filter(Boolean);

  return (
    <article className="pr-player-v2 pr-pcareer">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Career" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="career" />

      <div className="pr-player-v2__hero-lead">
        <PlayerIdentityHero overview={overview} />
        <aside className="pr-pcareer__overview-panel" aria-label="Career overview">
          <div className="pr-pcareer__overview-head">
            <h2>Career Overview</h2>
          </div>
          <div className="pr-pcareer__kpi-grid">
            {career.totals.map((cell) => (
              <div
                key={cell.key}
                className={`pr-pcareer__kpi${cell.highlight ? " pr-pcareer__kpi--hi" : ""}`}
              >
                <span>{cell.label}</span>
                <strong>{dash(cell.value)}</strong>
              </div>
            ))}
          </div>
          {metaBits.length ? (
            <p className="pr-pcareer__meta-line">{metaBits.join(" · ")}</p>
          ) : null}
        </aside>
      </div>

      <nav className="pr-pcareer__tabs" aria-label="Career sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "is-active" : undefined}
            onClick={() => onSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pr-player-v2__grid pr-pcareer__body">
        <div className="pr-pcareer__row pr-pcareer__row--timeline" id="pcareer-timeline">
          <section className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Career Timeline</h2>
            </div>
            <TimelineChart points={career.timeline} />
          </section>

          <section className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Career Highs</h2>
            </div>
            <dl className="pr-pcareer__highs">
              {career.highs.summary.map((s) => (
                <div key={s.key}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
            {career.highs.matchHighs.length || career.highs.longestPointsStreak != null ? (
              <div className="pr-pcareer__match-highs">
                <h3>Most in a Match</h3>
                <ul>
                  {career.highs.matchHighs.map((h) => (
                    <li key={h.key}>
                      <strong>{h.value}</strong> {h.label.replace(/^Most /, "")} · {h.detail}
                    </li>
                  ))}
                  {career.highs.longestPointsStreak != null ? (
                    <li>
                      <strong>{career.highs.longestPointsStreak}</strong> Longest Points Streak
                      (matches)
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="pr-pcareer__row pr-pcareer__row--club" id="pcareer-club">
          <SeasonTable
            rows={career.clubSeasonRows}
            title="Club Career"
            empty="No club match data linked yet."
          />
          <section className="pr-player-v2__card" id="pcareer-competitions">
            <div className="pr-player-v2__card-head">
              <h2>Points by Competition</h2>
            </div>
            {career.pointsByCompetition.length === 0 ? (
              <p className="pr-player-v2__empty">No points recorded yet.</p>
            ) : (
              <ul className="pr-pcareer__bars">
                {career.pointsByCompetition.map((c) => (
                  <li key={c.key}>
                    <div className="pr-pcareer__bar-label">
                      <span>{c.label}</span>
                      <strong>{c.points}</strong>
                    </div>
                    <div className="pr-pcareer__bar-track">
                      <div
                        className="pr-pcareer__bar-fill"
                        style={{ width: `${Math.max(c.percent, c.points > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="pr-pcareer__row pr-pcareer__row--intl" id="pcareer-international">
          <SeasonTable
            rows={career.internationalSeasonRows}
            title="International Career"
            empty="No international match data linked yet."
          />
          <section className="pr-player-v2__card" id="pcareer-milestones">
            <div className="pr-player-v2__card-head">
              <h2>Career Milestones</h2>
            </div>
            {career.milestones.length === 0 ? (
              <p className="pr-player-v2__empty">No milestones derived yet.</p>
            ) : (
              <ol className="pr-pcareer__milestones">
                {career.milestones.map((m) => (
                  <li key={m.id}>
                    <span className="pr-pcareer__milestone-year">{m.year ?? "—"}</span>
                    <div>
                      <strong>{m.title}</strong>
                      {m.detail ? <span>{m.detail}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="pr-player-v2__card" id="pcareer-awards">
            <div className="pr-player-v2__card-head" id="pcareer-honours">
              <h2>Awards &amp; Recognition</h2>
            </div>
            {career.awards.length === 0 ? (
              <p className="pr-player-v2__empty">No awards recorded yet.</p>
            ) : (
              <ul className="pr-pcareer__awards">
                {career.awards.map((a) => (
                  <li key={a.id}>
                    <span className="pr-pcareer__award-icon" aria-hidden>
                      ★
                    </span>
                    <div>
                      <strong>
                        {a.year != null ? `${a.year}: ` : ""}
                        {a.title}
                      </strong>
                      {a.detail ? <span>{a.detail}</span> : null}
                      {a.verificationStatus !== "verified" ? (
                        <em className="pr-pcareer__award-note">{a.verificationStatus}</em>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="pr-pcareer__row pr-pcareer__row--season">
          <SeasonTable
            rows={career.allSeasonRows}
            title="Season by Season Breakdown"
            empty="No season breakdown available."
            showRates
          />
          <section className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Appearances by Position</h2>
            </div>
            <PositionDonut total={career.positions.total} slices={career.positions.slices} />
          </section>
        </div>

        <footer className="pr-pcareer__footer" aria-label="Career summary">
          {career.footer.map((f) => (
            <div key={f.key} className="pr-pcareer__footer-item">
              <span>{f.label}</span>
              <strong>{f.value}</strong>
            </div>
          ))}
          <p className="pr-pcareer__asof">Data accurate as of {formatAsOf(career.dataAsOfIso)}</p>
        </footer>
      </div>
    </article>
  );
}
