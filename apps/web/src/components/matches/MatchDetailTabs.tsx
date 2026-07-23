"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";

const PUBLIC_TABS: { id: MatchDetailTab; label: string }[] = [
  { id: "details", label: "Match Details" },
  { id: "stats", label: "Team Stats" },
  { id: "player-stats", label: "Player Stats" },
  { id: "lineups", label: "Lineups" },
  { id: "tables", label: "Tables" },
  { id: "head-to-head", label: "Head-to-Head" },
];

export function MatchDetailTabs({ activeTab }: { activeTab: MatchDetailTab }) {
  const pathname = usePathname();

  return (
    <nav className="match-detail-tabs" aria-label="Match sections">
      {PUBLIC_TABS.map((tab) => {
        const href = tab.id === "details" ? pathname : `${pathname}?tab=${tab.id}`;
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`match-detail-tabs__tab${isActive ? " match-detail-tabs__tab--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
