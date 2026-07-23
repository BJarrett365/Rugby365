"use client";

import { useMemo, useState } from "react";
import {
  buildCompetitionSlots,
  parseSdmsHeadToHeadRecords,
  type HeadToHeadCompetitionRecord,
} from "@/lib/head-to-head-shared";
import { TeamCrest } from "./TeamCrest";

function H2HBar({
  label,
  home,
  away,
}: {
  label: string;
  home: number;
  away: number;
}) {
  const total = home + away || 1;
  const homePct = Math.round((home / total) * 100);
  return (
    <div className="pr-h2h-bar">
      <div className="pr-h2h-bar__values">
        <span>{Number.isInteger(home) ? home : home.toFixed(1)}</span>
        <span className="pr-h2h-bar__label">{label}</span>
        <span>{Number.isInteger(away) ? away : away.toFixed(1)}</span>
      </div>
      <div className="pr-h2h-bar__track" aria-hidden>
        <span className="pr-h2h-bar__home" style={{ width: `${homePct}%` }} />
        <span className="pr-h2h-bar__away" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

function meetingScore(row: Record<string, unknown>): string {
  const hs = row.home_score ?? row.home_team_score ?? row.score_home;
  const as = row.away_score ?? row.away_team_score ?? row.score_away;
  if (hs == null || as == null) return "—";
  return `${hs} – ${as}`;
}

function formatMeetingDate(raw: string): string {
  if (!raw) return "Previous meeting";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MatchHeadToHeadPublic({
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  headToHead,
  lastFiveMeetings,
  competitionName,
}: {
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  headToHead: Record<string, unknown>[];
  lastFiveMeetings: Record<string, unknown>[];
  competitionName: string;
}) {
  const slots = useMemo(
    () => buildCompetitionSlots(parseSdmsHeadToHeadRecords(headToHead)),
    [headToHead],
  );

  const available = slots.filter((s) => s.hasData);
  const [active, setActive] = useState<string>(() => available[0]?.competitionName ?? competitionName);

  const record: HeadToHeadCompetitionRecord | undefined =
    available.find((s) => s.competitionName === active) ??
    available[0] ??
    parseSdmsHeadToHeadRecords(headToHead)[0];

  if (!record && lastFiveMeetings.length === 0) {
    return <p className="match-detail-empty">Head-to-head data is not available for this match yet.</p>;
  }

  return (
    <div className="pr-h2h">
      {available.length > 0 && (
        <div className="pr-h2h__tabs" role="tablist" aria-label="Competition">
          {available.map((slot) => (
            <button
              key={slot.competitionName}
              type="button"
              role="tab"
              aria-selected={active === slot.competitionName}
              className={`pr-h2h__tab${active === slot.competitionName ? " pr-h2h__tab--active" : ""}`}
              onClick={() => setActive(slot.competitionName)}
            >
              {slot.competitionName}
            </button>
          ))}
        </div>
      )}

      {record && (
        <section className="pr-mc-card pr-h2h__stats">
          <header className="pr-compare-card__header">
            <TeamCrest name={homeName} imageUrl={homeImageUrl} size="sm" />
            <h2 className="pr-mc-card__title" style={{ background: "transparent", border: 0, padding: 0 }}>
              Head-to-Head
            </h2>
            <TeamCrest name={awayName} imageUrl={awayImageUrl} size="sm" />
          </header>
          <div className="pr-h2h__bars">
            <H2HBar label="Wins" home={record.homeWins} away={record.awayWins} />
            {record.homeAvgCarries != null && record.awayAvgCarries != null && (
              <H2HBar label="Average Carries" home={record.homeAvgCarries} away={record.awayAvgCarries} />
            )}
            {record.homeAvgTackles != null && record.awayAvgTackles != null && (
              <H2HBar label="Average Tackles" home={record.homeAvgTackles} away={record.awayAvgTackles} />
            )}
            {record.homeAvgTries != null && record.awayAvgTries != null && (
              <H2HBar label="Average Tries" home={record.homeAvgTries} away={record.awayAvgTries} />
            )}
          </div>
          <p className="pr-h2h__note">Data from 2011</p>
        </section>
      )}

      <section className="pr-mc-card">
        <h2 className="pr-mc-card__title">Previous Meetings</h2>
        {lastFiveMeetings.length === 0 ? (
          <p className="match-detail-empty" style={{ padding: "0 1rem 0.25rem" }}>
            No previous meetings are available yet.
          </p>
        ) : (
          <ul className="pr-h2h-meetings">
            {lastFiveMeetings.map((row, i) => {
              const date = String(row.date ?? row.match_date ?? row.kickoff ?? "");
              const comp = String(row.competition_name ?? row.competition ?? competitionName);
              const home = String(row.home_team_name ?? row.home_team ?? homeName);
              const away = String(row.away_team_name ?? row.away_team ?? awayName);
              const matchId = String(row.match_id ?? row.id ?? i);
              return (
                <li key={`${matchId}-${i}`} className="pr-h2h-meetings__item">
                  <div className="pr-h2h-meetings__meta">
                    <span>{formatMeetingDate(date)}</span>
                    <span className="pr-h2h-meetings__comp">{comp}</span>
                  </div>
                  <div className="pr-h2h-meetings__scoreline">
                    <span className="pr-h2h-meetings__team">
                      <TeamCrest name={home} size="sm" />
                      {home}
                    </span>
                    <strong>{meetingScore(row)}</strong>
                    <span className="pr-h2h-meetings__team pr-h2h-meetings__team--away">
                      {away}
                      <TeamCrest name={away} size="sm" />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
