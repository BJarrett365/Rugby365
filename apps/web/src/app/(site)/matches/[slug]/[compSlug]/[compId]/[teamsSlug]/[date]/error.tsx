"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MatchDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[match-detail]", error);
  }, [error]);

  return (
    <div className="pr-match-centre match-detail">
      <nav aria-label="Breadcrumb">
        <ol className="pr-mc-breadcrumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li>
            <Link href="/matches">Scores &amp; Fixtures</Link>
          </li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li className="pr-mc-breadcrumbs__current">Match unavailable</li>
        </ol>
      </nav>
      <div className="pr-mc-shell">
        <div className="pr-mc-main">
          <header className="pr-mc-header">
            <h1 className="pr-mc-header__title">Couldn&apos;t load this match</h1>
            <p style={{ color: "var(--pr-mc-grey, #a7adac)", margin: "0.75rem 0 1rem" }}>
              The match centre hit a temporary error. Try again, or go back to fixtures.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" className="pr-mc-fixtures-page__manage" onClick={() => reset()}>
                Try again
              </button>
              <Link href="/matches" className="pr-mc-fixtures-page__manage">
                Back to fixtures
              </Link>
            </div>
          </header>
        </div>
      </div>
    </div>
  );
}
