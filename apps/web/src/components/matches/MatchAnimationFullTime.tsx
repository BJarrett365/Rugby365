"use client";

import Link from "next/link";
import { TeamCrest } from "./TeamCrest";
import { MediaImage } from "@/components/media/MediaImage";
import type { MatchAnimationPublicPayload } from "@/lib/match-animation-types";
import {
  fullTimeAnnouncement,
  fullTimeHeadline,
} from "@/lib/match-animation-fulltime";

type Props = {
  payload: MatchAnimationPublicPayload;
  detailsHref: string;
  reducedMotion?: boolean;
  animating?: boolean;
  onReplayMatch: () => void;
  onKeyMoments: () => void;
  speed: number;
  onSpeed: (n: 1 | 2 | 5 | 10) => void;
};

const SPEEDS = [1, 2, 5, 10] as const;

/** Professional full-time result screen — scores from CMS fixture only. */
export function MatchAnimationFullTime({
  payload,
  detailsHref,
  reducedMotion = false,
  animating = true,
  onReplayMatch,
  onKeyMoments,
  speed,
  onSpeed,
}: Props) {
  const { home, away, availability } = payload;
  const headline = fullTimeHeadline(payload.resultKind);
  const announcement = fullTimeAnnouncement({
    homeName: home.name,
    awayName: away.name,
    homeScore: payload.homeScore,
    awayScore: payload.awayScore,
    kind: payload.resultKind,
  });

  const metaBits = [
    payload.venueName,
    payload.competitionName,
    payload.round
      ? /^round\b/i.test(payload.round.trim())
        ? payload.round.trim()
        : `Round ${payload.round.trim()}`
      : null,
    payload.matchDateLabel,
    payload.attendance != null ? `Attendance ${payload.attendance.toLocaleString("en-GB")}` : null,
  ].filter(Boolean);

  return (
    <div
      className={`pr-ma-ft${animating && !reducedMotion ? " pr-ma-ft--animating" : ""}${reducedMotion ? " pr-ma-ft--reduced" : ""}`}
    >
      <p className="pr-ma-ft__headline" aria-hidden>
        {headline}
      </p>
      <p className="pr-ma-ft__comp" aria-hidden>
        {payload.competitionName}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="pr-ma-ft__badges">
        <div className="pr-ma-ft__side pr-ma-ft__side--home">
          <span className="pr-ma-ft__crest" style={{ ["--ma-colour" as string]: home.colour }}>
            <TeamCrest name={home.name} imageUrl={home.imageUrl} size="lg" labelled />
          </span>
          <span className="pr-ma-ft__name">{home.name}</span>
        </div>
        <div className="pr-ma-ft__score" aria-hidden>
          <strong>
            {payload.homeScore} – {payload.awayScore}
          </strong>
        </div>
        <div className="pr-ma-ft__side pr-ma-ft__side--away">
          <span className="pr-ma-ft__crest" style={{ ["--ma-colour" as string]: away.colour }}>
            <TeamCrest name={away.name} imageUrl={away.imageUrl} size="lg" labelled />
          </span>
          <span className="pr-ma-ft__name">{away.name}</span>
        </div>
      </div>

      {payload.halfTimeHome != null && payload.halfTimeAway != null ? (
        <p className="pr-ma-ft__ht">
          Half-time {payload.halfTimeHome} – {payload.halfTimeAway}
        </p>
      ) : null}

      {metaBits.length > 0 ? <p className="pr-ma-ft__meta">{metaBits.join(" · ")}</p> : null}

      {payload.playerOfTheMatch ? (
        <div className="pr-ma-ft__potm">
          {payload.playerOfTheMatchImageUrl ? (
            <MediaImage
              src={payload.playerOfTheMatchImageUrl}
              alt=""
              width={56}
              height={56}
              className="pr-ma-ft__potm-photo"
            />
          ) : null}
          <p>
            Man of the Match: <strong>{payload.playerOfTheMatch}</strong>
          </p>
        </div>
      ) : null}

      {payload.refereeName ? <p className="pr-ma-ft__ref">Referee: {payload.refereeName}</p> : null}

      <div className="pr-ma-ft__controls" role="group" aria-label="Full-time controls">
        {availability.showReplayControls ? (
          <>
            <button type="button" className="pr-ma-btn pr-ma-btn--primary" onClick={onReplayMatch}>
              Replay Match
            </button>
            <button type="button" className="pr-ma-btn" onClick={onKeyMoments}>
              Key Moments
            </button>
            <div className="pr-ma-speeds" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pr-ma-btn pr-ma-btn--speed${speed === s ? " is-active" : ""}`}
                  onClick={() => onSpeed(s)}
                  aria-pressed={speed === s}
                >
                  {s}×
                </button>
              ))}
            </div>
          </>
        ) : null}
        <Link href={detailsHref} className="pr-ma-btn">
          Match Details
        </Link>
        <Link href={`${detailsHref}?tab=stats`} className="pr-ma-btn">
          Team Stats
        </Link>
        <Link href={`${detailsHref}?tab=player-stats`} className="pr-ma-btn">
          Player Stats
        </Link>
        <Link href={`${detailsHref}?tab=lineups`} className="pr-ma-btn">
          Line-ups
        </Link>
      </div>
    </div>
  );
}
