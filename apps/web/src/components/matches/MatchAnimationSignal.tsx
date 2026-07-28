"use client";

import { TeamCrest } from "./TeamCrest";
import { MediaImage } from "@/components/media/MediaImage";
import type { AnimationSignal } from "@/lib/match-animation-signals";
import { signalAnnouncement } from "@/lib/match-animation-signals";
import type { AnimationStatChip } from "@/lib/match-animation-player-stats";
import { MatchAnimationPlayerStatChips } from "./MatchAnimationPlayerStats";

type TeamInfo = {
  name: string;
  shortName: string;
  imageUrl: string | null;
  colour: string;
};

type Props = {
  signal: AnimationSignal;
  home: TeamInfo;
  away: TeamInfo;
  visible: boolean;
  playerStatChips?: AnimationStatChip[];
};

/** Centre-pitch broadcast signal (SCRUM / TRY / PENALTY / CARD / SUB). */
export function MatchAnimationSignal({
  signal,
  home,
  away,
  visible,
  playerStatChips = [],
}: Props) {
  if (!visible) return null;

  const team =
    signal.teamSide === "home" ? home : signal.teamSide === "away" ? away : null;
  const teamName = team?.name ?? null;
  const announcement = signalAnnouncement({
    title: signal.title,
    teamName,
    playerName: signal.playerName,
    playerOff: signal.playerOff,
    playerOn: signal.playerOn,
  });

  const isTmo =
    signal.kind === "tmo_review" ||
    signal.kind === "tmo_decision" ||
    signal.kind === "tmo_overturned";

  const playerLabel =
    signal.playerName && signal.jerseyNumber != null
      ? `#${signal.jerseyNumber} ${signal.playerName}`
      : signal.playerName;

  return (
    <div
      className={`pr-ma-signal${isTmo ? " pr-ma-signal--tmo" : ""}${signal.kind === "tmo_overturned" ? " pr-ma-signal--overturned" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{announcement}</span>
      {isTmo ? (
        <span className="pr-ma-signal__tv" aria-hidden>
          TV
        </span>
      ) : null}
      {signal.playerImageUrl && signal.kind !== "substitution" ? (
        <span className="pr-ma-signal__player-photo" aria-hidden>
          <MediaImage
            src={signal.playerImageUrl}
            alt=""
            width={48}
            height={48}
            className="pr-ma-signal__player-img"
          />
          {signal.jerseyNumber != null ? (
            <span className="pr-ma-signal__jersey">{signal.jerseyNumber}</span>
          ) : null}
        </span>
      ) : team ? (
        <span
          className="pr-ma-signal__crest"
          style={{ ["--ma-colour" as string]: team.colour }}
          aria-hidden
        >
          <TeamCrest name={team.name} imageUrl={team.imageUrl} size="md" labelled />
        </span>
      ) : null}
      <p className="pr-ma-signal__title" aria-hidden>
        {signal.title}
      </p>
      {signal.kind === "injury" ? (
        <span className="pr-ma-signal__injury" aria-hidden>
          ✚
        </span>
      ) : null}
      {team ? (
        <p className="pr-ma-signal__team" aria-hidden style={{ color: team.colour }}>
          {team.shortName}
        </p>
      ) : null}
      {signal.detail ? (
        <p className="pr-ma-signal__detail" aria-hidden>
          {signal.detail}
        </p>
      ) : null}
      {signal.kind === "substitution" ? (
        <div className="pr-ma-signal__sub" aria-hidden>
          {signal.playerOn ? (
            <p>
              {signal.playerOn} <span className="pr-ma-signal__sub-label">On</span>
            </p>
          ) : null}
          {signal.playerOff ? (
            <p>
              {signal.playerOff} <span className="pr-ma-signal__sub-label">Off</span>
            </p>
          ) : null}
        </div>
      ) : playerLabel && signal.kind !== "generic" ? (
        <p className="pr-ma-signal__player" aria-hidden>
          {playerLabel}
        </p>
      ) : null}
      {playerStatChips.length > 0 && signal.kind !== "substitution" ? (
        <div className="pr-ma-signal__stats" aria-hidden>
          <MatchAnimationPlayerStatChips chips={playerStatChips} title="Player match stats" />
        </div>
      ) : null}
    </div>
  );
}
