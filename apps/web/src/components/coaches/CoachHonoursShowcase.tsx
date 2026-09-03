"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";
import { CareerTimelineBadge, careerBadgeKindFromTimeline } from "./CareerTimelineBadge";
import { CoachProfileAssetImage } from "./CoachProfileAssetImage";
import { HonourAwardIcon, HonourTrophyIcon } from "@/components/honours/HonourIcons";

function winnerLabel(type: string | null | undefined): string {
  const t = (type || "winner").toLowerCase();
  if (t === "winner" || t === "champion") return "Winner";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function yearsFor(a: { startDate: string | null; endDate: string | null; isCurrent: boolean }): string {
  const start = a.startDate?.slice(0, 4);
  const end = a.endDate?.slice(0, 4);
  if (start && end) return `${start} – ${end}`;
  if (start && a.isCurrent) return `${start} – Present`;
  return start || "—";
}

export function CoachHonoursShowcase({ profile }: { profile: PublicCoachProfile }) {
  const [tab, setTab] = useState<"coaching" | "playing">("coaching");
  const [showAllAwards, setShowAllAwards] = useState(false);
  const honours = profile.honours;
  const awards = profile.publicAwards.length ? profile.publicAwards : profile.awards.map((a) => ({
    id: a.id,
    year: a.year,
    title: a.awardName,
    organisation: a.awardingBody,
    resultLabel: (a.result || "winner").toUpperCase(),
    iconKey: "award_coach",
  }));
  const visibleAwards = showAllAwards ? awards : awards.slice(0, 5);
  const milestones = useMemo(() => {
    const seen = new Set<string>();
    return profile.milestones.filter((m) => {
      const key = `${m.milestoneYear}|${m.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [profile.milestones]);

  useEffect(() => {
    if (awards.length > 5 && window.location.hash === "#awards") {
      setShowAllAwards(true);
    }
  }, [awards.length]);

  return (
    <div className="pr-coach-honour-board">
      <div className="pr-coach-honour-board__cols">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>
              <HonourTrophyIcon size={18} /> Honours
            </h2>
          </div>
          {honours.length === 0 ? (
            <p className="pr-coach-empty">No honours recorded.</p>
          ) : (
            <ul className="pr-coach-winner-list">
              {honours.slice(0, 14).map((h) => (
                <li key={h.id}>
                  <span className="pr-coach-winner-list__year">{h.year ?? "—"}</span>
                  <span className="pr-coach-winner-list__title">{h.competitionName ?? "Honour"}</span>
                  <span className="pr-coach-winner-list__result">{winnerLabel(h.achievementType)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="pr-coach-card__cta" href={`/coaches/${profile.slug}/honours`}>
            View all honours
          </Link>
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Career summary</h2>
            <div className="pr-coach-honour-board__tabs">
              <button type="button" className={tab === "coaching" ? "is-on" : ""} onClick={() => setTab("coaching")}>
                Coaching
              </button>
              <button type="button" className={tab === "playing" ? "is-on" : ""} onClick={() => setTab("playing")}>
                Playing
              </button>
            </div>
          </div>
          {tab === "coaching" ? (
            profile.assignments.length === 0 ? (
              <p className="pr-coach-empty">No coaching assignments recorded.</p>
            ) : (
              <ol className="pr-coach-summary-list">
                {profile.assignments.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <CareerTimelineBadge
                      teamName={a.teamName}
                      crestUrl={profile.crestByTeamId[a.teamId] ?? null}
                      kind={careerBadgeKindFromTimeline({ careerType: a.careerType, role: a.roleLabel })}
                      isCurrent={a.isCurrent}
                    />
                    <div>
                      <strong>{a.teamName}</strong>
                      <span>
                        {yearsFor(a)} · {a.roleLabel}
                      </span>
                      {a.bioSummary ? <em>{a.bioSummary}</em> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )
          ) : profile.playingStints.length === 0 ? (
            <p className="pr-coach-empty">No playing stints recorded.</p>
          ) : (
            <ol className="pr-coach-summary-list">
              {profile.playingStints.slice(0, 8).map((s) => (
                <li key={s.id}>
                  {s.crestUrl ? (
                    <CoachProfileAssetImage src={s.crestUrl} className="pr-career-badge__img" width={36} height={36} />
                  ) : (
                    <CareerTimelineBadge teamName={s.teamName} crestUrl={s.crestUrl} kind="player" />
                  )}
                  <div>
                    <strong>{s.teamName}</strong>
                    <span>
                      {s.yearsLabel || "—"}
                      {s.apps != null ? ` · ${s.apps} apps` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Link className="pr-coach-card__cta" href={`/coaches/${profile.slug}/history`}>
            View full career history
          </Link>
        </section>

        <section className="pr-coach-card" id="awards">
          <div className="pr-coach-card__head">
            <h2>
              <HonourAwardIcon size={18} /> Awards
            </h2>
          </div>
          {awards.length === 0 ? (
            <p className="pr-coach-empty">No awards recorded.</p>
          ) : (
            <ul className="pr-coach-winner-list">
              {visibleAwards.map((a) => (
                <li key={a.id}>
                  <span className="pr-coach-winner-list__year">{a.year ?? "—"}</span>
                  <span className="pr-coach-winner-list__title">{a.title}</span>
                  <span className="pr-coach-winner-list__result">{a.resultLabel || "WINNER"}</span>
                </li>
              ))}
            </ul>
          )}
          {awards.length > 5 ? (
            <button
              type="button"
              className="pr-coach-card__cta"
              onClick={() => setShowAllAwards((open) => !open)}
            >
              {showAllAwards ? "Show fewer awards" : `View all awards (${awards.length})`}
            </button>
          ) : null}
        </section>
      </div>

      {milestones.length > 0 ? (
        <section className="pr-coach-card" style={{ marginTop: "0.85rem" }}>
          <div className="pr-coach-card__head">
            <h2>Milestones</h2>
          </div>
          <div className="pr-coach-milestone-cards">
            {milestones.slice(0, 5).map((m) => (
              <article key={m.id}>
                <strong>{m.milestoneYear ?? "—"}</strong>
                <span>{m.title}</span>
                {m.description ? <em>{m.description}</em> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
