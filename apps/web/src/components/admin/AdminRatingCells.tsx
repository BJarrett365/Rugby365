"use client";

import type { SquadPlayerRankings } from "@/lib/match-rating-service";

export function AdminLineupRatingCell({
  kind,
  value,
  title,
}: {
  kind: "career" | "match";
  value: string | number | null;
  title: string;
}) {
  const display = value == null || value === "—" ? "—" : String(value);
  const empty = display === "—";
  return (
    <span
      className={`admin-lineup-rating admin-lineup-rating--${kind}${empty ? " admin-lineup-rating--na" : ""}`}
      title={title}
    >
      {display}
    </span>
  );
}

export function AdminSquadRankingsCell({
  rankings,
  showLatestMatch = false,
  ratingsPublished = true,
}: {
  rankings: SquadPlayerRankings;
  showLatestMatch?: boolean;
  ratingsPublished?: boolean;
}) {
  const careerTitle =
    rankings.careerRating != null
      ? `Career Rating ${rankings.careerRating}`
      : "Career Rating unavailable";
  const matchTitle = !ratingsPublished
    ? "Published after full time"
    : rankings.latestMatchRating != null
      ? `Match Rating ${rankings.latestMatchRating.toFixed(1)}`
      : "Match Rating unavailable";
  const formTitle =
    rankings.formRating != null
      ? `Form ${rankings.formRating.toFixed(1)} from recent matches`
      : "Form unavailable";

  return (
    <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
      <AdminLineupRatingCell kind="career" value={rankings.careerRating} title={careerTitle} />
      {showLatestMatch ? (
        <>
          <span className="text-zinc-600 text-xs">|</span>
          <AdminLineupRatingCell
            kind="match"
            value={
              ratingsPublished && rankings.latestMatchRating != null
                ? rankings.latestMatchRating.toFixed(1)
                : null
            }
            title={matchTitle}
          />
        </>
      ) : null}
      <span className="text-zinc-600 text-xs">|</span>
      <span className="text-xs text-zinc-400 font-mono" title={formTitle}>
        {rankings.formLabel}
      </span>
    </div>
  );
}
