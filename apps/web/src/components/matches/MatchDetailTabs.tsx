"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { matchDetailTabHref } from "@/lib/match-detail-tabs";
import type { MatchAnimationTabBadge } from "@/lib/match-animation-availability";
import { PUBLIC_MATCH_TAB_ORDER } from "@/lib/match-animation-availability";

const TAB_LABELS: Record<(typeof PUBLIC_MATCH_TAB_ORDER)[number], string> = {
  details: "Match Details",
  animation: "Animation",
  watchalong: "Watchalong",
  highlights: "Highlights",
  stats: "Team Stats",
  "player-stats": "Player Stats",
  lineups: "Line-ups",
  tables: "Tables",
  "head-to-head": "Head-to-Head",
};

export function MatchDetailTabs({
  activeTab,
  animationBadge = null,
  hasWatchalong = false,
  hasHighlights = false,
}: {
  activeTab: MatchDetailTab;
  animationBadge?: MatchAnimationTabBadge;
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
        const badge = tabId === "animation" ? animationBadge : null;
        const badgeClass = badge ? badge.toLowerCase() : "";
        return (
          <Link
            key={tabId}
            href={href}
            ref={isActive ? activeRef : undefined}
            className={`match-detail-tabs__tab${isActive ? " match-detail-tabs__tab--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="match-detail-tabs__label">{TAB_LABELS[tabId]}</span>
            {badge ? (
              <span className={`match-detail-tabs__badge match-detail-tabs__badge--${badgeClass}`}>
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
