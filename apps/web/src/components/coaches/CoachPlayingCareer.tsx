"use client";

import { useMemo, useState } from "react";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";

export function CoachPlayingCareer({ profile }: { profile: PublicCoachProfile }) {
  const tabs = useMemo(() => {
    const types = new Set(profile.playingStints.map((s) => s.teamType));
    const order = ["provincial", "franchise", "club", "international"];
    const present = order.filter((t) => types.has(t));
    return present.length ? present : ["provincial", "franchise", "international"];
  }, [profile.playingStints]);

  const [tab, setTab] = useState(tabs[0] ?? "provincial");
  const rows = profile.playingStints.filter((s) => s.teamType === tab);
  const intl = profile.playingStints.filter((s) => s.teamType === "international");
  const caps = intl.reduce((s, r) => s + (r.apps ?? 0), 0);
  const points = intl.reduce((s, r) => s + (r.points ?? 0), 0);
  const debut = intl.map((r) => r.startYear).filter(Boolean).sort((a, b) => (a ?? 0) - (b ?? 0))[0];
  const finalY = intl
    .map((r) => r.endYear ?? r.startYear)
    .filter(Boolean)
    .sort((a, b) => (b ?? 0) - (a ?? 0))[0];

  const label = (t: string) =>
    t === "franchise" ? "SUPER RUGBY" : t === "provincial" ? "PROVINCIAL" : t.toUpperCase();

  return (
    <section className="pr-coach-card">
      <div className="pr-coach-card__head">
        <h2>Playing Career</h2>
        <a className="pr-coach-card__link" href={`/coaches/${profile.slug}/career`}>
          View full career &gt;
        </a>
      </div>
      <div className="pr-coach-tabs">
        {tabs.map((t) => (
          <button key={t} type="button" className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
            {label(t)}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="pr-coach-empty">No verified playing career data yet.</p>
      ) : (
        <table className="pr-coach-table">
          <thead>
            <tr>
              <th>Years</th>
              <th>Team</th>
              <th>Apps</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.yearsLabel}</td>
                <td>{r.teamName}</td>
                <td>{r.apps ?? "—"}</td>
                <td>{r.points == null ? "—" : r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {intl.length > 0 ? (
        <div className="pr-coach-intl">
          <div>
            <strong>{intl[0]?.teamName ?? "International"}</strong>
            <div className="pr-coach-intl__stats" style={{ marginTop: "0.5rem" }}>
              <div>
                <span>Caps</span>
                <strong>{caps || "—"}</strong>
              </div>
              <div>
                <span>Points</span>
                <strong>{points || "—"}</strong>
              </div>
              <div>
                <span>Debut</span>
                <strong>{debut ?? "—"}</strong>
              </div>
              <div>
                <span>Final Test</span>
                <strong>{finalY ?? "—"}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
