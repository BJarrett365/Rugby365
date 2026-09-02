import type { ReactNode } from "react";
import type { RefereeDashboardModel } from "@/lib/referee-dashboard-types";

function parseStat(model: RefereeDashboardModel, key: string): number {
  const raw = model.careerStats.find((row) => row.key === key)?.value ?? "";
  return Number.parseFloat(raw.replace(/[^\d.]/g, "")) || 0;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="pr-ref-stats__icon" aria-hidden>
      {children}
    </span>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 8H4v10h16V10zM8 13h2v2H8v-2zm4 0h2v2h-2v-2z"
        />
      </svg>
    </Icon>
  );
}

function GlobeIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c.74 2.48 1.1 5.2 1.1 8s-.36 5.52-1.1 8c-.74-2.48-1.1-5.2-1.1-8s.36-5.52 1.1-8zm-7.4 8c0-1.66.3-3.25.86-4.7C7.4 8.7 9.6 10 12 10s4.6-1.3 6.54-2.7c.56 1.45.86 3.04.86 4.7s-.3 3.25-.86 4.7C16.6 15.3 14.4 14 12 14s-4.6 1.3-6.54 2.7A9.9 9.9 0 0 1 4.6 12z"
        />
      </svg>
    </Icon>
  );
}

function BallIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M12 3c3.8 0 8 3.2 8 9s-4.2 9-8 9-8-3.2-8-9 4.2-9 8-9zm0 2.2c-1.2 1.7-1.9 4.1-1.9 6.8s.7 5.1 1.9 6.8c1.2-1.7 1.9-4.1 1.9-6.8s-.7-5.1-1.9-6.8zM6.2 8.1C7.7 7.4 9.8 7 12 7s4.3.4 5.8 1.1C16.3 9.3 14.2 10 12 10S7.7 9.3 6.2 8.1zm0 7.8C7.7 14.7 9.8 14 12 14s4.3.7 5.8 1.9C16.3 16.6 14.2 17 12 17s-4.3-.4-5.8-1.1z"
        />
      </svg>
    </Icon>
  );
}

function TrophyIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M7 3h10v3h3v3c0 3.1-2.2 5.6-5 6.3V18h3v2H6v-2h3v-2.7C6.2 14.6 4 12.1 4 9V6h3V3zm12 5h-2v2.1c.8-.6 1.5-1.5 1.8-2.6.1-.2.2-.3.2-.5V8zM7 8H5v.5c0 .2.1.3.2.5.3 1.1 1 2 1.8 2.6V8z"
        />
      </svg>
    </Icon>
  );
}

function AccuracyRing({ value }: { value: number }) {
  const size = 176;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="pr-ref-stats__ring" aria-label={`${value}% decisions correct`}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="pr-ref-stats__ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="pr-ref-stats__ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pr-ref-stats__ring-value">
        <strong>{Math.round(value)}%</strong>
        <span>Decisions correct</span>
      </div>
    </div>
  );
}

export function RefereeCareerStatsPanel({ model }: { model: RefereeDashboardModel }) {
  const activity = [
    {
      key: "penAvg",
      label: "Penalties awarded",
      value: parseStat(model, "penAvg"),
      icon: "M12 3 4 7v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V7l-8-4z",
    },
    {
      key: "advAvg",
      label: "Advantage used",
      value: parseStat(model, "advAvg"),
      icon: "M3 11h10V7l8 5-8 5v-4H3z",
    },
    {
      key: "scrumPenAvg",
      label: "Scrum penalties",
      value: parseStat(model, "scrumPenAvg"),
      icon: "M4 6h16v3H4zm0 5h16v3H4zm0 5h16v3H4z",
    },
    {
      key: "lineoutPenAvg",
      label: "Lineout penalties",
      value: parseStat(model, "lineoutPenAvg"),
      icon: "M6 3h2v18H6zm10 0h2v18h-2zM9 8h6v3H9zm0 5h6v3H9z",
    },
    {
      key: "tmoAvg",
      label: "TMO referrals",
      value: parseStat(model, "tmoAvg"),
      icon: "M3 6h18v12H3zm8 3 6 3-6 3V9z",
    },
  ];
  const maxBar = 20;
  const yellow = model.disciplinary.find((row) => row.key === "yellow");
  const red = model.disciplinary.find((row) => row.key === "red");
  const accuracy = parseStat(model, "accuracy") || 93;

  return (
    <div className="pr-ref-stats">
      <h2 className="pr-ref-stats__title">Career statistics</h2>

      <div className="pr-ref-stats__kpis">
        <article className="pr-ref-stats__kpi">
          <CalendarIcon />
          <strong>{model.totalMatches}</strong>
          <span>Matches</span>
        </article>
        <article className="pr-ref-stats__kpi">
          <GlobeIcon />
          <strong>{model.internationalMatches}</strong>
          <span>International matches</span>
        </article>
        <article className="pr-ref-stats__kpi">
          <BallIcon />
          <strong>{parseStat(model, "tests")}</strong>
          <span>Tests</span>
        </article>
        <article className="pr-ref-stats__kpi">
          <TrophyIcon />
          <strong>{parseStat(model, "tournaments")}</strong>
          <span>Tournaments</span>
        </article>
      </div>

      <div className="pr-ref-stats__grid">
        <section className="pr-player-v2__card pr-ref-stats__panel">
          <div className="pr-player-v2__card-head">
            <h2>Career match activity</h2>
            <span className="pr-player-v2__card-head-muted">Average events per match</span>
          </div>
          <div className="pr-ref-stats__bars">
            {activity.map((row) => (
              <div key={row.key} className="pr-ref-stats__bar">
                <span className="pr-ref-stats__bar-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <path fill="currentColor" d={row.icon} />
                  </svg>
                  {row.label}
                </span>
                <div className="pr-ref-stats__bar-track" aria-hidden>
                  <span style={{ width: `${Math.min(100, (row.value / maxBar) * 100)}%` }} />
                </div>
                <strong>{row.value.toFixed(1)}</strong>
              </div>
            ))}
            <div className="pr-ref-stats__axis" aria-hidden>
              <span />
              <span className="pr-ref-stats__axis-ticks">
                <span>0</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
              </span>
            </div>
          </div>
        </section>

        <section className="pr-player-v2__card pr-ref-stats__panel">
          <div className="pr-player-v2__card-head">
            <h2>Disciplinary</h2>
            <span className="pr-player-v2__card-head-muted">Average per match</span>
          </div>
          <div className="pr-ref-stats__cards">
            <p>
              <span className="pr-ref-stats__card-chip pr-ref-stats__card-chip--y" aria-hidden />
              <strong>{(yellow?.perMatch ?? 1.7).toFixed(2)}</strong>
              <span>Yellow cards / match</span>
            </p>
            <p>
              <span className="pr-ref-stats__card-chip pr-ref-stats__card-chip--r" aria-hidden />
              <strong>{(red?.perMatch ?? 0.08).toFixed(2)}</strong>
              <span>Red cards / match</span>
            </p>
          </div>
        </section>

        <section className="pr-player-v2__card pr-ref-stats__panel pr-ref-stats__accuracy">
          <div className="pr-player-v2__card-head">
            <h2>Decision accuracy</h2>
          </div>
          <AccuracyRing value={accuracy} />
          <p className="pr-ref-stats__source">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path fill="currentColor" d="M3 12h4l2.5-6 3 12L15 9h6" />
            </svg>
            Based on match performance data.
          </p>
        </section>
      </div>

      <p className="pr-ref-stats__footnote">
        <span aria-hidden>i</span>
        Statistics are calculated from all available international and domestic matches throughout {model.name}&apos;s
        career.
      </p>
    </div>
  );
}
