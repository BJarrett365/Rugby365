"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { MappedLineups, MappedLineupPlayer } from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import type { MatchRatingDisplay } from "@/lib/match-rating-service";
import { isFixtureRatingsPublished } from "@/lib/match-rating-math";
import { teamAccentColor } from "@/lib/team-accent-color";
import type { MatchLineupKit } from "@/lib/match-detail-service";
import { RugbyShirtSvg } from "@/components/shirts/RugbyShirtSvg";
import { PlayerProfileLink } from "./EntityProfileLinks";
import { PlayerMatchPerformancePanel } from "./PlayerMatchPerformancePanel";
import { LineupPitchField } from "./LineupPitchField";
import { LineupPitchJersey } from "./LineupPitchJersey";

/**
 * XV slots — pack toward top of pitch (opposition half), full-back at bottom.
 * Matches broadcast-style lineup cards.
 */
const PITCH_SLOTS: Record<number, { top: string; left: string }> = {
  1: { top: "8%", left: "28%" },
  2: { top: "8%", left: "50%" },
  3: { top: "8%", left: "72%" },
  4: { top: "20%", left: "38%" },
  5: { top: "20%", left: "62%" },
  6: { top: "32%", left: "22%" },
  8: { top: "32%", left: "50%" },
  7: { top: "32%", left: "78%" },
  9: { top: "46%", left: "50%" },
  10: { top: "56%", left: "50%" },
  11: { top: "70%", left: "16%" },
  12: { top: "70%", left: "38%" },
  13: { top: "70%", left: "62%" },
  14: { top: "70%", left: "84%" },
  15: { top: "86%", left: "50%" },
};

function pitchSurname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  const particles = new Set(["van", "von", "de", "del", "da", "di", "le", "la", "du", "st", "der"]);
  if (parts.length >= 3 && particles.has(parts[parts.length - 2]!.toLowerCase())) {
    const short = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    return short.length > 12 ? parts[parts.length - 1]! : short;
  }
  const last = parts[parts.length - 1]!;
  return last.length > 11 ? `${last.slice(0, 10)}…` : last;
}

function slotForPlayer(player: MappedLineupPlayer, index: number): { top: string; left: string } {
  if (player.jerseyNumber >= 1 && player.jerseyNumber <= 15 && PITCH_SLOTS[player.jerseyNumber]) {
    return PITCH_SLOTS[player.jerseyNumber]!;
  }
  // Bench / unknown numbers: keep off the main XV grid
  const col = index % 5;
  return { top: `${92 + Math.floor(index / 5) * 4}%`, left: `${18 + col * 16}%` };
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

function formatCareer(rating: MatchRatingDisplay | null, ratingsPublished: boolean): string {
  if (!ratingsPublished) return "—";
  return rating?.careerRating != null ? String(rating.careerRating) : "—";
}

function formatMatch(
  rating: MatchRatingDisplay | null,
  ratingsPublished: boolean,
  jerseyNumber?: number | null,
): string {
  if (!ratingsPublished) return "—";
  if (rating?.rating != null && rating.ratingStatus !== "unavailable") {
    return rating.ratingLabel;
  }
  // Unused bench: no performance stats / match rating after full time.
  if (jerseyNumber != null && jerseyNumber > 15 && rating?.rating == null) {
    return "DNP";
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
        <span className="pr-lineup-list__match">Match</span>
      </div>
      <ol className="pr-lineup-list__players">
        {players.map((p) => {
          const rating = ratingForPlayer(p, ratingsByExternalId, ratingsByName);
          const active =
            ratingsPublished && rating != null && selectedId === rating.playerId;
          return (
            <li
              key={`${title}-${p.providerId || p.jerseyNumber}-${p.name}`}
              className={active ? "pr-lineup-list__player--active" : undefined}
            >
              <div
                className="pr-lineup-list__row"
                role={ratingsPublished ? "button" : undefined}
                tabIndex={ratingsPublished ? 0 : undefined}
                onClick={() => {
                  if (!ratingsPublished) return;
                  onSelect(rating);
                }}
                onKeyDown={(e) => {
                  if (!ratingsPublished) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(rating);
                  }
                }}
                aria-pressed={ratingsPublished ? active : undefined}
                aria-label={
                  ratingsPublished ? `${p.name} ratings` : `${p.name}`
                }
              >
                <span className="pr-lineup-list__num">{p.jerseyNumber}</span>
                <span className="pr-lineup-list__career" title="Career rating (35–99)">
                  {formatCareer(rating, ratingsPublished)}
                </span>
                <span className="pr-lineup-list__name" onClick={(e) => e.stopPropagation()}>
                  <PlayerProfileLink name={p.name} externalId={p.providerId} context={entities} />
                  {rating?.isRugby365Potm && ratingsPublished ? (
                    <span className="match-potm-pip" title="Rugby365 Player of the Match">
                      POTM
                    </span>
                  ) : null}
                </span>
                <span className="pr-lineup-list__match" title="Match rating (1–10)">
                  {formatMatch(rating, ratingsPublished, p.jerseyNumber)}
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
  rugby365PotmSlug = null,
  officialPotmName = null,
  officialPotmSlug = null,
  matchStatus,
  homeKit = null,
  awayKit = null,
}: {
  lineups: MappedLineups;
  entities: MatchEntityContext;
  ratings?: MatchRatingDisplay[];
  rugby365PotmName?: string | null;
  rugby365PotmSlug?: string | null;
  officialPotmName?: string | null;
  officialPotmSlug?: string | null;
  matchStatus?: string;
  homeKit?: MatchLineupKit | null;
  awayKit?: MatchLineupKit | null;
}) {
  const [pitchSide, setPitchSide] = useState<"home" | "away">("home");
  const [selectedId, setSelectedId] = useState<string | null>(
    ratings.find((r) => r.isRugby365Potm)?.playerId ?? null,
  );
  const router = useRouter();

  const ratingsPublished = useMemo(
    () => isFixtureRatingsPublished(matchStatus ?? ""),
    [matchStatus],
  );

  // Background self-heal may finish after first paint; refresh once so Match ratings appear.
  useEffect(() => {
    if (!ratingsPublished || ratings.length > 0) return;
    const timer = window.setTimeout(() => {
      router.refresh();
    }, 3_500);
    return () => window.clearTimeout(timer);
  }, [ratingsPublished, ratings.length, router]);

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
  const pitchKit = pitchSide === "home" ? homeKit : awayKit;
  const selected = ratings.find((r) => r.playerId === selectedId) ?? null;
  const homeAccent = teamAccentColor(lineups.home.teamName, "home");
  const awayAccent = teamAccentColor(lineups.away.teamName, "away");
  const pitchAccent =
    pitchKit?.svgConfig.bodyColour ??
    (pitchSide === "home" ? homeAccent : awayAccent);
  const gradId = useId().replace(/:/g, "");

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
          <>Player ratings (Career and Match) publish after full time.</>
        )}
      </p>

      {ratingsPublished && (rugby365PotmName || officialPotmName) && (
        <div className="match-potm-banner pr-mc-card">
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
          style={{ ["--pr-lineup-accent" as string]: pitchAccent } as CSSProperties}
          aria-label={`${pitchTeam.teamName} starting lineup on pitch`}
        >
          <LineupPitchField />
          {/* unique gradient namespace scope for jersey fills when both kits use SVG defs */}
          <span className="sr-only" id={`lineup-pitch-${gradId}`}>
            {pitchTeam.teamName}
          </span>
          {pitchTeam.starting.map((p, index) => {
            const slot = slotForPlayer(p, index);
            const rating = ratingForPlayer(p, ratingsByExternalId, ratingsByName);
            const matchLabel =
              ratingsPublished &&
              rating?.rating != null &&
              rating.ratingStatus !== "unavailable"
                ? rating.ratingLabel
                : null;
            const active =
              ratingsPublished && rating != null && selectedId === rating.playerId;
            return (
              <button
                type="button"
                key={p.providerId || `${p.jerseyNumber}-${p.name}`}
                className={`pr-lineup-pitch__player${rating?.isRugby365Potm && ratingsPublished ? " pr-lineup-pitch__player--potm" : ""}${active ? " is-active" : ""}`}
                style={{ top: slot.top, left: slot.left }}
                onClick={() => {
                  if (!ratingsPublished) return;
                  setSelectedId(rating?.playerId ?? null);
                }}
                aria-label={`${p.jerseyNumber} ${p.name}`}
              >
                {pitchKit ? (
                  <RugbyShirtSvg
                    {...pitchKit.svgConfig}
                    number={p.jerseyNumber}
                    size={48}
                    className="pr-lineup-pitch__jersey-svg"
                    kitType={pitchKit.kitType}
                    showCrest={Boolean(pitchKit.crestUrl) && pitchKit.svgConfig.crestEnabled}
                    crestUrl={pitchKit.crestUrl}
                  />
                ) : (
                  <LineupPitchJersey
                    number={p.jerseyNumber}
                    accent={pitchAccent}
                    variant={pitchSide}
                  />
                )}
                <span className="pr-lineup-pitch__surname">{pitchSurname(p.name)}</span>
                {matchLabel ? (
                  <span className="pr-lineup-pitch__rating" title="Match rating">
                    {matchLabel}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {selected && ratingsPublished && (
        <PlayerMatchPerformancePanel rating={selected} onClose={() => setSelectedId(null)} />
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
    </div>
  );
}
