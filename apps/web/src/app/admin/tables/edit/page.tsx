"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type { RugbyTableDefinition } from "@/lib/table-lab/table-types";

export default function TableLabEditPage() {
  const [definitions, setDefinitions] = useState<RugbyTableDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("full_table");

  useEffect(() => {
    fetch("/api/admin/tables/definitions")
      .then((r) => r.json())
      .then((data) => {
        setDefinitions(data.definitions ?? []);
      })
      .catch(() => undefined);
  }, []);

  const selected = definitions.find((row) => row.id === selectedId) ?? definitions[0];

  return (
    <>
      <PageHeader
        eyebrow="Table Lab"
        title="Edit table config"
        description="Review rugby table definitions, calculation methods and required data sources."
        actions={
          <Link href="/admin/tables/build" className="cms-btn cms-btn--secondary">
            Build table
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="cms-card max-h-[70vh] overflow-y-auto">
          <h2 className="text-sm font-semibold m-0 mb-3">Table types</h2>
          <ul className="space-y-1 m-0 p-0 list-none">
            {definitions.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full text-left rounded px-2 py-1.5 text-sm ${
                    row.id === selected?.id
                      ? "bg-emerald-950 text-emerald-300"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected ? (
          <div className="cms-card">
            <h2 className="text-lg font-semibold m-0">{selected.label}</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-4 capitalize">
              {selected.category.replaceAll("_", " ")}
            </p>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-zinc-500">Explanation</dt>
                <dd className="m-0 text-zinc-300">{selected.explanation}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{selected.calculationMethod}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Required data</dt>
                <dd className="m-0 text-zinc-300">
                  {selected.requiredData.map((item) => item.replaceAll("_", " ")).join(", ")}
                </dd>
              </div>
              {selected.metricLabel ? (
                <div>
                  <dt className="text-zinc-500">Primary metric column</dt>
                  <dd className="m-0 text-zinc-300">{selected.metricLabel}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </div>
    </>
  );
}
