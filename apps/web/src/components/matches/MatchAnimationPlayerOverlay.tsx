"use client";

import type { CSSProperties } from "react";
import { RugbyPlayerSprite } from "./RugbyPlayerSprite";
import {
  resolveRugbySpriteState,
  shirtSurname,
  type RugbySpriteState,
} from "@/lib/match-animation-sprite-state";

export function MatchAnimationPlayerOverlay({
  ballX,
  ballY,
  eventType,
  signalKind,
  frontGoalView,
  conversionFlight,
  possession,
  facing,
  shirtColor,
  shirtAccent,
  playerName,
  jerseyNumber,
  placement,
  forceState,
}: {
  ballX: number;
  ballY: number;
  eventType?: string | null;
  signalKind?: string | null;
  frontGoalView?: string | null;
  conversionFlight?: "idle" | "kicking" | "success" | "miss" | null;
  possession: "home" | "away" | "neutral";
  facing: "left" | "right";
  shirtColor: string;
  shirtAccent?: string | null;
  playerName?: string | null;
  jerseyNumber?: number | null;
  placement: "pitch" | "goal";
  /** Override pose (e.g. celebrate for player of the match on FT). */
  forceState?: RugbySpriteState | null;
}) {
  const state: RugbySpriteState =
    forceState ??
    resolveRugbySpriteState({
      eventType,
      signalKind,
      conversionFlight,
      frontGoalView,
    });
  const bx = Math.min(96, Math.max(4, ballX));
  const by = Math.min(92, Math.max(8, ballY));
  // Keep the full figure on the pitch: feet near the ball, but never hang off the touchlines.
  const clampX = Math.min(88, Math.max(12, bx));
  const minTop = 36;
  const clampY = Math.min(94, Math.max(minTop, by));
  const showBall = placement === "pitch" && state !== "goal" && state !== "celebrate";
  /** Anchor player feet near the ball without clipping off the pitch wrap. */
  const anchorShift =
    placement === "goal" ? "-78%" : by <= 22 ? "-18%" : by >= 78 ? "-94%" : "-88%";

  const style =
    placement === "goal"
      ? ({ ["--pr-ma-player-shift" as string]: anchorShift } as CSSProperties)
      : ({
          left: `${clampX}%`,
          top: `${clampY}%`,
          ["--pr-ma-player-shift" as string]: anchorShift,
        } as CSSProperties);

  return (
    <div
      className={placement === "goal" ? "pr-ma-player pr-ma-player--goal" : "pr-ma-player"}
      style={style}
    >
      <RugbyPlayerSprite
        state={state}
        shirtColor={shirtColor}
        shirtAccent={shirtAccent}
        shirtName={shirtSurname(playerName)}
        shirtNumber={jerseyNumber}
        facing={facing}
        showBall={showBall}
        label={playerName ? `${playerName} on the pitch` : "Rugby player on the pitch"}
      />
    </div>
  );
}
