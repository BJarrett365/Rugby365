"use client";

import Link from "next/link";
import { FixturesScheduleBoard } from "@/components/matches/FixturesScheduleBoard";
import { PageHeader } from "@/components/shell/PageHeader";

export default function MatchesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Fixtures"
        title="Matches"
        description="Live fixtures and results — same SDMS feed as planetrugby.com/fixtures."
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Link href="/admin/matches" className="cms-btn cms-btn--secondary touch-target">
              Manage matches
            </Link>
            <Link href="/admin/tables" className="cms-btn cms-btn--secondary touch-target">
              Tables
            </Link>
          </div>
        }
      />
      <FixturesScheduleBoard />
    </>
  );
}
