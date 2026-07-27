"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Sport365Lineups, Sport365LineupPlayer } from "@rugby365/match-operator-agent";
import type { FixtureMatchRatingsBundle, MatchRatingDisplay } from "@/lib/match-rating-service";
import { isFixtureRatingsPublished } from "@/lib/match-rating-math";
import { AdminLineupRatingCell } from "@/components/admin/AdminRatingCells";

function ratingForPlayer(
  player: Sport365LineupPlayer,
  ratingsByExternalId: Map<string, MatchRatingDisplay>,
  ratingsByName: Map<string, MatchRatingDisplay>,
): MatchRatingDisplay | null {
  if (player.providerId && ratingsByExternalId.has(player.providerId)) {
    return ratingsByExternalId.get(player.providerId)!;
  }
  const key = player.name.trim().toLowerCase();
  return ratingsByName.get(key) ?? null;
}

function matchDisplayValue(rating: MatchRatingDisplay | null): string | null {
  if (!rating) return null;
  if (rating.rating != null && rating.ratingStatus !== "unavailable") {
    return rating.rating.toFixed(1);
  }
  return null;
}

function AdminLineupTable({
  title,
  lineup,
  ratingsByExternalId,
  ratingsByName,
  ratingsPublished,
}: {
  title: string;
  lineup: Sport365Lineups["home"];
  ratingsByExternalId: Map<string, MatchRatingDisplay>;
  ratingsByName: Map<string, MatchRatingDisplay>;
  ratingsPublished: boolean;
}) {
  const renderRows = (players: Sport365LineupPlayer[], substitute: boolean) =>
    players.map((player) => {
      const rating = ratingForPlayer(player, ratingsByExternalId, ratingsByName);
      const nameCell =
        rating?.playerId ? (
          <Link href={`/admin/players/${rating.playerId}/edit`} className="text-emerald-400 hover:underline">
            {player.name}
          </Link>
        ) : (
          player.name
        );

      return (
        <tr key={`${player.providerId || player.name}-${substitute ? "sub" : "start"}`}>
          <td className={`font-mono ${substitute ? "text-zinc-500" : "text-zinc-400"}`}>
            {player.jerseyNumber}
          </td>
          <td className="text-center whitespace-nowrap">
            <AdminLineupRatingCell
              kind="career"
              value={rating?.careerRating ?? null}
              title={
                rating?.careerRating != null
                  ? `Career Rating ${rating.careerRating}`
                  : "Career Rating unavailable"
              }
            />
          </td>
          <td className={substitute ? "text-zinc-400" : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              {nameCell}
              {rating?.isRugby365Potm && ratingsPublished ? (
                <span className="text-[10px] uppercase tracking-wide text-amber-400 font-medium">POTM</span>
              ) : null}
            </div>
          </td>
          <td className="text-center whitespace-nowrap">
            <AdminLineupRatingCell
              kind="match"
              value={
                ratingsPublished
                  ? matchDisplayValue(rating)
                  : rating?.formRating != null
                    ? rating.formRating
                    : null
              }
              title={
                ratingsPublished
                  ? rating?.rating != null
                    ? `Match Rating ${rating.rating}`
                    : "Match Rating unavailable"
                  : rating?.formRating != null
                    ? `Form Rating ${rating.formLabel}`
                    : "Form unavailable until recent match ratings exist · Match publishes after full time"
              }
            />
          </td>
        </tr>
      );
    });

  const hasPlayers = lineup.starting.length > 0 || lineup.substitutes.length > 0;
  if (!hasPlayers) return null;

  return (
    <div className="cms-card--nested p-3">
      <p className="cms-section-title text-sm mb-2">{title}</p>
      <div className="cms-table-scroll max-h-96">
        <table className="cms-table w-full text-sm admin-lineup-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th className="w-16 text-center" title="Career Rating (35–99)">
                Career
              </th>
              <th>Player</th>
              <th
                className="w-16 text-center"
                title={ratingsPublished ? "Match Rating (1–10)" : "Form from recent Match Ratings"}
              >
                {ratingsPublished ? "Match" : "Form"}
              </th>
            </tr>
          </thead>
          <tbody>
            {renderRows(lineup.starting, false)}
            {lineup.substitutes.length > 0 ? (
              <tr>
                <td colSpan={4} className="text-xs uppercase tracking-wide text-zinc-500">
                  Substitutes
                </td>
              </tr>
            ) : null}
            {renderRows(lineup.substitutes, true)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminMatchLineupSection({
  fixtureId,
  lineups,
  homeFallback,
  awayFallback,
  matchStatus,
}: {
  fixtureId: string;
  lineups: Sport365Lineups;
  homeFallback: string;
  awayFallback: string;
  matchStatus: string;
}) {
  const [bundle, setBundle] = useState<FixtureMatchRatingsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const ratingsPublished = useMemo(
    () => isFixtureRatingsPublished(matchStatus),
    [matchStatus],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/matches/${fixtureId}/lineup-ratings`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: FixtureMatchRatingsBundle) => {
        if (!cancelled) setBundle(data);
      })
      .catch(() => {
        if (!cancelled) setBundle(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  const ratingsByExternalId = useMemo(() => {
    const map = new Map<string, MatchRatingDisplay>();
    for (const rating of bundle?.ratings ?? []) {
      if (rating.externalPlayerId) map.set(rating.externalPlayerId, rating);
    }
    return map;
  }, [bundle]);

  const ratingsByName = useMemo(() => {
    const map = new Map<string, MatchRatingDisplay>();
    for (const rating of bundle?.ratings ?? []) {
      map.set(rating.playerName.trim().toLowerCase(), rating);
    }
    return map;
  }, [bundle]);

  const rugby365PotmName = ratingsPublished
    ? (bundle?.ratings.find((row) => row.isRugby365Potm)?.playerName ?? null)
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <p className="cms-section-title text-sm m-0">Line-ups</p>
        {loading ? <span className="text-xs text-zinc-500">Loading ratings…</span> : null}
        {!ratingsPublished ? (
          <span className="text-xs text-zinc-500">
            Career shows before kick-off · Match ratings publish after full time
          </span>
        ) : null}
      </div>
      {rugby365PotmName ? (
        <p className="text-sm text-amber-300/90 m-0 mb-3">
          Rugby365 Player of the Match: {rugby365PotmName}
        </p>
      ) : null}
      <div className="cms-grid-2">
        <AdminLineupTable
          title={lineups.home.teamName || homeFallback}
          lineup={lineups.home}
          ratingsByExternalId={ratingsByExternalId}
          ratingsByName={ratingsByName}
          ratingsPublished={ratingsPublished}
        />
        <AdminLineupTable
          title={lineups.away.teamName || awayFallback}
          lineup={lineups.away}
          ratingsByExternalId={ratingsByExternalId}
          ratingsByName={ratingsByName}
          ratingsPublished={ratingsPublished}
        />
      </div>
    </div>
  );
}
