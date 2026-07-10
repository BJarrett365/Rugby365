"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  injuryStatusLabel,
  suspensionStatusLabel,
  type InjuryStatus,
  type SuspensionStatus,
} from "@/lib/availability-types";
import type { PlayerAvailabilityContext } from "@/lib/player-availability-intelligence";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function PlayerAvailabilityPanel({
  playerId,
  embedded = false,
}: {
  playerId: string;
  embedded?: boolean;
}) {
  const [context, setContext] = useState<PlayerAvailabilityContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/availability/summary?playerId=${playerId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (!cancelled) setContext(data.player ?? null);
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const manageLinks = (
    <div className="flex flex-wrap gap-3 text-xs">
      <Link
        href={`/admin/availability/injuries?playerId=${playerId}`}
        className="text-emerald-400"
      >
        Add / edit injury
      </Link>
      <Link
        href={`/admin/availability/suspensions?playerId=${playerId}`}
        className="text-emerald-400"
      >
        Add / edit suspension
      </Link>
      <Link href="/admin/availability/injuries" className="text-zinc-500">
        Availability admin
      </Link>
    </div>
  );

  const body = loading ? (
    <p className="text-sm text-zinc-500 m-0">Loading availability…</p>
  ) : !context ? (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500 m-0">No public availability records yet.</p>
      {manageLinks}
    </div>
  ) : (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 m-0">
        <dt className="text-zinc-500">Current status</dt>
        <dd className="m-0">
          {context.isUnavailable
            ? context.unavailableReason
            : context.returningPlayer
              ? "Returning"
              : "Available"}
        </dd>
        {context.currentSuspension ? (
          <>
            <dt className="text-zinc-500">Suspension status</dt>
            <dd className="m-0">
              {suspensionStatusLabel(context.currentSuspension.status as SuspensionStatus)}
              {context.currentSuspension.offence ? ` — ${context.currentSuspension.offence}` : ""}
            </dd>
          </>
        ) : null}
        <dt className="text-zinc-500">Matches missed</dt>
        <dd className="m-0">{context.totalMatchesMissed}</dd>
        <dt className="text-zinc-500">Return timeline</dt>
        <dd className="m-0">
          {context.currentInjury?.expectedReturnDate
            ? formatDate(context.currentInjury.expectedReturnDate)
            : context.currentSuspension?.suspensionEnd
              ? formatDate(context.currentSuspension.suspensionEnd)
              : "—"}
        </dd>
      </dl>

      {context.injuryHistory.length > 0 ? (
        <div>
          <h4 className="font-medium m-0 mb-2">Public injury history</h4>
          <ul className="m-0 p-0 list-none space-y-1">
            {context.injuryHistory.slice(0, 5).map((row) => (
              <li key={row.id}>
                {injuryStatusLabel(row.status as InjuryStatus)}
                {row.injuryType ? ` — ${row.injuryType}` : ""}
                {row.bodyArea ? ` (${row.bodyArea})` : ""}
                {row.injuryDate ? ` · ${formatDate(row.injuryDate)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {context.suspensionHistory.length > 0 ? (
        <div>
          <h4 className="font-medium m-0 mb-2">Public disciplinary history</h4>
          <ul className="m-0 p-0 list-none space-y-1">
            {context.suspensionHistory.slice(0, 5).map((row) => (
              <li key={row.id}>
                {suspensionStatusLabel(row.status as SuspensionStatus)}
                {row.offence ? ` — ${row.offence}` : ""}
                {row.suspensionStart ? ` · ${formatDate(row.suspensionStart)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {manageLinks}
    </div>
  );

  if (embedded) {
    return (
      <div className="border-t border-zinc-800 pt-4">
        <div className="mb-3">
          <h4 className="font-medium m-0">Availability</h4>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            Public injury and suspension data only — no private medical records.
          </p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="cms-card mb-4">
      <div className="mb-3">
        <h3 className="font-semibold m-0">Availability</h3>
        <p className="text-sm text-zinc-500 m-0 mt-1">
          Public injury and suspension status only — no private medical records.
        </p>
      </div>
      {body}
    </div>
  );
}
