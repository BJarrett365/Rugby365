"use client";

import { useMemo, useState } from "react";
import type { PublicCoachProfile } from "@/lib/public-coach-profile-service";

type PlayingStint = PublicCoachProfile["playingStints"][number];

type CareerTab = "provincial" | "super_rugby" | "international";

const TABS: Array<{ id: CareerTab; label: string }> = [
  { id: "provincial", label: "PROVINCIAL" },
  { id: "super_rugby", label: "SUPER RUGBY" },
  { id: "international", label: "INTERNATIONAL" },
];

function dash(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function teamLabel(s: PlayingStint): string {
  return (s.teamDisplayName?.trim() || s.teamName || "—").trim();
}

/** Exclude timeline-only summary rows from the Playing Career table. */
function isTableRow(s: PlayingStint): boolean {
  if (s.competitionLevel === "summary" || s.competitionLevel === "timeline_summary") {
    return false;
  }
  return true;
}

function isSuperRugby(s: PlayingStint): boolean {
  return (
    s.teamType === "franchise" ||
    s.careerType === "super_rugby_player" ||
    s.competitionLevel === "super_rugby"
  );
}

function isInternational(s: PlayingStint): boolean {
  return s.teamType === "international" || s.careerType === "international_player";
}

function filterRows(stints: PlayingStint[], tab: CareerTab): PlayingStint[] {
  const table = stints.filter(isTableRow);
  if (tab === "international") return table.filter(isInternational);
  if (tab === "super_rugby") return table.filter(isSuperRugby);
  // Match approved overview: provincial tab shows club + franchise career (excl. international)
  return table.filter((s) => !isInternational(s));
}

export function CoachPlayingCareer({ profile }: { profile: PublicCoachProfile }) {
  const [tab, setTab] = useState<CareerTab>("provincial");

  const rows = useMemo(
    () => filterRows(profile.playingStints, tab),
    [profile.playingStints, tab],
  );

  const intl = useMemo(
    () => profile.playingStints.filter((s) => isTableRow(s) && isInternational(s)),
    [profile.playingStints],
  );

  const intlPrimary = intl[0] ?? null;
  const caps = intl.reduce((s, r) => s + (r.apps ?? 0), 0);
  const points = intl.reduce((s, r) => s + (r.points ?? 0), 0);
  const debut = intl
    .map((r) => r.startYear)
    .filter((y): y is number => y != null)
    .sort((a, b) => a - b)[0];
  const finalY = intl
    .map((r) => r.endYear ?? r.startYear)
    .filter((y): y is number => y != null)
    .sort((a, b) => b - a)[0];

  const shieldUrl = intlPrimary?.crestUrl ?? null;
  const nationLabel = teamLabel(intlPrimary ?? ({ teamName: "International" } as PlayingStint));

  return (
    <section className="pr-coach-card pr-coach-playing">
      <div className="pr-coach-card__head">
        <h2>PLAYING CAREER</h2>
        <a className="pr-coach-card__link" href={`/coaches/${profile.slug}/career`}>
          View full career &gt;
        </a>
      </div>

      <div className="pr-coach-tabs pr-coach-tabs--underline" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "is-active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="pr-coach-empty">No verified playing career data yet.</p>
      ) : (
        <table className="pr-coach-table pr-coach-table--playing">
          <colgroup>
            <col className="years" />
            <col className="team" />
            <col className="apps" />
            <col className="points" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Years</th>
              <th scope="col">Team</th>
              <th scope="col" className="num">
                Apps
              </th>
              <th scope="col" className="num">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="years">{r.yearsLabel}</td>
                <td className="team">
                  <span className="pr-coach-teamcell">
                    {r.crestUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="pr-coach-teamcell__crest"
                        src={r.crestUrl}
                        alt=""
                        width={18}
                        height={18}
                      />
                    ) : (
                      <span className="pr-coach-teamcell__crest pr-coach-teamcell__crest--empty" />
                    )}
                    <span>{teamLabel(r)}</span>
                  </span>
                </td>
                <td className="num">{dash(r.apps)}</td>
                <td className="num">{dash(r.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {intl.length > 0 ? (
        <div className="pr-coach-intl">
          <div className="pr-coach-intl__shield">
            {shieldUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shieldUrl} alt={`${nationLabel} crest`} width={76} height={76} />
            ) : (
              <div className="pr-coach-intl__shield-fallback" aria-hidden>
                SA
              </div>
            )}
          </div>
          <div className="pr-coach-intl__body">
            <div className="pr-coach-intl__title">
              INTERNATIONAL CAREER ({nationLabel})
            </div>
            <div className="pr-coach-intl__stats">
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
