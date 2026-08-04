"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { suffix: "/fixtures", label: "Fixtures" },
  { suffix: "/results", label: "Results" },
  { suffix: "/table", label: "Table" },
  { suffix: "/stats", label: "Player stats" },
  { suffix: "/team-stats", label: "Team stats" },
  { suffix: "/team-of-the-week", label: "Team of the Week" },
  { suffix: "/compare", label: "Compare players" },
  { suffix: "/compare-teams", label: "Compare teams" },
  { suffix: "/rankings", label: "Rankings" },
] as const;

export function CompetitionNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/competitions/${slug}`;

  return (
    <nav className="competition-nav" aria-label="Competition sections">
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.suffix}
            href={href}
            className={`competition-nav__link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
