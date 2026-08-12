"use client";

import Link from "next/link";
import { HonourMedal } from "@/components/honours/HonourIcons";
import type { PublicMedalRow } from "@/lib/achievement-types";

type Props = {
  slug: string;
  medals: PublicMedalRow[];
};

const GROUP_LABEL: Record<PublicMedalRow["roleGroup"], string> = {
  player: "As Player",
  coaching: "As Coaching Career",
  other: "Other",
};

export function CoachMedalRecordCard({ slug, medals }: Props) {
  const groups: Array<PublicMedalRow["roleGroup"]> = ["player", "coaching", "other"];

  return (
    <section className="pr-coach-card pr-coach-medals-card">
      <div className="pr-coach-card__head">
        <h2>Medal Record</h2>
        <Link className="pr-coach-card__link" href={`/coaches/${slug}/honours`}>
          View all medals &gt;
        </Link>
      </div>
      {medals.length === 0 ? (
        <p className="pr-coach-empty">No medal record yet.</p>
      ) : (
        groups.map((group) => {
          const rows = medals.filter((m) => m.roleGroup === group);
          if (!rows.length) return null;
          return (
            <div className="pr-coach-medal-group" key={group}>
              <div className="pr-coach-medal-group__label">{GROUP_LABEL[group]}</div>
              <ul className="pr-coach-medal-list">
                {rows.map((m) => (
                  <li className="pr-coach-medal-row" key={m.id}>
                    <span className="pr-coach-medal-row__year">{m.year ?? "—"}</span>
                    <span className="pr-coach-medal-row__text">
                      <span className="pr-coach-medal-row__comp">{m.competitionName}</span>
                      <span className="pr-coach-medal-row__result">{m.resultLabel}</span>
                    </span>
                    <span className="pr-coach-medal-row__icon">
                      {m.medalType === "gold" ||
                      m.medalType === "silver" ||
                      m.medalType === "bronze" ? (
                        <HonourMedal type={m.medalType} size={34} />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
