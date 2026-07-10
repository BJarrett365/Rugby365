"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FixturesScheduleBoard } from "@/components/matches/FixturesScheduleBoard";
import { PageHeader } from "@/components/shell/PageHeader";

export default function MatchesAdminPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDelete = useCallback(async (id: string, label: string) => {
    if (!confirm(`Delete match “${label}”? This removes events and commentary too.`)) return;
    const res = await fetch(`/api/admin/matches/${id}`, { method: "DELETE" });
    if (res.ok) setRefreshKey((k) => k + 1);
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Matches"
        description="Live fixtures from Planet Rugby SDMS, merged with CMS imports."
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Link href="/matches" className="cms-btn cms-btn--secondary touch-target">
              Public view
            </Link>
            <Link href="/admin/matches/import" className="cms-btn cms-btn--secondary touch-target">
              Import
            </Link>
            <Link href="/admin/venues/map-fixtures" className="cms-btn cms-btn--secondary touch-target">
              Map venues
            </Link>
            <Link href="/admin/matches/new" className="cms-btn cms-btn--primary touch-target">
              New match
            </Link>
          </div>
        }
      />

      <FixturesScheduleBoard key={refreshKey} admin onDelete={handleDelete} />
    </>
  );
}
