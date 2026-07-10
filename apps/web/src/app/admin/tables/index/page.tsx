"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TABLE_LAB_CATEGORY_LABELS } from "@/lib/table-lab/table-lab-guide";
import type { RugbyTableDefinition } from "@/lib/table-lab/table-types";

function viewHref(tableId: string) {
  return `/admin/tables/view?type=${tableId.replace(/_/g, "-")}`;
}

export default function TableLabIndexPage() {
  const [definitions, setDefinitions] = useState<RugbyTableDefinition[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/tables/definitions")
      .then((r) => r.json())
      .then((data) => setDefinitions(data.definitions ?? []))
      .catch(() => undefined);
  }, []);

  const grouped = useMemo(() => {
    const filtered = definitions.filter((row) => {
      const haystack = `${row.label} ${row.id} ${row.explanation}`.toLowerCase();
      return !query.trim() || haystack.includes(query.trim().toLowerCase());
    });
    const byCategory = new Map<string, RugbyTableDefinition[]>();
    for (const row of filtered) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [definitions, query]);

  return (
    <>
      <PageHeader
        eyebrow="Table Lab"
        title="Table index"
        description="All rugby table types with quick links to view each one in Table Lab."
        actions={
          <>
            <Link href="/admin/tables/guide" className="cms-btn cms-btn--secondary">
              Guide
            </Link>
            <Link href="/admin/tables/view" className="cms-btn cms-btn--primary">
              View tables
            </Link>
          </>
        }
      />

      <div className="cms-card mb-4">
        <label className="text-sm block">
          <span className="block text-zinc-500 mb-1">Search table types</span>
          <input
            className="cms-input w-full max-w-md"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Full table, tries, hemisphere…"
          />
        </label>
        <p className="text-sm text-zinc-500 m-0 mt-3">
          {definitions.length} table types · {grouped.reduce((sum, [, rows]) => sum + rows.length, 0)} shown
        </p>
      </div>

      <div className="grid gap-4">
        {grouped.map(([category, rows]) => (
          <section key={category} className="cms-card">
            <h2 className="text-base font-semibold m-0 mb-3">
              {TABLE_LAB_CATEGORY_LABELS[category] ?? category.replaceAll("_", " ")}
            </h2>
            <ul className="m-0 p-0 list-none grid gap-2 sm:grid-cols-2">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={viewHref(row.id)}
                    className="block rounded-lg border border-zinc-800 px-3 py-2 hover:border-zinc-600 hover:bg-zinc-900/40"
                  >
                    <span className="font-medium text-zinc-100">{row.label}</span>
                    <span className="block text-xs text-zinc-500 mt-1 line-clamp-2">{row.explanation}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
