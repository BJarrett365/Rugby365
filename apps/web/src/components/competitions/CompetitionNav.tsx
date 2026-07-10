"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { suffix: "/fixtures", label: "Fixtures" },
  { suffix: "/results", label: "Results" },
  { suffix: "/table", label: "Table" },
] as const;

export function CompetitionNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/competitions/${slug}`;

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-zinc-800 mb-6"
      aria-label="Competition sections"
    >
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.suffix}
            href={href}
            className={`px-4 py-2 text-sm border-b-2 -mb-px touch-target ${
              active
                ? "border-emerald-500 text-emerald-400 font-medium"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
