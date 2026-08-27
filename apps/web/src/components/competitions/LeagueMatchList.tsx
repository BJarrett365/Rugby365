"use client";

import Link from "next/link";
import { useMemo } from "react";

export type LeagueMatchRow = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  round: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  venueName: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function teamInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const rest = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${weekday} ${day}${suffix} ${rest}`;
}

function formatKickoffTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string, showScores: boolean) {
  if (showScores) return status === "live" ? "Live" : "Result";
  if (status === "live") return "Live";
  if (status === "postponed") return "Postponed";
  return "Fixture";
}

const UNDATED_KEY = "undated";

function groupByDate(rows: LeagueMatchRow[], newestFirst: boolean) {
  const groups = new Map<string, LeagueMatchRow[]>();
  for (const row of rows) {
    // Historic Wikipedia imports often lack kickoff — still show them as results.
    const key = row.kickoffAt?.slice(0, 10) ?? UNDATED_KEY;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const entries = [...groups.entries()].sort((a, b) => {
    if (a[0] === UNDATED_KEY) return 1;
    if (b[0] === UNDATED_KEY) return -1;
    return newestFirst ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]);
  });
  return entries.map(([date, matches]) => ({
    date,
    matches: matches.sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? "")),
  }));
}

type SeasonOption = { id: string; label: string };

export function LeagueScheduleToolbar({
  seasons,
  seasonLabel,
  onSeasonChange,
  rows,
  monthIndex,
  onMonthChange,
}: {
  seasons: SeasonOption[];
  seasonLabel: string;
  onSeasonChange: (label: string) => void;
  rows: LeagueMatchRow[];
  monthIndex: number | null;
  onMonthChange: (index: number | null) => void;
}) {
  const monthsWithMatches = useMemo(() => {
    const set = new Set<number>();
    for (const row of rows) {
      if (!row.kickoffAt) continue;
      set.add(new Date(row.kickoffAt).getMonth());
    }
    return set;
  }, [rows]);

  return (
    <div className="league-schedule-toolbar">
      <div className="league-month-strip" role="group" aria-label="Filter by month">
        <button
          type="button"
          className={`league-month-pill ${monthIndex === null ? "league-month-pill--active" : ""}`}
          onClick={() => onMonthChange(null)}
        >
          All
        </button>
        {MONTHS.map((label, index) => {
          const hasMatches = monthsWithMatches.has(index);
          return (
            <button
              key={label}
              type="button"
              disabled={!hasMatches}
              className={`league-month-pill ${
                monthIndex === index ? "league-month-pill--active" : ""
              } ${!hasMatches ? "league-month-pill--muted" : ""}`}
              onClick={() => onMonthChange(index)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {seasons.length > 0 && (
        <select
          className="league-season-select cms-select"
          value={seasonLabel}
          onChange={(e) => onSeasonChange(e.target.value)}
          aria-label="Season"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.label}>
              {"displayLabel" in s && typeof s.displayLabel === "string" && s.displayLabel
                ? s.displayLabel
                : s.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function LeagueMatchList({
  rows,
  showScores,
  newestFirst = true,
  monthIndex = null,
}: {
  rows: LeagueMatchRow[];
  showScores: boolean;
  newestFirst?: boolean;
  monthIndex?: number | null;
}) {
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      // Undated historic results only appear in the "All" month filter.
      if (!row.kickoffAt) return monthIndex === null;
      if (monthIndex === null) return true;
      return new Date(row.kickoffAt).getMonth() === monthIndex;
    });
  }, [rows, monthIndex]);

  const grouped = useMemo(() => groupByDate(filtered, newestFirst), [filtered, newestFirst]);

  if (!grouped.length) {
    return (
      <p className="text-sm text-zinc-500 m-0 py-8 text-center">
        No matches for this period. Try another month or season, or import from Planet Rugby in CMS.
      </p>
    );
  }

  return (
    <div className="league-match-list space-y-4">
      {grouped.map(({ date, matches }) => (
        <section key={date} className="league-date-card">
          <header className="league-date-card__header">
            {date === UNDATED_KEY ? "Undated results" : formatDateHeader(date)}
          </header>
          <div className="league-date-card__body">
            {matches.map((m) => (
              <article key={m.id} className="league-match-row">
                <div className="league-match-row__meta">
                  <span className="league-match-row__round">{m.round ?? "—"}</span>
                  <span className="league-match-row__venue">{m.venueName ?? "—"}</span>
                </div>

                <div className="league-match-row__centre">
                  <span className="league-match-row__status">{statusLabel(m.status, showScores)}</span>
                  <div className="league-match-row__teams">
                    <div className="league-match-team">
                      <span className="league-match-team__badge" aria-hidden>
                        {teamInitials(m.homeTeam)}
                      </span>
                      <span className="league-match-team__name">{m.homeTeam ?? "TBC"}</span>
                      {showScores && (m.status === "full_time" || m.status === "live") && (
                        <span className="league-match-team__score">{m.homeScore}</span>
                      )}
                    </div>
                    <div className="league-match-team">
                      <span className="league-match-team__badge" aria-hidden>
                        {teamInitials(m.awayTeam)}
                      </span>
                      <span className="league-match-team__name">{m.awayTeam ?? "TBC"}</span>
                      {showScores && (m.status === "full_time" || m.status === "live") && (
                        <span className="league-match-team__score">{m.awayScore}</span>
                      )}
                    </div>
                  </div>
                  {!showScores && m.kickoffAt && (
                    <span className="league-match-row__kickoff">{formatKickoffTime(m.kickoffAt)}</span>
                  )}
                </div>

                <div className="league-match-row__action">
                  {m.slug ? (
                    <Link href={`/matches/${m.slug}/commentary`} className="league-match-info-btn">
                      Match Info
                    </Link>
                  ) : (
                    <span className="league-match-info-btn league-match-info-btn--disabled">Match Info</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
