"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { overviewRoleLabel, overviewTeamName, COACH_NATION_NAME } from "@/lib/coach-career-visibility";
import { CareerTimelineBadge, careerBadgeKindFromTimeline } from "./CareerTimelineBadge";
import { HonourTrophyIcon } from "@/components/honours/HonourIcons";

type Filter = "all" | "international" | "club" | "other";

const NATION_NAME = COACH_NATION_NAME;

function yearsFor(a: { startDate: string | null; endDate: string | null; isCurrent: boolean }): string {
  const start = a.startDate?.slice(0, 4);
  const end = a.endDate?.slice(0, 4);
  if (start && a.isCurrent) return `${start}–present`;
  if (start && end && start === end) return start;
  if (start && end) return `${start}–${end}`;
  return start || "—";
}

function bucket(a: { teamName: string; careerType: string; role: string }): Filter {
  const team = a.teamName.toLowerCase();
  if (NATION_NAME.test(team)) return "international";
  if (a.careerType === "technical" || /consultant|analyst/.test(`${a.careerType} ${a.role}`.toLowerCase())) {
    return "other";
  }
  return "club";
}

export function CoachHistoryBoard({ profile }: { profile: PublicCoachProfile }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => {
    const list = [...profile.assignments].sort((a, b) => {
      const start = (a.startDate ?? "").localeCompare(b.startDate ?? "");
      if (start !== 0) return start;
      return (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999");
    });
    if (filter === "all") return list;
    return list.filter((a) => bucket(a) === filter);
  }, [profile.assignments, filter]);

  const startYear =
    profile.coachingCareerStartYear ??
    profile.assignments
      .map((a) => Number(a.startDate?.slice(0, 4)))
      .filter((y) => Number.isFinite(y) && y > 0)
      .sort((a, b) => a - b)[0] ??
    null;
  const yearsCoaching = startYear != null ? Math.max(1, new Date().getFullYear() - startYear) : 0;
  const teamCount = new Set(profile.assignments.map((a) => a.teamId)).size;
  const countries = new Set(
    profile.assignments
      .map((a) =>
        overviewTeamName({ teamDisplayName: a.teamDisplayName, teamName: a.teamName, bioSummary: a.bioSummary }),
      )
      .filter((n) => NATION_NAME.test(n.toLowerCase())),
  ).size;

  return (
    <div className="pr-coach-history-board">
      <div className="pr-coach-history-board__main">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Coaching history</h2>
            <div className="pr-coach-history-board__filters">
              {(["all", "international", "club", "other"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={filter === id ? "is-on" : ""}
                  onClick={() => setFilter(id)}
                >
                  {id === "all" ? "All" : id[0].toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="pr-coach-empty">No coaching assignments in this filter.</p>
          ) : (
            <ol className="pr-coach-history-rich">
              {rows.map((a) => {
                const stats = profile.assignmentStats[a.id];
                const teamLabel = overviewTeamName({
                  teamDisplayName: a.teamDisplayName,
                  teamName: a.teamName,
                  bioSummary: a.bioSummary,
                });
                const kind = bucket({ ...a, teamName: teamLabel });
                const honours = profile.honours.filter((h) => {
                  if (h.year == null) return false;
                  const from = a.startDate ? Number(a.startDate.slice(0, 4)) : 0;
                  const to = a.endDate ? Number(a.endDate.slice(0, 4)) : 9999;
                  const honourTeam = (h.teamName || "").toLowerCase();
                  const sameTeam =
                    !h.teamName ||
                    honourTeam === a.teamName.toLowerCase() ||
                    honourTeam === teamLabel.toLowerCase();
                  return sameTeam && h.year >= from && h.year <= to;
                });
                return (
                  <li key={a.id} className={a.isCurrent ? "is-current" : undefined}>
                    <em className="pr-coach-history-rich__years">{yearsFor(a)}</em>
                    <CareerTimelineBadge
                      teamName={overviewTeamName({
                        teamDisplayName: a.teamDisplayName,
                        teamName: a.teamName,
                        bioSummary: a.bioSummary,
                      })}
                      crestUrl={profile.crestByTeamId[a.teamId] ?? null}
                      kind={careerBadgeKindFromTimeline({
                        careerType: a.careerType,
                        role: overviewRoleLabel({
                          overviewLabel: a.overviewLabel,
                          roleLabel: a.roleLabel,
                          role: a.role,
                          careerType: a.careerType,
                          teamName: a.teamName,
                        }),
                      })}
                      isCurrent={a.isCurrent}
                    />
                    <div className="pr-coach-history-rich__body">
                      <strong>
                        <Link href={`/teams/${a.teamSlug}`}>
                          {overviewTeamName({
                            teamDisplayName: a.teamDisplayName,
                            teamName: a.teamName,
                            bioSummary: a.bioSummary,
                          })}
                        </Link>
                      </strong>
                      <span className="pr-coach-history-rich__role">
                        {overviewRoleLabel({
                          overviewLabel: a.overviewLabel,
                          roleLabel: a.roleLabel,
                          role: a.role,
                          careerType: a.careerType,
                          teamName: a.teamName,
                        })}
                      </span>
                      {a.bioSummary ? <p>{a.bioSummary}</p> : null}
                      <span className={`pr-coach-history-rich__tag is-${kind}`}>
                        {kind.toUpperCase()}
                      </span>
                      {stats && stats.played > 0 ? (
                        <div className="pr-coach-history-rich__stats">
                          W: {stats.wins} D: {stats.draws} L: {stats.losses}
                          {stats.winRate != null ? ` Win %: ${stats.winRate}%` : ""}
                        </div>
                      ) : null}
                      {honours.length > 0 ? (
                        <div className="pr-coach-history-rich__trophies" aria-label="Honours">
                          Honours
                          {honours.slice(0, 6).map((h) => (
                            <span key={h.id} title={`${h.year} ${h.competitionName}`}>
                              <HonourTrophyIcon size={16} />
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
      <aside className="pr-coach-history-board__side">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Career at a glance</h2>
          </div>
          <dl className="pr-coach-glance">
            <div>
              <dt>Years coaching</dt>
              <dd>{yearsCoaching ? `${yearsCoaching}+` : "—"}</dd>
            </div>
            <div>
              <dt>Teams coached</dt>
              <dd>{teamCount || "—"}</dd>
            </div>
            <div>
              <dt>Trophies won</dt>
              <dd>{profile.majorHonoursCount || profile.honours.length || "—"}</dd>
            </div>
            <div>
              <dt>Countries coached</dt>
              <dd>{countries || 1}</dd>
            </div>
          </dl>
        </section>
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>About {profile.displayName}</h2>
          </div>
          <p className="pr-coach-history-board__about">
            {profile.bioSummary ||
              `${profile.displayName} is a rugby coach on Rugby365, with a public career record across club and international rugby.`}
          </p>
          <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}`}>
            View full profile &gt;
          </Link>
        </section>
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Recent results</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/matches`}>
              All matches &gt;
            </Link>
          </div>
          {profile.recentMatches.length === 0 ? (
            <p className="pr-coach-empty">No recent matches.</p>
          ) : (
            <ol className="pr-coach-history-results">
              {profile.recentMatches.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <time dateTime={m.kickoffAt ?? undefined}>
                    {m.kickoffAt
                      ? new Date(m.kickoffAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })
                      : "—"}
                  </time>
                  <span>
                    <strong>{m.opponentName ?? "—"}</strong>
                    <em>
                      {m.pointsFor}–{m.pointsAgainst} {m.result ?? ""}
                      {m.attendance != null && m.attendance > 0
                        ? ` · ${m.attendance.toLocaleString()}`
                        : ""}
                      {m.manOfTheMatch ? ` · MOTM ${m.manOfTheMatch}` : ""}
                    </em>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
