"use client";

import Link from "next/link";

export type PublicFixturesTab = "fixtures" | "results" | "tables" | "transfers";

/** Shared Fixtures | Results | Tables | Transfers strip for Live Centre. */
export function PublicFixturesTabs({
  active,
  date,
}: {
  active: PublicFixturesTab;
  /** Preserve selected calendar day across Fixtures / Results. */
  date?: string | null;
}) {
  const withDate = (href: string) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return href;
    const url = new URL(href, "https://example.invalid");
    url.searchParams.set("date", date);
    return `${url.pathname}${url.search}`;
  };

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
      {tab("fixtures", "Fixtures", withDate("/matches"))}
      {tab("results", "Results", withDate("/matches?view=results"))}
      {tab("tables", "Tables", "/tables")}
      {tab("transfers", "Transfers", "/transfers")}
    </nav>
  );
}
