"use client";

import { useMemo, useState } from "react";
import type { MappedLineups } from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import type { MatchRatingDisplay } from "@/lib/match-rating-service";
import { isFixtureRatingsPublished } from "@/lib/match-rating-math";
import { PlayerProfileLink } from "./EntityProfileLinks";
import { DualRatingCell } from "./MatchRatingBadge";
import { PlayerMatchPerformancePanel } from "./PlayerMatchPerformancePanel";
import { PlayerBadge } from "@/components/players/PlayerBadge";
import { lookupPlayerLink } from "@/lib/match-entity-context";

type LineupPlayer = MappedLineups["home"]["starting"][number];

function ratingForPlayer(
  player: LineupPlayer,
  ratingsByExternalId: Map<string, MatchRatingDisplay>,
  ratingsByName: Map<string, MatchRatingDisplay>,
): MatchRatingDisplay | null {
  if (player.providerId && ratingsByExternalId.has(player.providerId)) {
    return ratingsByExternalId.get(player.providerId)!;
  }
  const key = player.name.trim().toLowerCase();
  return ratingsByName.get(key) ?? null;
}

function LineupColumn({
  side,
  lineup,
  entities,
  ratingsByExternalId,
  ratingsByName,
  selectedId,
  onSelect,
  ratingsPublished,
}: {
  side: "home" | "away";
  lineup: MappedLineups["home"];
  entities: MatchEntityContext;
  ratingsByExternalId: Map<string, MatchRatingDisplay>;
  ratingsByName: Map<string, MatchRatingDisplay>;
  selectedId: string | null;
  onSelect: (rating: MatchRatingDisplay | null) => void;
  ratingsPublished: boolean;
}) {
  const renderRows = (players: LineupPlayer[], prefix: string) =>
    players.map((p) => {
      const rating = ratingForPlayer(p, ratingsByExternalId, ratingsByName);
      const rowKey = `${side}-${prefix}-${p.providerId || p.name}`;
      const active = rating && selectedId === rating.playerId;
      return (
        <tr
          key={rowKey}
          className={active ? "match-detail-lineup__row--active" : undefined}
          onClick={() => onSelect(rating)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(rating);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${p.name} career and match ratings`}
        >
          <td>{p.jerseyNumber}</td>
          <td>
            <div className="match-detail-lineup__player">
              <PlayerProfileLink name={p.name} externalId={p.providerId} context={entities} />
              {rating?.isRugby365Potm && ratingsPublished ? (
                <span className="match-potm-pip" title="Rugby365 Player of the Match">
                  POTM
                </span>
              ) : null}
            </div>
          </td>
          <td className="match-detail-lineup__pos">{p.positionName}</td>
          <td className="match-detail-lineup__role">
            {prefix === "s" ? "Starter" : "Replacement"}
          </td>
          <td className="match-detail-lineup__rating">
            <DualRatingCell
              rating={rating}
              mode={ratingsPublished ? "completed" : "scheduled"}
              jerseyNumber={p.jerseyNumber}
            />
          </td>
        </tr>
      );
    });

  return (
    <div className="match-detail-lineup">
      <h3 className="match-detail-lineup__title">{lineup.teamName}</h3>
      <div className="pr-lineup-badge-row" aria-label={`${lineup.teamName} starting badges`}>
        {lineup.starting.slice(0, 15).map((p) => {
          const rating = ratingForPlayer(p, ratingsByExternalId, ratingsByName);
          const link = lookupPlayerLink(entities, {
            externalId: p.providerId,
            name: p.name,
          });
          return (
            <PlayerBadge
              key={`${side}-badge-${p.providerId || p.name}`}
              name={p.name}
              imageUrl={link?.imageUrl}
              rating={ratingsPublished ? rating?.careerRating ?? null : null}
              positionName={p.positionName}
              slug={link?.slug}
              size="micro"
              compact
            />
          );
        })}
      </div>
      <table className="match-detail-lineup__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Role</th>
            <th title="Career (35–99) | Match (1–10)">
              Career | Match
            </th>
          </tr>
        </thead>
        <tbody>{renderRows(lineup.starting, "s")}</tbody>
      </table>
      {lineup.substitutes.length > 0 && (
        <>
          <h4 className="match-detail-lineup__subs">Replacements</h4>
          <table className="match-detail-lineup__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Pos</th>
                <th>Role</th>
                <th>Career | Match</th>
              </tr>
            </thead>
            <tbody>{renderRows(lineup.substitutes, "b")}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function MatchLineupsWithRatings({
  lineups,
  entities,
  ratings,
  rugby365PotmName,
  rugby365PotmSlug = null,
  officialPotmName,
  officialPotmSlug = null,
  matchStatus,
}: {
  lineups: MappedLineups;
  entities: MatchEntityContext;
  ratings: MatchRatingDisplay[];
  rugby365PotmName: string | null;
  rugby365PotmSlug?: string | null;
  officialPotmName: string | null;
  officialPotmSlug?: string | null;
  matchStatus?: string;
}) {
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

  const selected = ratings.find((r) => r.playerId === selectedId) ?? null;

  return (
    <section className="match-detail-section">
      <p className="match-rating-legend">
        {ratingsPublished ? (
          <>
            <strong>Career</strong> = overall quality (35–99) · <strong>Match</strong> = this game
            (1–10)
          </>
        ) : (
          <>Player ratings publish after full time.</>
        )}
      </p>
      {ratingsPublished && (rugby365PotmName || officialPotmName) && (
        <div className="match-potm-banner cms-card">
          {rugby365PotmName && (
            <p>
              <strong>Rugby365 Player of the Match:</strong>{" "}
              <PlayerProfileLink
                name={rugby365PotmName}
                slug={rugby365PotmSlug}
                externalId={ratings.find((r) => r.isRugby365Potm)?.externalPlayerId}
                context={entities}
              />
            </p>
          )}
          {officialPotmName && (
            <p>
              <strong>Official Player of the Match:</strong>{" "}
              <PlayerProfileLink
                name={officialPotmName}
                slug={officialPotmSlug}
                externalId={ratings.find((r) => r.isOfficialPotm)?.externalPlayerId}
                context={entities}
              />
            </p>
          )}
        </div>
      )}

      <div className="match-detail-lineups">
        <LineupColumn
          side="home"
          lineup={lineups.home}
          entities={entities}
          ratingsByExternalId={ratingsByExternalId}
          ratingsByName={ratingsByName}
          selectedId={selectedId}
          onSelect={(r) => setSelectedId(r?.playerId ?? null)}
          ratingsPublished={ratingsPublished}
        />
        <LineupColumn
          side="away"
          lineup={lineups.away}
          entities={entities}
          ratingsByExternalId={ratingsByExternalId}
          ratingsByName={ratingsByName}
          selectedId={selectedId}
          onSelect={(r) => setSelectedId(r?.playerId ?? null)}
          ratingsPublished={ratingsPublished}
        />
      </div>

      {selected && (
        <PlayerMatchPerformancePanel rating={selected} onClose={() => setSelectedId(null)} />
      )}
    </section>
  );
}
