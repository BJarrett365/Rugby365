"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";
import { DonutChart } from "./DonutChart";
import { LineChart } from "./LineChart";
import { MatchTable } from "./MatchTable";
import { ProfileHeader } from "./ProfileHeader";
import { ProgressBar } from "./ProgressBar";
import { RadarChart } from "./RadarChart";
import type { RefereeDashboardModel } from "@/lib/referee-dashboard-types";

const TABS = ["Overview", "Matches", "Stats", "Rankings", "Disciplinary", "News"] as const;
type Tab = (typeof TABS)[number];

const STAT_ICONS: Record<string, ReactNode> = {
  matches: iconPath("M7 4h10v3H7zm-2 5h14v11H5z"),
  internationals: iconPath(
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c.7 2.4 1 5 1 8s-.3 5.6-1 8c-.7-2.4-1-5-1-8s.3-5.6 1-8z",
  ),
  tests: iconPath("M12 2 4 6v12l8 4 8-4V6l-8-4z"),
  tournaments: iconPath("M7 3h10v3h3v4c0 3.3-2.7 6-6 6h-1v3h3v2H8v-2h3v-3H10c-3.3 0-6-2.7-6-6V6h3V3z"),
  ycAvg: iconPath("M8 3h8v18H8z"),
  rcAvg: iconPath("M8 3h8v18H8z"),
  penAvg: iconPath("M12 2 3 7v10l9 5 9-5V7z"),
  scrumPenAvg: iconPath("M4 8h16v3H4zm0 5h16v3H4zm0 5h16v3H4z"),
  lineoutPenAvg: iconPath("M5 3h2v18H5zm12 0h2v18h-2zM9 7h6v3H9zm0 7h6v3H9z"),
  advAvg: iconPath("M4 12h9V8l7 4-7 4v-4H4z"),
  tmoAvg: iconPath("M3 6h18v12H3zm8 3v6l5-3-5-3z"),
  accuracy: iconPath("M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"),
};

const SEASON_ICONS: Record<string, ReactNode> = {
  matches: STAT_ICONS.matches,
  avg: STAT_ICONS.accuracy,
  tests: STAT_ICONS.tests,
  yc: STAT_ICONS.ycAvg,
  pen: STAT_ICONS.penAvg,
  tmo: STAT_ICONS.tmoAvg,
};

function iconPath(d: string) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path fill="currentColor" d={d} />
    </svg>
  );
}

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="rdash-icon-btn__glyph" aria-hidden>
      {children}
    </span>
  );
}

export function RefereeDashboard({ model }: { model: RefereeDashboardModel }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => (tab === "Matches" ? model.recentMatches : model.recentMatches.slice(0, 6)),
    [model.recentMatches, tab],
  );
  const searchHit = query.trim()
    ? model.name.toLowerCase().includes(query.trim().toLowerCase())
    : null;

  useEffect(() => {
    if (!searchOpen && !compareOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setCompareOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, compareOpen]);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: model.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote("Share cancelled");
    }
  }

  return (
    <div className="rdash">
      <header className="rdash-topbar">
        <a className="rdash-wordmark" href="/matches">
          Officials
        </a>
        <nav className="rdash-nav" aria-label="Referee sections">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? "is-active" : undefined}
              aria-current={tab === item ? "page" : undefined}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="rdash-actions">
          <button
            type="button"
            className="rdash-icon-btn"
            aria-label="Search officials"
            onClick={() => setSearchOpen(true)}
          >
            <ActionIcon>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0C7 14 5 12 5 9.5S7 5 9.5 5 14 7 14 9.5 12 14 9.5 14z"
                />
              </svg>
            </ActionIcon>
          </button>
          <button
            type="button"
            className="rdash-icon-btn"
            aria-label="Compare with elite average"
            onClick={() => setCompareOpen(true)}
          >
            <ActionIcon>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M5 4h4v16H5zm5 6h4v10h-4zm5-4h4v14h-4z" />
              </svg>
            </ActionIcon>
          </button>
          <button type="button" className="rdash-icon-btn" aria-label="Share profile" onClick={() => void onShare()}>
            <ActionIcon>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M18 16.1a2.9 2.9 0 0 0-2.1.9l-7.2-3.6a3 3 0 0 0 0-1.8l7.2-3.6A3 3 0 1 0 15 6a3 3 0 0 0 .1.7L8 10.3a3 3 0 1 0 0 3.4l7.1 3.6A3 3 0 1 0 18 16.1z"
                />
              </svg>
            </ActionIcon>
          </button>
        </div>
      </header>
      {shareNote ? (
        <p className="rdash-toast" role="status">
          {shareNote}
        </p>
      ) : null}
      {model.isMockAnalytics ? (
        <p className="rdash-banner">
          Career analytics on this page are sample model values until match-official feeds are connected.
        </p>
      ) : null}

      <ProfileHeader model={model} />

      {tab === "News" ? (
        <DashboardCard title="News" status="empty">
          <p />
        </DashboardCard>
      ) : null}

      {tab === "Overview" || tab === "Stats" || tab === "Rankings" ? (
        <div className="rdash-grid rdash-grid--3">
          <DashboardCard title="Performance overview" status={model.sectionStatus.radar}>
            <RadarChart data={model.radar} overallRating={model.overallRating} />
          </DashboardCard>
          <DashboardCard title="Key statistics" kicker="Career" status={model.sectionStatus.career}>
            <ul className="rdash-stat-list">
              {model.careerStats.map((row) => (
                <li key={row.key} data-stat={row.key}>
                  <span>
                    <span className="rdash-stat-list__icon" aria-hidden>
                      {STAT_ICONS[row.key] ?? STAT_ICONS.matches}
                    </span>
                    {row.label}
                  </span>
                  <strong>
                    {row.value}
                    {row.hint ? <small> {row.hint}</small> : null}
                  </strong>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard title="Disciplinary record" status={model.sectionStatus.disciplinary}>
            <DonutChart data={model.disciplinary} />
            <div className="rdash-totals">
              {model.disciplinary.map((row) => (
                <p key={row.key} className={`rdash-total rdash-total--${row.key}`}>
                  <span>{row.label}</span>
                  <strong>{row.careerTotal}</strong>
                </p>
              ))}
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {tab === "Overview" || tab === "Rankings" ? (
        <div className="rdash-grid rdash-grid--3">
          <DashboardCard title="Rating over time" kicker="24 months" status={model.sectionStatus.ratingTrend}>
            <LineChart data={model.ratingHistory} />
          </DashboardCard>
          <DashboardCard title="Strengths & areas to develop" status={model.sectionStatus.insights}>
            <div className="rdash-split">
              <div>
                <h3>Strengths</h3>
                <ul className="rdash-insights is-good">
                  {model.strengths.map((row) => (
                    <li key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Areas to develop</h3>
                <ul className="rdash-insights is-amber">
                  {model.developmentAreas.map((row) => (
                    <li key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DashboardCard>
          <DashboardCard title="Match type breakdown" status={model.sectionStatus.breakdown}>
            <div className="rdash-bars">
              {model.matchTypeBreakdown.map((row) => (
                <ProgressBar
                  key={row.competition}
                  label={row.competition}
                  meta={`${row.matches} matches`}
                  value={row.avgRating}
                />
              ))}
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {tab === "Overview" || tab === "Matches" ? (
        <div className="rdash-grid rdash-grid--bottom">
          <DashboardCard title="Recent matches" status={model.sectionStatus.matches}>
            <MatchTable
              rows={matches}
              onViewAll={tab === "Matches" ? undefined : () => setTab("Matches")}
            />
          </DashboardCard>
          <DashboardCard title="Season summary" kicker={model.seasonLabel} status={model.sectionStatus.season}>
            <ul className="rdash-season">
              {model.seasonSummary.map((row) => (
                <li key={row.key}>
                  <span className="rdash-season__icon" aria-hidden>
                    {SEASON_ICONS[row.key] ?? STAT_ICONS.matches}
                  </span>
                  <span>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard title="Next appointment" status={model.sectionStatus.next}>
            {model.nextAppointment ? (
              <div className="rdash-next">
                <p className="rdash-next__comp">{model.nextAppointment.competition}</p>
                <div className="rdash-next__teams">
                  <span>
                    {model.nextAppointment.homeCrestUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={model.nextAppointment.homeCrestUrl} alt="" />
                    ) : (
                      <span className="rdash-crest-fallback">{model.nextAppointment.homeTeam.slice(0, 3)}</span>
                    )}
                    {model.nextAppointment.homeTeam}
                  </span>
                  <em>VS</em>
                  <span>
                    {model.nextAppointment.awayCrestUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={model.nextAppointment.awayCrestUrl} alt="" />
                    ) : (
                      <span className="rdash-crest-fallback">{model.nextAppointment.awayTeam.slice(0, 3)}</span>
                    )}
                    {model.nextAppointment.awayTeam}
                  </span>
                </div>
                <p>{model.nextAppointment.kickoffLabel}</p>
                <p>{model.nextAppointment.venue}</p>
              </div>
            ) : null}
          </DashboardCard>
        </div>
      ) : null}

      {tab === "Disciplinary" ? (
        <div className="rdash-grid rdash-grid--3">
          <DashboardCard title="Disciplinary record" status={model.sectionStatus.disciplinary}>
            <DonutChart data={model.disciplinary} />
          </DashboardCard>
          <DashboardCard className="rdash-span-2" title="Career totals">
            <div className="rdash-totals">
              {model.disciplinary.map((row) => (
                <p key={row.key} className={`rdash-total rdash-total--${row.key}`}>
                  <span>{row.label}</span>
                  <strong>{row.careerTotal}</strong>
                  <em>{row.perMatch.toFixed(2)} / match</em>
                </p>
              ))}
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {tab === "Overview" || tab === "Matches" ? (
        <DashboardCard title="Career highlights">
          <ul className="rdash-highlights">
            {model.highlights.map((row) => (
              <li key={row.label}>
                <span className="rdash-highlights__icon" aria-hidden>
                  {STAT_ICONS.tournaments}
                </span>
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </li>
            ))}
          </ul>
          <div className="rdash-about">
            <h3>About</h3>
            <p>{model.about}</p>
          </div>
        </DashboardCard>
      ) : null}

      {searchOpen ? (
        <div
          className="rdash-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rdash-search-title"
          onClick={() => setSearchOpen(false)}
        >
          <div className="rdash-modal__card" onClick={(e) => e.stopPropagation()}>
            <h2 id="rdash-search-title">Search officials</h2>
            <label className="rdash-sr-only" htmlFor="rdash-search-input">
              Official name
            </label>
            <input
              id="rdash-search-input"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a referee name"
            />
            <p className="rdash-state">
              {searchHit === true
                ? `Showing ${model.name}.`
                : searchHit === false
                  ? "No other official profiles in this preview."
                  : "This preview only includes the current official."}
            </p>
            <button type="button" className="rdash-link-btn" onClick={() => setSearchOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {compareOpen ? (
        <div
          className="rdash-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rdash-compare-title"
          onClick={() => setCompareOpen(false)}
        >
          <div className="rdash-modal__card" onClick={(e) => e.stopPropagation()}>
            <h2 id="rdash-compare-title">Compare vs elite average</h2>
            <table className="rdash-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="is-num">{model.name}</th>
                  <th className="is-num">Elite avg</th>
                </tr>
              </thead>
              <tbody>
                {model.radar.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td className="is-num">{row.referee}</td>
                    <td>{row.eliteAverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="rdash-link-btn" onClick={() => setCompareOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
