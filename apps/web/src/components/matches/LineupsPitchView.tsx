"use client";

import { useMemo, useState } from "react";
import type { MappedLineups, MappedLineupPlayer } from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import type { MatchRatingDisplay } from "@/lib/match-rating-service";
import { isFixtureRatingsPublished } from "@/lib/match-rating-math";
import { PlayerProfileLink } from "./EntityProfileLinks";
import { PlayerMatchPerformancePanel } from "./PlayerMatchPerformancePanel";

/** Approximate rugby XV pitch positions (percent from top / left). */
const PITCH_SLOTS: Record<number, { top: string; left: string }> = {
  1: { top: "8%", left: "28%" },
  2: { top: "8%", left: "50%" },
  3: { top: "8%", left: "72%" },
  4: { top: "20%", left: "38%" },
  5: { top: "20%", left: "62%" },
  6: { top: "32%", left: "22%" },
  7: { top: "32%", left: "78%" },
  8: { top: "32%", left: "50%" },
  9: { top: "46%", left: "50%" },
  10: { top: "58%", left: "50%" },
  11: { top: "70%", left: "18%" },
  12: { top: "70%", left: "38%" },
  13: { top: "70%", left: "62%" },
  14: { top: "70%", left: "82%" },
  15: { top: "86%", left: "50%" },
};

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function ratingForPlayer(
  player: MappedLineupPlayer,
  ratingsByExternalId: Map<string, MatchRatingDisplay>,
  ratingsByName: Map<string, MatchRatingDisplay>,
): MatchRatingDisplay | null {
  if (player.providerId && ratingsByExternalId.has(player.providerId)) {
    return ratingsByExternalId.get(player.providerId)!;
  }
  return ratingsByName.get(player.name.trim().toLowerCase()) ?? null;
}

function formatCareer(rating: MatchRatingDisplay | null): string {
  return rating?.careerRating != null ? String(rating.careerRating) : "—";
}

function formatMatch(
  rating: MatchRatingDisplay | null,
  ratingsPublished: boolean,
): string {
  if (!ratingsPublished) {
    return rating?.formRating != null ? String(rating.formRating) : "—";
  }
  if (rating?.rating != null && rating.ratingStatus !== "unavailable") {
    return rating.ratingLabel;
  }
  return "—";
}

function LineupListSide({
  title,
  players,
  entities,
  heading,
  ratingsByExternalId,
  ratingsByName,
  ratingsPublished,
  selectedId,
  onSelect,
}: {
  title: string;
  players: MappedLineupPlayer[];
  entities: MatchEntityContext;
  heading: string;
  ratingsByExternalId: Map<string, MatchRatingDisplay>;
  ratingsByName: Map<string, MatchRatingDisplay>;
  ratingsPublished: boolean;
  selectedId: string | null;
  onSelect: (rating: MatchRatingDisplay | null) => void;
}) {
  if (players.length === 0) return null;
  return (
    <div className="pr-lineup-list__side">
      <h4 className="pr-lineup-list__side-title">{heading}</h4>
      <div className="pr-lineup-list__header" aria-hidden>
        <span className="pr-lineup-list__num">#</span>
        <span className="pr-lineup-list__career">Career</span>
        <span className="pr-lineup-list__name">Player</span>
        <span className="pr-lineup-list__match">{ratingsPublished ? "Match" : "Form"}</span>
      </div>
      <ol className="pr-lineup-list__players">
        {players.map((p) => {
          const rating = ratingForPlayer(p, ratingsByExternalId, ratingsByName);
          const active = rating != null && selectedId === rating.playerId;
          return (
            <li
              key={`${title}-${p.providerId || p.jerseyNumber}-${p.name}`}
              className={active ? "pr-lineup-list__player--active" : undefined}
            >
              <div
                className="pr-lineup-list__row"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(rating)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(rating);
                  }
                }}
                aria-pressed={active}
                aria-label={`${p.name} ratings`}
              >
                <span className="pr-lineup-list__num">{p.jerseyNumber}</span>
                <span className="pr-lineup-list__career" title="Career rating (35–99)">
                  {formatCareer(rating)}
                </span>
                <span className="pr-lineup-list__name" onClick={(e) => e.stopPropagation()}>
                  <PlayerProfileLink name={p.name} externalId={p.providerId} context={entities} />
                  {rating?.isRugby365Potm && ratingsPublished ? (
                    <span className="match-potm-pip" title="Rugby365 Player of the Match">
                      POTM
                    </span>
                  ) : null}
                </span>
                <span
                  className="pr-lineup-list__match"
                  title={ratingsPublished ? "Match rating (1–10)" : "Form rating"}
                >
                  {formatMatch(rating, ratingsPublished)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LineupsPitchView({
  lineups,
  entities,
  ratings = [],
  rugby365PotmName = null,
  officialPotmName = null,
  matchStatus,
}: {
  lineups: MappedLineups;
  entities: MatchEntityContext;
  ratings?: MatchRatingDisplay[];
  rugby365PotmName?: string | null;
  officialPotmName?: string | null;
  matchStatus?: string;
}) {
  const [pitchSide, setPitchSide] = useState<"home" | "away">("home");
  const [selectedId, setSelectedId] = useState<string | null>(
    ratings.find((r) => r.isRugby365Potm)?.playerId ?? null,
  );

  const ratingsPublished = useMemo(
    () => isFixtureRatingsPublished(matchStatus ?? ""),
    [matchStatus],
  );

  const ratingsByExternalId = useMemo(() => {
    const map = new Map<string, MatchRatingDisplay>();
    for (const r of ratings) {
      if (r.externalPlayerId) map.set(r.externalPlayerId, r);
    }
    return map;
  }, [ratings]);

  const ratingsByName = useMemo(() => {
    const map = new Map<string, MatchRatingDisplay>();
    for (const r of ratings) map.set(r.playerName.trim().toLowerCase(), r);
    return map;
  }, [ratings]);

  const pitchTeam = pitchSide === "home" ? lineups.home : lineups.away;
  const selected = ratings.find((r) => r.playerId === selectedId) ?? null;

  const listProps = {
    entities,
    ratingsByExternalId,
    ratingsByName,
    ratingsPublished,
    selectedId,
    onSelect: (rating: MatchRatingDisplay | null) => setSelectedId(rating?.playerId ?? null),
  };

  return (
    <div className="pr-lineups">
      <p className="pr-lineups__legend match-rating-legend">
        {ratingsPublished ? (
          <>
            <strong>Career</strong> (35–99) · <strong>Match</strong> (1–10)
          </>
        ) : (
          <>Career and Form numbers show before kick-off. Match ratings publish after full time.</>
        )}
      </p>

      {ratingsPublished && (rugby365PotmName || officialPotmName) && (
        <div className="match-potm-banner pr-mc-card">
          {rugby365PotmName && (
            <p>
              <strong>Rugby365 Player of the Match:</strong> {rugby365PotmName}
            </p>
          )}
          {officialPotmName && (
            <p>
              <strong>Official Player of the Match:</strong> {officialPotmName}
            </p>
          )}
        </div>
      )}

      <section className="pr-lineup-list">
        <div className="pr-lineup-list__cols">
          <div>
            <h3 className="pr-lineup-list__team">{lineups.home.teamName}</h3>
            <LineupListSide
              title="home-start"
              heading="Starters"
              players={lineups.home.starting}
              {...listProps}
            />
            <LineupListSide
              title="home-bench"
              heading="Substitutes"
              players={lineups.home.substitutes}
              {...listProps}
            />
          </div>
          <div>
            <h3 className="pr-lineup-list__team">{lineups.away.teamName}</h3>
            <LineupListSide
              title="away-start"
              heading="Starters"
              players={lineups.away.starting}
              {...listProps}
            />
            <LineupListSide
              title="away-bench"
              heading="Replacements"
              players={lineups.away.substitutes}
              {...listProps}
            />
          </div>
        </div>
      </section>

      {selected && (
        <PlayerMatchPerformancePanel rating={selected} onClose={() => setSelectedId(null)} />
      )}

      <section className="pr-lineup-pitch-wrap">
        <div className="pr-lineup-pitch__tabs" role="tablist" aria-label="Pitch team">
          <button
            type="button"
            role="tab"
            aria-selected={pitchSide === "home"}
            className={`pr-lineup-pitch__tab${pitchSide === "home" ? " pr-lineup-pitch__tab--active" : ""}`}
            onClick={() => setPitchSide("home")}
          >
            {lineups.home.teamName}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pitchSide === "away"}
            className={`pr-lineup-pitch__tab${pitchSide === "away" ? " pr-lineup-pitch__tab--active" : ""}`}
            onClick={() => setPitchSide("away")}
          >
            {lineups.away.teamName}
          </button>
        </div>

        <div
          className={`pr-lineup-pitch pr-lineup-pitch--${pitchSide}`}
          aria-label={`${pitchTeam.teamName} formation`}
        >
          {pitchTeam.starting.map((p) => {
            const slot = PITCH_SLOTS[p.jerseyNumber] ?? { top: "50%", left: "50%" };
            const rating = ratingForPlayer(p, ratingsByExternalId, ratingsByName);
            const matchLabel =
              ratingsPublished && rating?.rating != null && rating.ratingStatus !== "unavailable"
                ? rating.ratingLabel
                : rating?.careerRating != null
                  ? String(rating.careerRating)
                  : null;
            return (
              <button
                type="button"
                key={p.providerId || `${p.jerseyNumber}-${p.name}`}
                className={`pr-lineup-pitch__player${rating?.isRugby365Potm ? " pr-lineup-pitch__player--potm" : ""}`}
                style={{ top: slot.top, left: slot.left }}
                onClick={() => setSelectedId(rating?.playerId ?? null)}
              >
                <span className="pr-lineup-pitch__jersey">{p.jerseyNumber}</span>
                <span className="pr-lineup-pitch__surname">{surname(p.name)}</span>
                {matchLabel && (
                  <span className="pr-lineup-pitch__rating" title={ratingsPublished ? "Match rating" : "Career rating"}>
                    {matchLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
