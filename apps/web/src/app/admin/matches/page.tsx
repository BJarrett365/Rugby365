"use client";

import Link from "next/link";
import { Suspense } from "react";
import { MatchesCmsList } from "@/components/admin/MatchesCmsList";
import { PageHeader } from "@/components/shell/PageHeader";

function MatchesAdminInner() {
  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Matches"
        description="CMS match list with filters, grouping and provider status."
        actions={
          <div className="matches-page-actions no-print">
            <span
              className="cms-btn cms-btn--secondary matches-page-actions__cms touch-target"
              aria-current="page"
            >
              CMS
            </span>
            <Link href="/matches" className="cms-btn cms-btn--secondary touch-target">
              Public view
            </Link>
            <Link href="/admin/matches/new" className="cms-btn cms-btn--primary touch-target">
              New match
            </Link>
          </div>
        }
      />

      <MatchesCmsList />
    </>
  );
}

export default function MatchesAdminPage() {
  return (
    <Suspense fallback={<p className="match-cms-muted text-sm">Loading matches…</p>}>
      <MatchesAdminInner />
    </Suspense>
  );
}
