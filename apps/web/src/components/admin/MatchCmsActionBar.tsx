"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  IconAnimation,
  IconChart,
  IconChat,
  IconLink,
  IconList,
  IconPencil,
  IconPitch,
  IconTrend,
  IconUsers,
  IconYoutube,
  IconTv,
} from "@/components/admin/MatchCmsIcons";
import { matchCmsSectionHref } from "@/components/admin/MatchCmsSubnav";

type Action = {
  label: string;
  href: string;
  icon: ReactNode;
};

const iconBtn = "match-cms-icon-btn";

/** Dense icon action bar — tooltips via title + aria-label. */
export function MatchCmsActionBar({
  matchId,
}: {
  matchId: string;
  /** Kept for callers; commentary opens the admin bridge page. */
  slug?: string | null;
}) {
  const actions: Action[] = [
    { label: "Match Info", href: matchCmsSectionHref(matchId, "info"), icon: <IconPencil /> },
    { label: "Lineups", href: matchCmsSectionHref(matchId, "lineups"), icon: <IconUsers /> },
    { label: "Match stats", href: matchCmsSectionHref(matchId, "stats"), icon: <IconChart /> },
    {
      label: "Player stats",
      href: matchCmsSectionHref(matchId, "player-stats"),
      icon: <IconTrend />,
    },
    { label: "Events", href: matchCmsSectionHref(matchId, "events"), icon: <IconPitch /> },
    { label: "Match Channels", href: matchCmsSectionHref(matchId, "channels"), icon: <IconTv /> },
    { label: "YouTube media", href: matchCmsSectionHref(matchId, "media"), icon: <IconYoutube /> },
    {
      label: "Match Animation",
      href: matchCmsSectionHref(matchId, "animation"),
      icon: <IconAnimation />,
    },
    { label: "Head to Head", href: matchCmsSectionHref(matchId, "h2h"), icon: <IconList /> },
    { label: "Sources", href: matchCmsSectionHref(matchId, "sources"), icon: <IconLink /> },
    {
      label: "Commentary",
      href: matchCmsSectionHref(matchId, "commentary"),
      icon: <IconChat />,
    },
  ];

  return (
    <div className="flex items-center gap-0.5 whitespace-nowrap" role="toolbar" aria-label="Match actions">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          title={action.label}
          aria-label={action.label}
          className={iconBtn}
        >
          {action.icon}
        </Link>
      ))}
    </div>
  );
}
