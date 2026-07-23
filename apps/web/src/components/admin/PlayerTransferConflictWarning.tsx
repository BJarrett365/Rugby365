"use client";

import { findTransferConflicts, type PublicTransferCandidate } from "@/lib/public-player-transfer-utils";

/** CMS-only warning when duplicate from→to transfers exist. */
export function PlayerTransferConflictWarning({
  transfers,
}: {
  transfers: Array<{
    id: string;
    effectiveDate?: Date | string | null;
    fromClub: string | null;
    toClub: string | null;
    fromTeamId?: string | null;
    toTeamId?: string | null;
    movementType?: string;
    transferType?: string;
    seasonId?: string | null;
  }>;
}) {
  const candidates: PublicTransferCandidate[] = transfers.map((t) => ({
    id: t.id,
    effectiveDate: t.effectiveDate ?? null,
    fromClub: t.fromClub,
    toClub: t.toClub,
    fromTeamId: t.fromTeamId ?? null,
    toTeamId: t.toTeamId ?? null,
    movementType: t.movementType ?? t.transferType ?? "permanent",
    seasonId: t.seasonId ?? null,
  }));
  const conflicts = findTransferConflicts(candidates);
  if (!conflicts.length) return null;

  return (
    <div
      className="cms-card mb-4 border border-amber-700/50 bg-amber-950/30"
      role="status"
    >
      <h3 className="font-semibold m-0 text-amber-200">Transfer conflicts</h3>
      <p className="text-sm text-amber-100/80 mt-1 mb-2">
        Duplicate movements detected. Public profiles collapse these automatically; review and keep
        one canonical row in the CMS.
      </p>
      <ul className="text-sm text-amber-50/90 m-0 pl-4">
        {conflicts.map((c) => (
          <li key={c.key}>
            {c.count}× {c.fromLabel} → {c.toLabel} ({c.movementType})
          </li>
        ))}
      </ul>
    </div>
  );
}
