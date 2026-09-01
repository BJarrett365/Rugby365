"use client";

import Link from "next/link";

export type PublicFixturesTab = "fixtures" | "results" | "tables" | "transfers";

/** Shared Fixtures | Results | Tables | Transfers strip for Live Centre. */
export function PublicFixturesTabs({ active }: { active: PublicFixturesTab }) {
  const tab = (id: PublicFixturesTab, label: string, href: string | null) => {
    const isActive = active === id;
    if (isActive) {
      return (
        <span className="pr-mc-fixtures-tabs__tab pr-mc-fixtures-tabs__tab--active" aria-current="page">
          {label}
        </span>
      );
    }
    if (!href) {
      return (
        <span className="pr-mc-fixtures-tabs__tab" aria-disabled="true">
          {label}
        </span>
      );
    }
    return (
      <Link href={href} className="pr-mc-fixtures-tabs__tab">
        {label}
      </Link>
    );
  };

  return (
    <nav className="pr-mc-fixtures-tabs" aria-label="Fixtures sections">
      {tab("fixtures", "Fixtures", "/matches")}
      {tab("results", "Results", "/matches?view=results")}
      {tab("tables", "Tables", "/tables")}
      {tab("transfers", "Transfers", "/transfers")}
    </nav>
  );
}
