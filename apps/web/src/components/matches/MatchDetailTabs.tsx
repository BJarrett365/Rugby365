"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MatchDetailTab } from "@/lib/match-detail-tabs";

const TABS: { id: MatchDetailTab; label: string }[] = [
  { id: "details", label: "Match Details" },
  { id: "stats", label: "Stats" },
  { id: "lineups", label: "Lineups" },
  { id: "head-to-head", label: "Head-to-Head" },
  { id: "edit", label: "Edit" },
];

export function MatchDetailTabs({ activeTab }: { activeTab: MatchDetailTab }) {
  const pathname = usePathname();

  return (
    <nav className="match-detail-tabs" aria-label="Match sections">
      {TABS.map((tab) => {
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
