"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TableLabMetaPanel, TableLabResultsTable } from "@/components/admin/TableLabPanels";
import { PageHeader } from "@/components/shell/PageHeader";
import type { RugbyTableDefinition, RugbyTableResult } from "@/lib/table-lab/table-types";

export default function TableLabBuildPage() {
  const [definitions, setDefinitions] = useState<RugbyTableDefinition[]>([]);
  const [tableId, setTableId] = useState("form_table");
  const [seasonId, setSeasonId] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarYear, setCalendarYear] = useState("");
  const [formMatchCount, setFormMatchCount] = useState("5");
  const [result, setResult] = useState<RugbyTableResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tables/definitions").then((r) => r.json()),
      fetch("/api/admin/tables/seasons").then((r) => r.json()),
    ])
      .then(([defs, seasonData]) => {
        setDefinitions(defs.definitions ?? []);
        const active = (seasonData.seasons ?? []).find((row: { isActive?: boolean }) => row.isActive);
        setSeasonId(active?.id ?? seasonData.seasons?.[0]?.id ?? "");
      })
      .catch(() => undefined);
  }, []);

  async function build(e: React.FormEvent) {
    e.preventDefault();
    setBuilding(true);
    setError("");
    const res = await fetch("/api/admin/tables/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId,
        context: {
          seasonId: seasonId || undefined,
          asOfDate: asOfDate || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          calendarYear: calendarYear ? Number(calendarYear) : undefined,
          formMatchCount: formMatchCount ? Number(formMatchCount) : undefined,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Build failed");
    else setResult(data);
    setBuilding(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Table Lab"
        title="Build table"
        description="Configure season, date range and form depth, then generate a rugby-specific table from real CMS data."
        actions={
          <Link href="/admin/tables/view" className="cms-btn cms-btn--secondary">
            View tables
          </Link>
        }
      />

      <form onSubmit={build} className="cms-card mb-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="block text-zinc-500 mb-1">Table type</span>
          <select
            className="cms-input w-full"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          >
            {definitions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Season</span>
          <input className="cms-input w-full" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} placeholder="Season UUID" />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Form matches</span>
          <input className="cms-input w-full" value={formMatchCount} onChange={(e) => setFormMatchCount(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">As of date</span>
          <input type="date" className="cms-input w-full" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Calendar year</span>
          <input className="cms-input w-full" value={calendarYear} onChange={(e) => setCalendarYear(e.target.value)} placeholder="2026" />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">From</span>
          <input type="date" className="cms-input w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">To</span>
          <input type="date" className="cms-input w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={building} className="cms-btn cms-btn--primary">
            {building ? "Building…" : "Build table"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-400 mb-4">{error}</p> : null}
      {result ? (
        <>
          <TableLabMetaPanel result={result} />
          <TableLabResultsTable result={result} />
        </>
      ) : null}
    </>
  );
}
