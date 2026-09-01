"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FixturesScheduleBoard } from "@/components/matches/FixturesScheduleBoard";
import { PublicFixturesTabs } from "@/components/matches/PublicFixturesTabs";

/** Public Live Centre — scores, fixtures and match schedule. */
export default function MatchesPage() {
  return (
    <Suspense
      fallback={
        <div className="pr-mc-fixtures-page">
          <p className="text-zinc-500 text-sm py-8 text-center">Loading fixtures…</p>
        </div>
      }
    >
      <MatchesPageInner />
    </Suspense>
  );
}

function MatchesPageInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "results" ? "results" : "fixtures";

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

      <PublicFixturesTabs active={view} />

      <FixturesScheduleBoard variant="public" view={view} />
    </div>
  );
}
