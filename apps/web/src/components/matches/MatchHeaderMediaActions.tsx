"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { matchDetailTabHref } from "@/lib/match-detail-tabs";
import { MatchMediaIcon, type MatchMediaIconVariant } from "./MatchMediaIcons";

type MediaAction = {
  tab: MatchDetailTab;
  label: string;
  title: string;
  variant: MatchMediaIconVariant;
  ready?: boolean;
  count?: number;
};

/**
 * Compact header media entry points — Listen / Animation / Watchalong / Highlights.
 * Only renders chips for media that is actually available.
 */
export function MatchHeaderMediaActions({
  audioReady,
  scriptCount = 0,
  hasAnimation,
  hasWatchalong,
  hasHighlights,
}: {
  audioReady: boolean;
  scriptCount?: number;
  hasAnimation: boolean;
  hasWatchalong: boolean;
  hasHighlights: boolean;
}) {
  const pathname = usePathname();

  const actions: MediaAction[] = [];

  if (audioReady) {
    actions.push({
      tab: "audio",
      label: "Listen · Audio",
      title: "Open Live Audio Commentary",
      variant: "listen",
      ready: true,
      count: scriptCount > 0 ? scriptCount : undefined,
    });
  }

  if (hasAnimation) {
    actions.push({
      tab: "animation",
      label: "Animation",
      title: "Open Match Animation",
      variant: "animation",
    });
  }

  if (hasWatchalong) {
    actions.push({
      tab: "watchalong",
      label: "Watchalong",
      title: "Open Watchalong",
      variant: "watchalong",
    });
  }

  if (hasHighlights) {
    actions.push({
      tab: "highlights",
      label: "Highlights",
      title: "Open Match Highlights",
      variant: "highlights",
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="pr-mc-header__media" role="navigation" aria-label="Match media">
      <div className="pr-mc-header__media-row">
        {actions.map((action) => (
          <Link
            key={action.tab}
            href={matchDetailTabHref(pathname, action.tab)}
            className={`pr-mc-media-chip pr-mc-media-chip--${action.variant}${
              action.ready ? " is-ready" : ""
            }`}
            title={action.title}
          >
            <MatchMediaIcon variant={action.variant} className="pr-mc-media-chip__icon" />
            <span className="pr-mc-media-chip__label">{action.label}</span>
            {action.count != null ? (
              <span className="pr-mc-media-chip__count">{action.count}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
