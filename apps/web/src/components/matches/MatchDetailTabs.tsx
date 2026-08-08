"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";
import { matchDetailTabHref } from "@/lib/match-detail-tabs";
import {
  PUBLIC_MATCH_TAB_ORDER,
  visiblePublicMatchTabs,
  type PublicMatchMediaVisibility,
} from "@/lib/match-animation-availability";

const TAB_LABELS: Record<(typeof PUBLIC_MATCH_TAB_ORDER)[number], string> = {
  details: "Details",
  animation: "Animations",
  audio: "Audio",
  "data-commentary": "Live Commentary",
  watchalong: "Watchalong",
  highlights: "Highlights",
  stats: "Team",
  "player-stats": "Player",
  lineups: "Line Up",
  tables: "Tables",
  "head-to-head": "H2H",
  betting: "Betting",
};

const HIDDEN_BY_DEFAULT: PublicMatchMediaVisibility = {
  animation: false,
  audio: false,
  commentary: false,
  watchalong: false,
  highlights: false,
};

export function MatchDetailTabs({
  activeTab,
  mediaVisibility = HIDDEN_BY_DEFAULT,
}: {
  activeTab: MatchDetailTab;
  /** Only show Audio / Animations / Commentary / Watchalong / Highlights when activated. */
  mediaVisibility?: PublicMatchMediaVisibility;
  /** @deprecated Unused — badges removed from tab bar. Kept optional for call-site compat. */
  animationBadge?: unknown;
  /** @deprecated Unused — Live badge removed from Audio tab. */
  animationAudioReady?: boolean;
  /** @deprecated Prefer mediaVisibility.watchalong */
  hasWatchalong?: boolean;
  /** @deprecated Prefer mediaVisibility.highlights */
  hasHighlights?: boolean;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const tabs = visiblePublicMatchTabs(mediaVisibility);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTab]);

  return (
    <nav className="match-detail-tabs" aria-label="Match sections" ref={navRef}>
      {tabs.map((tabId) => {
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
