"use client";

import Link from "next/link";
import { HonourAwardIcon, HonourIcon } from "@/components/honours/HonourIcons";
import type { PublicAwardRow } from "@/lib/achievement-types";

type Props = {
  slug: string;
  awards: PublicAwardRow[];
  limit?: number;
};

export function CoachAwardsCard({ slug, awards, limit = 4 }: Props) {
  const rows = awards.slice(0, limit);
  return (
    <section className="pr-coach-card pr-coach-awards-card">
      <div className="pr-coach-card__head">
        <h2>Awards</h2>
        <Link className="pr-coach-card__link" href={`/coaches/${slug}/honours`}>
          View all awards &gt;
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="pr-coach-empty">No individual awards recorded.</p>
      ) : (
        <ul className="pr-coach-award-list">
          {rows.map((a) => (
            <li className="pr-coach-award-row" key={a.id}>
              <span className="pr-coach-award-row__year">{a.year ?? "—"}</span>
              <span className="pr-coach-award-row__icon" aria-hidden>
                {a.iconKey?.startsWith("award") || !a.iconKey ? (
                  <HonourAwardIcon
                    size={26}
                    variant={
                      a.iconKey === "award_world"
                        ? "world"
                        : a.iconKey === "award_player"
                          ? "player"
                          : "coach"
                    }
                  />
                ) : (
                  <HonourIcon iconKey={a.iconKey} size={26} />
                )}
              </span>
              <span className="pr-coach-award-row__text">
                {a.organisation ? (
                  <span className="pr-coach-award-row__org">{a.organisation}</span>
                ) : null}
                <span className="pr-coach-award-row__title">{a.title}</span>
              </span>
              <span className="pr-coach-tag">{a.resultLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
