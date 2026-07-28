"use client";

import type { AttackDirection } from "@/lib/match-animation-insight";

type Props = {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  clockLabel: string;
  /** e.g. LIVE, FT, REPLAY */
  statusHint?: string | null;
  progressPercent?: number;
  /** Which way each team is attacking on the pitch diagram. */
  homeAttackDirection?: AttackDirection | null;
  awayAttackDirection?: AttackDirection | null;
};

function DirectionArrow({ dir }: { dir: AttackDirection }) {
  return (
    <span className="pr-ma-board__dir" aria-hidden title={dir === "right" ? "Attacks right" : "Attacks left"}>
      {dir === "right" ? "→" : "←"}
    </span>
  );
}

/** Broadcast-style scoreboard + match clock above the pitch. */
export function MatchAnimationScoreboard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  clockLabel,
  statusHint,
  progressPercent,
  homeAttackDirection = null,
  awayAttackDirection = null,
}: Props) {
  const pct = Math.min(100, Math.max(0, progressPercent ?? 0));

  return (
    <div className="pr-ma-board" aria-label="Match scoreboard">
      <div className="pr-ma-board__row">
        <span className="pr-ma-board__team pr-ma-board__team--home">
          {homeAttackDirection ? <DirectionArrow dir={homeAttackDirection} /> : null}
          {homeName}
        </span>
        <span className="pr-ma-board__scores" aria-live="polite">
          <span className="pr-ma-board__score">{homeScore}</span>
          <span className="pr-ma-board__sep" aria-hidden>
            –
          </span>
          <span className="pr-ma-board__score">{awayScore}</span>
        </span>
        <span className="pr-ma-board__team pr-ma-board__team--away">
          {awayName}
          {awayAttackDirection ? <DirectionArrow dir={awayAttackDirection} /> : null}
        </span>
      </div>
      <div className="pr-ma-board__progress" aria-hidden>
        <span className="pr-ma-board__progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pr-ma-board__clock-wrap">
        <span className="pr-ma-board__clock" aria-live="polite" aria-atomic="true">
          {clockLabel}
        </span>
        {statusHint ? <span className="pr-ma-board__hint">{statusHint}</span> : null}
      </div>
    </div>
  );
}
