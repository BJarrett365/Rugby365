"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import type { AuditFinding, AuditSection, DataHealthAuditReport } from "@/lib/data-audit-service";

function FindingList({ items, tone }: { items: AuditFinding[]; tone: "error" | "warning" | "info" }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">None</p>;
  }

  const toneClass =
    tone === "error" ? "border-red-900/50" : tone === "warning" ? "border-amber-900/50" : "border-zinc-800";

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.message}-${index}`} className={`rounded border ${toneClass} bg-zinc-950/60 p-3 text-sm`}>
          <p>{item.message}</p>
          {item.suggestedFix ? (
            <p className="mt-1 text-zinc-400">Suggested fix: {item.suggestedFix}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
            {item.recordCount != null ? <span>{item.recordCount} records</span> : null}
            {item.sourceSystem ? <span>Source: {item.sourceSystem}</span> : null}
            {item.lastSyncedAt ? <span>Last synced: {item.lastSyncedAt}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SectionPanel({ section }: { section: AuditSection }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{section.label}</h2>
        <div className="flex gap-3 text-xs text-zinc-400">
          {Object.entries(section.recordCounts).map(([key, value]) => (
            <span key={key}>
              {key}: {value}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-medium text-red-300">Errors ({section.errors.length})</h3>
          <FindingList items={section.errors} tone="error" />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-amber-300">Warnings ({section.warnings.length})</h3>
          <FindingList items={section.warnings} tone="warning" />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Info ({section.info.length})</h3>
          <FindingList items={section.info} tone="info" />
        </div>
      </div>
    </section>
  );
}

export default function DataAuditAdminPage() {
  const [report, setReport] = useState<DataHealthAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/data-audit");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data audit"
        description="Competition, season, team and player scoping health checks for selectors and imports."
        actions={
          <div className="flex gap-2">
            <button type="button" className="cms-button-secondary" onClick={() => load()} disabled={loading}>
              {loading ? "Running…" : "Re-run audit"}
            </button>
            <Link href="/admin/competitions" className="cms-button-secondary">
              Competitions
            </Link>
            <Link href="/admin/data-audit/squads" className="cms-button-secondary">
              Squad audit
            </Link>
          </div>
        }
      />

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded border border-zinc-800 p-3 text-sm">
              <div className="text-zinc-400">Generated</div>
              <div>{new Date(report.generatedAt).toLocaleString()}</div>
            </div>
            <div className="rounded border border-red-900/40 p-3 text-sm">
              <div className="text-red-300">Errors</div>
              <div className="text-2xl">{report.summary.errors}</div>
            </div>
            <div className="rounded border border-amber-900/40 p-3 text-sm">
              <div className="text-amber-300">Warnings</div>
              <div className="text-2xl">{report.summary.warnings}</div>
            </div>
            <div className="rounded border border-zinc-800 p-3 text-sm">
              <div className="text-zinc-400">Info</div>
              <div className="text-2xl">{report.summary.info}</div>
            </div>
          </div>

          <SectionPanel section={report.sections.competitions} />
          <SectionPanel section={report.sections.seasons} />
          <SectionPanel section={report.sections.teams} />
          <SectionPanel section={report.sections.players} />
          <SectionPanel section={report.sections.fixtures} />
          <SectionPanel section={report.sections.standings} />
          <SectionPanel section={report.sections.aliases} />
        </>
      ) : loading ? (
        <p className="text-sm text-zinc-400">Running data health audit…</p>
      ) : null}
    </div>
  );
}
