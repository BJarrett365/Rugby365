"use client";

import {
  transferAuditBadgeClass,
  transferAuditStatusLabel,
  transferConfidenceBadgeClass,
  type TransferAuditStatus,
} from "@/lib/transfer-audit-utils";
import type { TransferSourceConfidence } from "@/lib/transfer-source-utils";
import { transferSourceConfidenceLabel } from "@/lib/transfer-source-utils";

export function TransferAuditBadges({ statuses }: { statuses: TransferAuditStatus[] }) {
  if (!statuses.length) return <span className="text-zinc-600">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((status) => (
        <span
          key={status}
          className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border ${transferAuditBadgeClass(status)}`}
        >
          {transferAuditStatusLabel(status)}
        </span>
      ))}
    </div>
  );
}

export function TransferSourceCell({
  label,
  url,
  confidence,
}: {
  label: string;
  url: string | null;
  confidence: TransferSourceConfidence;
}) {
  return (
    <div className="space-y-1">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
          {label}
        </a>
      ) : (
        <span className="text-zinc-300">{label}</span>
      )}
      <div>
        <span
          className={`inline-flex text-[10px] px-1.5 py-0.5 rounded ${transferConfidenceBadgeClass(confidence)}`}
        >
          {transferSourceConfidenceLabel(confidence)}
        </span>
      </div>
    </div>
  );
}
