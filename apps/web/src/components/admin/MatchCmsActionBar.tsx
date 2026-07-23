"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  IconChart,
  IconChat,
  IconLink,
  IconPitch,
  IconTrend,
  IconUsers,
} from "@/components/admin/MatchCmsIcons";

type Action = {
  label: string;
  href: string;
  icon: ReactNode;
};

const iconBtn = "match-cms-icon-btn";

/** Dense icon action bar — tooltips via title + aria-label. */
export function MatchCmsActionBar({
  matchId,
  slug,
}: {
  matchId: string;
  slug?: string | null;
}) {
  const edit = (hash: string) => `/admin/matches/${matchId}/edit${hash}`;
  const actions: Action[] = [
    { label: "Lineups", href: edit("#lineups"), icon: <IconUsers /> },
    { label: "Match stats", href: edit("#team-stats"), icon: <IconChart /> },
    { label: "Player stats", href: edit("#player-stats"), icon: <IconTrend /> },
    { label: "Events", href: edit("#events"), icon: <IconPitch /> },
    {
      label: "Commentary",
      href: slug ? `/matches/${slug}/commentary` : edit("#commentary"),
      icon: <IconChat />,
    },
    { label: "Sources", href: edit("#sources"), icon: <IconLink /> },
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
