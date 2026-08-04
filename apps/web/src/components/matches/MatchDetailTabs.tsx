"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { matchDetailTabHref } from "@/lib/match-detail-tabs";
import { PUBLIC_MATCH_TAB_ORDER } from "@/lib/match-animation-availability";

const TAB_LABELS: Record<(typeof PUBLIC_MATCH_TAB_ORDER)[number], string> = {
  details: "Details",
  animation: "Animations",
  audio: "Audio",
  watchalong: "Watchalong",
  highlights: "Highlights",
  stats: "Team",
  "player-stats": "Player",
  lineups: "Line Up",
  tables: "Tables",
  "head-to-head": "H2H",
  betting: "Betting",
};

export function MatchDetailTabs({
  activeTab,
  hasWatchalong = false,
  hasHighlights = false,
}: {
  activeTab: MatchDetailTab;
  /** @deprecated Unused — badges removed from tab bar. Kept optional for call-site compat. */
  animationBadge?: unknown;
  /** @deprecated Unused — Live badge removed from Audio tab. */
  animationAudioReady?: boolean;
  hasWatchalong?: boolean;
  hasHighlights?: boolean;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTab]);

  return (
    <nav className="match-detail-tabs" aria-label="Match sections" ref={navRef}>
      {PUBLIC_MATCH_TAB_ORDER.filter((tabId) => {
        // YouTube tabs only appear once their CMS field is set.
        if (tabId === "highlights") return hasHighlights;
        if (tabId === "watchalong") return hasWatchalong;
        return true;
      }).map((tabId) => {
        const href = matchDetailTabHref(pathname, tabId);
        const isActive = activeTab === tabId;
        return (
          <Link
            key={tabId}
            href={href}
            ref={isActive ? activeRef : undefined}
            className={`match-detail-tabs__tab${isActive ? " match-detail-tabs__tab--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="match-detail-tabs__label">{TAB_LABELS[tabId]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
