"use client";

import Link from "next/link";
import type { ClubTransferAuditReport } from "@/lib/transfer-club-audit-service";

function AuditList({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: string;
  rows: ClubTransferAuditReport["currentSquad"];
}) {
  return (
    <div className="rounded border border-zinc-800 p-3">
      <div className="flex items-center gap-2 mb-2">
        <h4 className={`text-sm font-medium m-0 ${tone}`}>{title}</h4>
        <span className="text-xs text-zinc-500">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600 m-0">None</p>
      ) : (
        <ul className="text-sm space-y-1 m-0 p-0 list-none">
          {rows.map((row) => (
            <li key={row.id} className="text-zinc-300">
              <Link href={`/admin/players/${row.id}/edit`} className="text-emerald-400">
                {row.name}
              </Link>
              {row.transferSource ? (
                <span className="text-zinc-500"> · {row.transferSource}</span>
              ) : null}
              {row.sourceConfidence ? (
                <span className="text-zinc-600"> ({row.sourceConfidence})</span>
              ) : null}
              {row.detail ? <span className="block text-xs text-zinc-600">{row.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  report: ClubTransferAuditReport | null;
  loading: boolean;
  error: string;
};

export function TransferClubAuditPanel({ report, loading, error }: Props) {
  if (loading) return <p className="text-sm text-zinc-500">Loading club audit…</p>;
  if (error) return <p className="text-sm text-red-400 m-0">{error}</p>;
  if (!report) {
    return (
      <p className="text-sm text-zinc-500 m-0">
        Select a club and season to audit current squad against transfer records.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 m-0">
        {report.teamName} · {report.seasonLabel} · {report.competitionName}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <AuditList title="Current squad" tone="text-emerald-300" rows={report.currentSquad} />
        <AuditList title="Transfers in" tone="text-sky-300" rows={report.transfersIn} />
        <AuditList title="Transfers out" tone="text-amber-300" rows={report.transfersOut} />
        <AuditList title="No transfer record" tone="text-orange-300" rows={report.noTransferRecord} />
        <AuditList title="Missing source" tone="text-violet-300" rows={report.missingSource} />
        <AuditList
          title="Conflicting current club"
          tone="text-red-300"
          rows={report.conflictingCurrentClub}
        />
      </div>
    </div>
  );
}
