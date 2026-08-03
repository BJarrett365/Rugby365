"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type MatchCmsSection =
  | "info"
  | "lineups"
  | "stats"
  | "player-stats"
  | "events"
  | "channels"
  | "media"
  | "animation"
  | "h2h"
  | "sources"
  | "commentary"
  | "audio";

const SECTIONS: Array<{ id: MatchCmsSection; label: string; path: string }> = [
  { id: "info", label: "Match Info", path: "edit" },
  { id: "lineups", label: "Lineups", path: "lineups" },
  { id: "stats", label: "Match Stats", path: "stats" },
  { id: "player-stats", label: "Player Stats", path: "player-stats" },
  { id: "events", label: "Events / Comment", path: "events" },
  { id: "channels", label: "Match Channels", path: "channels" },
  { id: "media", label: "YouTube Media", path: "media" },
  { id: "animation", label: "Animation", path: "animation" },
  { id: "h2h", label: "Head to Head", path: "h2h" },
  { id: "sources", label: "Sources", path: "sources" },
  { id: "commentary", label: "Live Commentary", path: "commentary" },
  { id: "audio", label: "Audio", path: "audio" },
];

export function matchCmsSectionHref(matchId: string, section: MatchCmsSection): string {
  const row = SECTIONS.find((s) => s.id === section);
  return `/admin/matches/${matchId}/${row?.path ?? "edit"}`;
}

/** Horizontal section nav for SportCC-style match CMS pages. */
export function MatchCmsSubnav({
  matchId,
}: {
  matchId: string;
  /** Kept for callers; all sections use admin routes. */
  slug?: string | null;
}) {
  const pathname = usePathname();

  return (
    <nav className="match-cms-subnav" aria-label="Match CMS sections">
      {SECTIONS.map((section) => {
        const href = `/admin/matches/${matchId}/${section.path}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={section.id}
            href={href}
            className={`match-cms-subnav__link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
