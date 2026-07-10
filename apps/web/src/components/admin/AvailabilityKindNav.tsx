"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const OPTIONS = [
  { href: "/admin/availability/injuries", label: "Injuries" },
  { href: "/admin/availability/suspensions", label: "Suspensions" },
] as const;

export function AvailabilityKindNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {OPTIONS.map((option) => {
        const active = pathname === option.href || pathname.startsWith(`${option.href}/`);
        return (
          <Link
            key={option.href}
            href={option.href}
            className={`cms-button text-sm ${active ? "" : "cms-button--secondary"}`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
