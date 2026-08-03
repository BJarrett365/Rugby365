"use client";

import Link from "next/link";
import { FixturesScheduleBoard } from "@/components/matches/FixturesScheduleBoard";
import { PublicFixturesTabs } from "@/components/matches/PublicFixturesTabs";

/** Public Live Centre — scores, fixtures and match schedule. */
export default function MatchesPage() {
  return (
    <div className="pr-mc-fixtures-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Live Centre</Link>
        <span className="pr-mc-breadcrumbs__sep" aria-hidden>
          ›
        </span>
        <span className="pr-mc-breadcrumbs__current">Scores &amp; Fixtures</span>
      </nav>

      <header className="pr-mc-fixtures-page__header">
        <div className="pr-mc-fixtures-page__title-row">
          <h1 className="pr-mc-fixtures-page__title">Live Centre</h1>
          <span className="pr-mc-pr-badge" title="Planet Rugby" aria-hidden>
            PR
          </span>
        </div>
        <Link href="/admin/matches" className="pr-mc-fixtures-page__manage no-print">
          Manage matches
        </Link>
      </header>

      <PublicFixturesTabs active="fixtures" />

      <FixturesScheduleBoard variant="public" />
    </div>
  );
}
