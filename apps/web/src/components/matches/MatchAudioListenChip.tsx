"use client";

import { MatchHeaderMediaActions } from "./MatchHeaderMediaActions";

/** @deprecated Prefer MatchHeaderMediaActions — kept for Listen-only callers. */
export function MatchAudioListenChip({
  scriptsReady,
  scriptCount = 0,
}: {
  scriptsReady: boolean;
  scriptCount?: number;
}) {
  if (!scriptsReady) return null;
  return (
    <MatchHeaderMediaActions
      audioReady
      scriptCount={scriptCount}
      hasAnimation={false}
      hasWatchalong={false}
      hasHighlights={false}
    />
  );
}
